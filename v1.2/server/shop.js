const fs = require('fs');

/**
 * Load shop data from JSON file
 * @param {string} path - Path to shop.json
 * @returns {object} Shop data with categories and defaultKit
 */
function loadShop(path) {
  const data = fs.readFileSync(path, 'utf-8');
  return JSON.parse(data);
}

/**
 * Get default kit items
 * @param {object} shopData - Shop data object
 * @returns {Array<string>} Array of default item keys
 */
function getDefaultKit(shopData) {
  return shopData.defaultKit || [];
}

/**
 * Check if team can afford an item
 * @param {number} teamMoney - Current team balance
 * @param {number} itemPrice - Item price
 * @returns {boolean} True if affordable
 */
function canAfford(teamMoney, itemPrice) {
  return teamMoney >= itemPrice;
}

/**
 * Find item in shop data by key
 * @param {object} shopData - Shop data object
 * @param {string} itemKey - Item key to find
 * @returns {object|null} Item object with category, or null if not found
 */
function findItem(shopData, itemKey) {
  for (const category of shopData.categories) {
    const item = category.items.find(i => i.key === itemKey);
    if (item) {
      return { ...item, category: category.key };
    }
  }
  return null;
}

/**
 * Purchase an item for a team
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @param {string} itemKey - Item key to purchase
 * @param {object} shopData - Shop data object
 * @returns {Promise<object>} Purchase result with success, newBalance, or purchaseId/warning
 */
async function purchaseItem(db, teamId, itemKey, shopData) {
  const item = findItem(shopData, itemKey);
  if (!item) {
    throw new Error(`Item not found: ${itemKey}`);
  }

  const team = db.prepare('SELECT money FROM teams WHERE id = ?').get(teamId);
  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  if (canAfford(team.money, item.price)) {
    // Affordable: deduct balance and record purchase
    const newBalance = team.money - item.price;
    db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(newBalance, teamId);
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, 1)')
      .run(teamId, itemKey, item.category, item.price);
    
    return { success: true, newBalance };
  } else {
    // Not affordable: create pending purchase
    const result = db.prepare('INSERT INTO pending_purchases (team_id, item_key, amount, status) VALUES (?, ?, ?, ?) RETURNING id')
      .get(teamId, itemKey, item.price, 'pending');
    
    return {
      success: false,
      purchaseId: result.id,
      warning: `Cannot afford — host override required`
    };
  }
}

/**
 * Force approve a pending purchase (allows negative balance)
 * @param {object} db - Database instance
 * @param {number} purchaseId - Pending purchase ID
 * @param {object} shopData - Shop data object
 * @returns {Promise<object>} Result with success and newBalance
 */
async function forceApprove(db, purchaseId, shopData) {
  const pending = db.prepare('SELECT * FROM pending_purchases WHERE id = ?').get(purchaseId);
  if (!pending) {
    throw new Error(`Pending purchase not found: ${purchaseId}`);
  }

  const team = db.prepare('SELECT money FROM teams WHERE id = ?').get(pending.team_id);
  if (!team) {
    throw new Error(`Team not found: ${pending.team_id}`);
  }

  const item = findItem(shopData, pending.item_key);
  if (!item) {
    throw new Error(`Item not found: ${pending.item_key}`);
  }

  // Deduct balance (allow negative)
  const newBalance = team.money - pending.amount;
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(newBalance, pending.team_id);

  // Record purchase
  db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, 1)')
    .run(pending.team_id, pending.item_key, item.category, pending.amount);

  // Update pending status
  db.prepare('UPDATE pending_purchases SET status = ? WHERE id = ?').run('approved', purchaseId);

  return { success: true, newBalance };
}

/**
 * Get team's inventory (purchased items)
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @returns {Array<object>} Array of purchased items
 */
function getTeamInventory(db, teamId) {
  return db.prepare('SELECT * FROM purchases WHERE team_id = ? ORDER BY created_at').all(teamId);
}

/**
 * Get team's purchase history
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @returns {Array<object>} Array of purchases
 */
function getTeamPurchases(db, teamId) {
  return db.prepare('SELECT * FROM purchases WHERE team_id = ? ORDER BY created_at DESC').all(teamId);
}

module.exports = {
  loadShop,
  getDefaultKit,
  canAfford,
  purchaseItem,
  forceApprove,
  getTeamInventory,
  getTeamPurchases
};

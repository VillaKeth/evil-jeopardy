const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { initDb } = require('../server/db');
const {
  loadShop,
  getDefaultKit,
  canAfford,
  purchaseItem,
  forceApprove,
  getTeamInventory,
  getTeamPurchases
} = require('../server/shop');

// Helper to create test database
function createTestDb() {
  const dbPath = ':memory:';
  return initDb(dbPath);
}

test('loadShop returns categories with items', () => {
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  assert.ok(shopData.categories, 'Shop should have categories');
  assert.ok(Array.isArray(shopData.categories), 'Categories should be an array');
  assert.ok(shopData.categories.length > 0, 'Should have at least one category');
  
  const cakesCategory = shopData.categories.find(c => c.key === 'cakes');
  assert.ok(cakesCategory, 'Should have cakes category');
  assert.ok(Array.isArray(cakesCategory.items), 'Category should have items array');
  assert.ok(cakesCategory.items.length > 0, 'Cakes category should have items');
});

test('getDefaultKit returns baseline items', () => {
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  const defaultKit = getDefaultKit(shopData);
  
  assert.ok(Array.isArray(defaultKit), 'Default kit should be an array');
  assert.ok(defaultKit.length > 0, 'Default kit should have items');
  assert.ok(shopData.defaultKit, 'Shop data should have defaultKit property');
  assert.deepStrictEqual(defaultKit, shopData.defaultKit, 'getDefaultKit should return shopData.defaultKit');
});

test('canAfford returns true when team has enough money', () => {
  assert.strictEqual(canAfford(1000, 500), true, 'Should afford item costing less');
  assert.strictEqual(canAfford(1000, 1000), true, 'Should afford item costing exactly the balance');
});

test('canAfford returns false when team does not have enough money', () => {
  assert.strictEqual(canAfford(500, 1000), false, 'Should not afford item costing more');
  assert.strictEqual(canAfford(0, 100), false, 'Should not afford with zero balance');
});

test('purchaseItem deducts money and records purchase when affordable', async () => {
  const dbWrapper = createTestDb();
  const { db } = dbWrapper;
  
  // Create a test team with money
  const team = dbWrapper.createTeam('Test Team');
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(5000, team.id);
  
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  // Purchase an item
  const result = await purchaseItem(db, team.id, 'flour-basic', shopData);
  
  assert.strictEqual(result.success, true, 'Purchase should succeed');
  assert.ok(result.newBalance !== undefined, 'Should return new balance');
  
  // Check balance was deducted
  const updatedTeam = db.prepare('SELECT money FROM teams WHERE id = ?').get(team.id);
  assert.strictEqual(updatedTeam.money, result.newBalance, 'Balance should match returned value');
  assert.ok(updatedTeam.money < 5000, 'Balance should have decreased');
  
  // Check purchase was recorded
  const purchases = db.prepare('SELECT * FROM purchases WHERE team_id = ? AND item_key = ?').all(team.id, 'flour-basic');
  assert.strictEqual(purchases.length, 1, 'Purchase should be recorded');
  assert.strictEqual(purchases[0].approved_by_host, 1, 'Purchase should be approved');
  
  dbWrapper.close();
});

test('purchaseItem creates pending purchase when not affordable', async () => {
  const dbWrapper = createTestDb();
  const { db } = dbWrapper;
  
  // Create a test team with insufficient money
  const team = dbWrapper.createTeam('Poor Team');
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(100, team.id);
  
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  // Try to purchase expensive item
  const result = await purchaseItem(db, team.id, 'cake-banana', shopData);
  
  assert.strictEqual(result.success, false, 'Purchase should fail');
  assert.ok(result.purchaseId, 'Should return purchase ID');
  assert.strictEqual(result.currentBalance, 100, 'Should return the current team balance for host warnings');
  assert.ok(result.warning, 'Should return warning message');
  assert.ok(result.warning.includes('host override'), 'Warning should mention host override');
  
  // Check pending purchase was created
  const pending = db.prepare('SELECT * FROM pending_purchases WHERE id = ?').get(result.purchaseId);
  assert.ok(pending, 'Pending purchase should exist');
  assert.strictEqual(pending.team_id, team.id, 'Should be for correct team');
  assert.strictEqual(pending.item_key, 'cake-banana', 'Should be for correct item');
  assert.strictEqual(pending.status, 'pending', 'Status should be pending');
  
  // Balance should not have changed
  const updatedTeam = db.prepare('SELECT money FROM teams WHERE id = ?').get(team.id);
  assert.strictEqual(updatedTeam.money, 100, 'Balance should not have changed');
  
  dbWrapper.close();
});

test('forceApprove overrides a rejected purchase', async () => {
  const dbWrapper = createTestDb();
  const { db } = dbWrapper;
  
  // Create a test team with insufficient money
  const team = dbWrapper.createTeam('Override Team');
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(100, team.id);
  
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  // Create a failed purchase
  const failedPurchase = await purchaseItem(db, team.id, 'cake-banana', shopData);
  assert.strictEqual(failedPurchase.success, false);
  
  // Force approve it
  const result = await forceApprove(db, failedPurchase.purchaseId, shopData);
  
  assert.strictEqual(result.success, true, 'Force approve should succeed');
  assert.ok(result.newBalance !== undefined, 'Should return new balance');
  
  // Check balance was deducted (may be negative)
  const updatedTeam = db.prepare('SELECT money FROM teams WHERE id = ?').get(team.id);
  assert.strictEqual(updatedTeam.money, result.newBalance, 'Balance should match returned value');
  
  // Check pending purchase status was updated
  const pending = db.prepare('SELECT * FROM pending_purchases WHERE id = ?').get(failedPurchase.purchaseId);
  assert.strictEqual(pending.status, 'approved', 'Status should be approved');
  
  // Check purchase was recorded
  const purchases = db.prepare('SELECT * FROM purchases WHERE team_id = ? AND item_key = ?').all(team.id, 'cake-banana');
  assert.strictEqual(purchases.length, 1, 'Purchase should be recorded');
  
  dbWrapper.close();
});

test('getTeamInventory returns purchased items', async () => {
  const dbWrapper = createTestDb();
  const { db } = dbWrapper;
  
  // Create a test team and make some purchases
  const team = dbWrapper.createTeam('Inventory Team');
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(10000, team.id);
  
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  await purchaseItem(db, team.id, 'flour-basic', shopData);
  await purchaseItem(db, team.id, 'eggs-basic', shopData);
  
  const inventory = getTeamInventory(db, team.id);
  
  assert.ok(Array.isArray(inventory), 'Inventory should be an array');
  assert.strictEqual(inventory.length, 2, 'Should have 2 items');
  
  const itemKeys = inventory.map(item => item.item_key);
  assert.ok(itemKeys.includes('flour-basic'), 'Should include flour-basic');
  assert.ok(itemKeys.includes('eggs-basic'), 'Should include eggs-basic');
  
  dbWrapper.close();
});

test('getTeamPurchases returns all purchases', async () => {
  const dbWrapper = createTestDb();
  const { db } = dbWrapper;
  
  // Create a test team and make purchases
  const team = dbWrapper.createTeam('Purchase History Team');
  db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(10000, team.id);
  
  const shopPath = path.join(__dirname, '../data/shop.json');
  const shopData = loadShop(shopPath);
  
  await purchaseItem(db, team.id, 'flour-basic', shopData);
  await purchaseItem(db, team.id, 'sugar', shopData);
  
  const purchases = getTeamPurchases(db, team.id);
  
  assert.ok(Array.isArray(purchases), 'Purchases should be an array');
  assert.strictEqual(purchases.length, 2, 'Should have 2 purchases');
  
  purchases.forEach(purchase => {
    assert.ok(purchase.item_key, 'Each purchase should have item_key');
    assert.ok(purchase.price !== undefined, 'Each purchase should have price');
    assert.ok(purchase.category, 'Each purchase should have category');
  });
  
  dbWrapper.close();
});

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('shop purchase request flow is wired through server host and player clients', () => {
  const serverScript = read('server/index.js');
  const playerHtml = read('public/player.html');
  const playerScript = read('public/js/player.js');
  const hostHtml = read('public/host.html');
  const hostScript = read('public/js/host.js');
  const styleSheet = read('public/css/style.css');

  assert.match(serverScript, /socket\.on\('shop:request-purchase'/);
  assert.match(serverScript, /socket\.on\('shop:deny-purchase-request'/);
  assert.match(serverScript, /io\.to\('host'\)\.emit\('shop:purchase-request'/);
  assert.match(serverScript, /socket\.emit\('shop:request-acknowledged'/);
  assert.match(serverScript, /io\.to\('player'\)\.emit\('shop:purchase-denied'/);

  assert.match(playerScript, /requestPurchase\(itemKey\)/);
  assert.match(playerScript, /pendingShopRequests/);
  assert.match(playerScript, /data-item-key="\$\{escapeHtml\(item\.key\)\}"/);
  assert.match(playerScript, /querySelectorAll\('\.player-buy-btn\[data-item-key\]'/);
  assert.match(playerScript, /socket\.emit\('shop:request-purchase', \{ teamId: myTeam\.id, itemKey \}\)/);
  assert.match(playerScript, /socket\.on\('shop:request-acknowledged'/);
  assert.match(playerScript, /socket\.on\('shop:purchase-denied'/);
  assert.match(playerScript, /Request \(\$\$\{item\.price\}\)/);
  assert.match(playerScript, /player-buy-btn/);
  assert.match(playerHtml, /player-shop-item/);

  assert.match(hostHtml, /id="shop-purchase-requests"/);
  assert.match(hostScript, /socket\.on\('shop:purchase-request'/);
  assert.match(hostScript, /socket\.emit\('shop:deny-purchase-request'/);
  assert.match(hostScript, /showPurchaseRequestNotification/);
  assert.match(hostScript, /approvePurchaseRequest/);
  assert.match(hostScript, /denyPurchaseRequest/);

  assert.match(styleSheet, /\.purchase-request-container/);
  assert.match(styleSheet, /\.purchase-request-card/);
  assert.match(styleSheet, /\.purchase-request-actions/);
  assert.match(styleSheet, /\.player-buy-btn/);
  assert.match(styleSheet, /@keyframes slideIn/);
});

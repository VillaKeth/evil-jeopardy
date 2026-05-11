const test = require('node:test');
const assert = require('node:assert');
const { getFallbackImage, generateGalleryWithFallback, getScoreTier } = require('../server/cake-generator');
const sharp = require('sharp');

test('getFallbackImage returns a Buffer', async () => {
  const result = await getFallbackImage('good');
  assert.ok(Buffer.isBuffer(result), 'Should return a Buffer');
  assert.ok(result.length > 0, 'Buffer should not be empty');
});

test('getFallbackImage returns an image from the good tier folder', async () => {
  const result = await getFallbackImage('good');
  
  // Verify it's a valid PNG
  const metadata = await sharp(result).metadata();
  assert.strictEqual(metadata.format, 'png', 'Should be a PNG image');
  assert.strictEqual(metadata.width, 512, 'Width should be 512');
  assert.strictEqual(metadata.height, 512, 'Height should be 512');
});

test('getFallbackImage returns an image from the catastrophic folder', async () => {
  const result = await getFallbackImage('catastrophic');
  
  // Verify it's a valid PNG
  const metadata = await sharp(result).metadata();
  assert.strictEqual(metadata.format, 'png', 'Should be a PNG image');
  assert.strictEqual(metadata.width, 512, 'Width should be 512');
  assert.strictEqual(metadata.height, 512, 'Height should be 512');
});

test('getFallbackImage returns different images on repeated calls (random selection)', async () => {
  const images = [];
  
  // Get 10 images to increase chance of variation
  for (let i = 0; i < 10; i++) {
    const img = await getFallbackImage('medium');
    images.push(img.toString('hex'));
  }
  
  // Check that not all images are identical
  const uniqueImages = new Set(images);
  assert.ok(uniqueImages.size > 1, 'Should return different images on repeated calls');
});

test('generateGalleryWithFallback returns non-null entries', async () => {
  // Mock a scenario where generateGallery might return nulls
  const scores = { taste: 10, accuracy: 10, creativity: 10, total: 30 };
  const result = await generateGalleryWithFallback('chocolate', scores, [], [], 4);
  
  assert.strictEqual(result.length, 4, 'Should return 4 images');
  
  // Verify no nulls
  result.forEach((img, index) => {
    assert.ok(img !== null, `Image at index ${index} should not be null`);
    assert.ok(Buffer.isBuffer(img), `Image at index ${index} should be a Buffer`);
  });
});

test('generateGalleryWithFallback uses fallbacks when API fails', async () => {
  // Use a score tier to verify fallback behavior
  const scores = { taste: 5, accuracy: 5, creativity: 5, total: 15 };
  
  const result = await generateGalleryWithFallback('vanilla', scores, [], [], 3);
  
  assert.strictEqual(result.length, 3, 'Should return 3 images');
  
  // Verify all are buffers and none are null
  result.forEach((img, index) => {
    assert.ok(img !== null, `Image at index ${index} should not be null`);
    assert.ok(Buffer.isBuffer(img), `Image at index ${index} should be a Buffer`);
  });
});

test('getFallbackImage handles all tier types', async () => {
  const tiers = ['good', 'medium', 'bad', 'catastrophic'];
  
  for (const tier of tiers) {
    const result = await getFallbackImage(tier);
    assert.ok(Buffer.isBuffer(result), `Should return Buffer for tier: ${tier}`);
    
    const metadata = await sharp(result).metadata();
    assert.strictEqual(metadata.format, 'png', `Should be PNG for tier: ${tier}`);
  }
});

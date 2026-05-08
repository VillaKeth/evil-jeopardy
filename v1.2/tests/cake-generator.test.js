const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { buildPrompt, generateCakeImage, postProcessImage, generateGallery } = require('../server/cake-generator.js');

describe('Cake Generator', () => {
  describe('buildPrompt', () => {
    it('returns appropriate prompt text for high scores (80-100)', () => {
      const scores = { taste: 30, accuracy: 25, creativity: 25, total: 80 };
      const prompt = buildPrompt('chocolate', scores, ['cocoa', 'sugar'], []);
      
      assert.ok(prompt.toLowerCase().includes('amateur'), 'Should include "amateur"');
      assert.ok(prompt.includes('slightly uneven'), 'Should include "slightly uneven"');
      assert.ok(prompt.includes('chocolate'), 'Should include cake type');
      assert.ok(prompt.includes('cocoa'), 'Should include ingredients');
      assert.ok(prompt.includes('sugar'), 'Should include ingredients');
    });

    it('returns appropriate prompt for good scores (60-79)', () => {
      const scores = { taste: 25, accuracy: 20, creativity: 20, total: 65 };
      const prompt = buildPrompt('vanilla', scores, ['vanilla extract'], []);
      
      assert.ok(prompt.includes('messy') || prompt.includes('Messy'), 'Should include "messy"');
      assert.ok(prompt.includes('lopsided'), 'Should include "lopsided"');
    });

    it('returns appropriate prompt for mediocre scores (40-59)', () => {
      const scores = { taste: 15, accuracy: 20, creativity: 15, total: 50 };
      const prompt = buildPrompt('strawberry', scores, [], []);
      
      assert.ok(prompt.includes('ugly') || prompt.includes('Ugly'), 'Should include "ugly"');
      assert.ok(prompt.includes('burnt'), 'Should include "burnt"');
    });

    it('returns appropriate prompt for poor scores (20-39)', () => {
      const scores = { taste: 10, accuracy: 10, creativity: 10, total: 30 };
      const prompt = buildPrompt('red velvet', scores, [], []);
      
      assert.ok(prompt.includes('horrifying') || prompt.includes('Horrifying'), 'Should include "horrifying"');
      assert.ok(prompt.includes('teeth'), 'Should include "teeth"');
    });

    it('returns appropriate prompt for catastrophic scores (0-19)', () => {
      const scores = { taste: 5, accuracy: 5, creativity: 5, total: 15 };
      const prompt = buildPrompt('birthday', scores, [], []);
      
      assert.ok(prompt.includes('eldritch') || prompt.includes('Eldritch'), 'Should include "eldritch"');
      assert.ok(prompt.includes('nightmare'), 'Should include "nightmare"');
    });

    it('includes chaos events in prompt', () => {
      const scores = { taste: 30, accuracy: 30, creativity: 30, total: 90 };
      const events = [
        { type: 'ingredient_swap', description: 'Sugar replaced with salt' },
        { type: 'time_warp', description: 'Oven set to 900°F' }
      ];
      const prompt = buildPrompt('chocolate', scores, [], events);
      
      assert.ok(prompt.includes('Sugar replaced with salt'), 'Should include first event');
      assert.ok(prompt.includes('Oven set to 900°F'), 'Should include second event');
    });
  });

  describe('generateCakeImage', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('calls HuggingFace API with correct payload', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer
      };
      
      global.fetch = mock.fn(async () => mockResponse);

      const prompt = 'Test cake prompt';
      const result = await generateCakeImage(prompt);

      assert.strictEqual(global.fetch.mock.calls.length, 1);
      const [url, options] = global.fetch.mock.calls[0].arguments;
      
      assert.strictEqual(url, 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell');
      assert.ok(options.headers.Authorization, 'Should have Authorization header');
      assert.strictEqual(options.headers['Content-Type'], 'application/json');
      
      const body = JSON.parse(options.body);
      assert.strictEqual(body.inputs, prompt);
    });

    it('returns null on API failure', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Network error');
      });

      const result = await generateCakeImage('Test prompt');
      assert.strictEqual(result, null);
    });

    it('returns null on non-OK response', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };
      
      global.fetch = mock.fn(async () => mockResponse);

      const result = await generateCakeImage('Test prompt');
      assert.strictEqual(result, null);
    });
  });

  describe('postProcessImage', () => {
    // Create a minimal valid PNG buffer (1x1 pixel, black)
    const createTestPNG = () => {
      return Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0x60, 0x60, 0x60, 0x00,
        0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x6B, 0xE7,
        0x0E, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
    };

    it('returns a buffer for good tier', async () => {
      const testBuffer = createTestPNG();
      const result = await postProcessImage(testBuffer, 'good');
      
      assert.ok(Buffer.isBuffer(result), 'Should return a buffer');
      assert.ok(result.length > 0, 'Buffer should not be empty');
    });

    it('returns a buffer for medium tier', async () => {
      const testBuffer = createTestPNG();
      const result = await postProcessImage(testBuffer, 'medium');
      
      assert.ok(Buffer.isBuffer(result), 'Should return a buffer');
      assert.ok(result.length > 0, 'Buffer should not be empty');
    });

    it('returns a buffer for bad tier', async () => {
      const testBuffer = createTestPNG();
      const result = await postProcessImage(testBuffer, 'bad');
      
      assert.ok(Buffer.isBuffer(result), 'Should return a buffer');
      assert.ok(result.length > 0, 'Buffer should not be empty');
    });

    it('returns a buffer for catastrophic tier', async () => {
      const testBuffer = createTestPNG();
      const result = await postProcessImage(testBuffer, 'catastrophic');
      
      assert.ok(Buffer.isBuffer(result), 'Should return a buffer');
      assert.ok(result.length > 0, 'Buffer should not be empty');
    });
  });

  describe('generateGallery', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns array of correct length', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer
      };
      
      global.fetch = mock.fn(async () => mockResponse);

      const scores = { taste: 30, accuracy: 30, creativity: 30, total: 90 };
      const result = await generateGallery('chocolate', scores, ['cocoa'], [], 3);

      assert.strictEqual(result.length, 3, 'Should return array of requested length');
    });

    it('defaults to 4 images when count not specified', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer
      };
      
      global.fetch = mock.fn(async () => mockResponse);

      const scores = { taste: 30, accuracy: 30, creativity: 30, total: 90 };
      const result = await generateGallery('vanilla', scores, [], []);

      assert.strictEqual(result.length, 4, 'Should default to 4 images');
    });

    it('includes nulls for failed generations', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('API failure');
      });

      const scores = { taste: 30, accuracy: 30, creativity: 30, total: 90 };
      const result = await generateGallery('strawberry', scores, [], [], 2);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0], null);
      assert.strictEqual(result[1], null);
    });
  });
});

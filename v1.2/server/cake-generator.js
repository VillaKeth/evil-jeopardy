const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * Build a prompt for cake image generation based on score tier
 * @param {string} cakeType - Type of cake (e.g., 'chocolate', 'vanilla')
 * @param {object} scores - Score object with taste, accuracy, creativity, total
 * @param {string[]} ingredients - Array of ingredient names
 * @param {object[]} chaosEvents - Array of chaos event objects with description
 * @returns {string} Generated prompt text
 */
function buildPrompt(cakeType, scores, ingredients = [], chaosEvents = []) {
  if (!scores || typeof scores.total !== 'number') {
    return `Generic cake attempt, ${cakeType || 'unknown'} flavor`;
  }
  if (!Array.isArray(ingredients)) ingredients = [];
  if (!Array.isArray(chaosEvents)) chaosEvents = [];

  let basePrompt = '';
  const total = scores.total;

  // Determine prompt based on score tier
  if (total >= 80) {
    // High scores: amateur but decent
    basePrompt = `Amateur homemade ${cakeType} cake, slightly uneven frosting, realistic kitchen photo`;
  } else if (total >= 60) {
    // Good scores: messy and lopsided
    basePrompt = `Messy homemade ${cakeType}, lumpy frosting, lopsided, some decorations falling`;
  } else if (total >= 40) {
    // Mediocre scores: ugly and burnt
    basePrompt = `Ugly ${cakeType} attempt, burnt, misshapen, unnatural colors, melted frosting`;
  } else if (total >= 20) {
    // Poor scores: horrifying with body parts
    basePrompt = `Horrifying ${cakeType} cake, eyes emerging from frosting, teeth in fondant, disturbing`;
  } else {
    // Catastrophic scores: eldritch horror
    basePrompt = `Eldritch horror cake abomination, biohazard, nightmare fuel`;
  }

  // Append ingredients if provided
  if (ingredients.length > 0) {
    basePrompt += `, featuring ${ingredients.join(', ')}`;
  }

  // Append chaos events
  if (chaosEvents.length > 0) {
    const eventDescriptions = chaosEvents.map(e => e?.description || '').filter(Boolean).join(', ');
    basePrompt += `. Chaos events: ${eventDescriptions}`;
  }

  return basePrompt;
}

/**
 * Generate a cake image using HuggingFace API
 * @param {string} prompt - Text prompt for image generation
 * @returns {Promise<Buffer|null>} Image buffer or null on failure
 */
async function generateCakeImage(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    if (!process.env.HF_API_TOKEN) {
      console.error('HF_API_TOKEN environment variable is not set');
      return null;
    }

    const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(`HuggingFace API error: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error generating cake image:', error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Apply post-processing effects to image based on score tier
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} scoreTier - Tier: 'good', 'medium', 'bad', or 'catastrophic'
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function postProcessImage(imageBuffer, scoreTier) {
  try {
    let pipeline = sharp(imageBuffer);

    switch (scoreTier) {
      case 'good': // 80+
        // Slight blur and warmth
        pipeline = pipeline
          .blur(1)
          .modulate({ brightness: 1.05, saturation: 1.1 });
        break;

      case 'medium': // 40-79
        // Increased saturation and slight rotation
        pipeline = pipeline
          .modulate({ saturation: 1.4 })
          .rotate(3, { background: { r: 255, g: 255, b: 255 } });
        break;

      case 'bad': // 20-39
        // Heavy blur, desaturate, add sharpening
        pipeline = pipeline
          .blur(5)
          .modulate({ saturation: 0.3 })
          .sharpen({ sigma: 2 });
        break;

      case 'catastrophic': // 0-19
        // Extreme effects: negate, sharpen, rotate
        pipeline = pipeline
          .negate()
          .sharpen({ sigma: 5 })
          .rotate(10, { background: { r: 0, g: 0, b: 0 } });
        break;

      default:
        // No processing for unknown tiers
        break;
    }

    return await pipeline.toBuffer();
  } catch (error) {
    console.error('Error post-processing image:', error.message);
    // Return original buffer on failure
    return imageBuffer;
  }
}

/**
 * Determine score tier based on total score
 * @param {number} totalScore - Total score
 * @returns {string} Tier name
 */
function getScoreTier(totalScore) {
  if (totalScore >= 80) return 'good';
  if (totalScore >= 40) return 'medium';
  if (totalScore >= 20) return 'bad';
  return 'catastrophic';
}

/**
 * Generate a gallery of cake images with variations
 * @param {string} cakeType - Type of cake
 * @param {object} scores - Score object
 * @param {string[]} ingredients - Array of ingredient names
 * @param {object[]} events - Array of chaos events
 * @param {number} count - Number of images to generate (default: 4)
 * @returns {Promise<Array<Buffer|null>>} Array of image buffers or nulls
 */
async function generateGallery(cakeType, scores, ingredients = [], events = [], count = 4) {
  if (!scores || typeof scores.total !== 'number') {
    return Array(count).fill(null);
  }
  const results = [];
  const scoreTier = getScoreTier(scores.total);

  for (let i = 0; i < count; i++) {
    // Create base prompt
    const basePrompt = buildPrompt(cakeType, scores, ingredients, events);
    
    // Add variation number to create slightly different images
    const variantPrompt = `${basePrompt}, variant ${i + 1}`;

    // Generate image
    const imageBuffer = await generateCakeImage(variantPrompt);

    if (imageBuffer) {
      // Post-process the image
      const processedBuffer = await postProcessImage(imageBuffer, scoreTier);
      results.push(processedBuffer);
    } else {
      // Failed generation
      results.push(null);
    }
  }

  return results;
}

/**
 * Get a random fallback image for the given score tier
 * @param {string} scoreTier - Tier: 'good', 'medium', 'bad', or 'catastrophic'
 * @returns {Promise<Buffer>} Random fallback image buffer with light post-processing
 */
async function getFallbackImage(scoreTier) {
  const validTiers = ['good', 'medium', 'bad', 'catastrophic'];
  if (!validTiers.includes(scoreTier)) {
    scoreTier = 'bad';
  }
  
  try {
    const fallbackDir = path.join(__dirname, '..', 'public', 'assets', 'cake-fallbacks');
    
    // Get all fallback images for this tier
    const files = await fs.readdir(fallbackDir);
    const tierFiles = files.filter(f => f.startsWith(`tier-${scoreTier}-`) && f.endsWith('.png'));
    
    if (tierFiles.length === 0) {
      console.error(`No fallback images found for tier: ${scoreTier}`);
      return null;
    }
    
    // Select a random image
    const randomFile = tierFiles[Math.floor(Math.random() * tierFiles.length)];
    const imagePath = path.join(fallbackDir, randomFile);
    
    // Read the image
    const imageBuffer = await fs.readFile(imagePath);
    
    // Apply light post-processing for variety
    try {
      let pipeline = sharp(imageBuffer);
      const hueShift = Math.floor(Math.random() * 20) - 10;
      const saturationShift = 0.9 + Math.random() * 0.2;
      pipeline = pipeline.modulate({ hue: hueShift, saturation: saturationShift });
      return await pipeline.toBuffer();
    } catch (sharpError) {
      console.error('Sharp post-processing failed, returning raw image:', sharpError.message);
      return imageBuffer;
    }
  } catch (error) {
    console.error(`Error getting fallback image for tier ${scoreTier}:`, error.message);
    return null;
  }
}

/**
 * Generate a gallery of cake images with fallback support
 * @param {string} cakeType - Type of cake
 * @param {object} scores - Score object
 * @param {string[]} ingredients - Array of ingredient names
 * @param {object[]} events - Array of chaos events
 * @param {number} count - Number of images to generate (default: 4)
 * @returns {Promise<Array<Buffer>>} Array of image buffers (guaranteed non-null)
 */
async function generateGalleryWithFallback(cakeType, scores, ingredients = [], events = [], count = 4) {
  if (!scores || typeof scores.total !== 'number') {
    const results = [];
    for (let i = 0; i < count; i++) {
      try {
        const fallback = await getFallbackImage('bad');
        results.push(fallback);
      } catch {
        results.push(null);
      }
    }
    return results;
  }
  
  const scoreTier = getScoreTier(scores.total);
  
  // Try to generate gallery first
  const galleryResults = await generateGallery(cakeType, scores, ingredients, events, count);
  
  // Replace any nulls with fallback images
  const finalResults = [];
  for (let i = 0; i < galleryResults.length; i++) {
    if (galleryResults[i] === null) {
      try {
        const fallback = await getFallbackImage(scoreTier);
        finalResults.push(fallback);
      } catch {
        finalResults.push(null);
      }
    } else {
      finalResults.push(galleryResults[i]);
    }
  }
  
  return finalResults;
}

module.exports = {
  buildPrompt,
  generateCakeImage,
  postProcessImage,
  generateGallery,
  getFallbackImage,
  generateGalleryWithFallback,
  getScoreTier
};

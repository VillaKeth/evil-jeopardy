const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Color schemes for each tier
const tiers = {
  good: { r: 50, g: 150, b: 50, name: 'Good' },
  medium: { r: 200, g: 180, b: 50, name: 'Medium' },
  bad: { r: 220, g: 140, b: 50, name: 'Bad' },
  catastrophic: { r: 180, g: 30, b: 30, name: 'Catastrophic' }
};

async function generateFallbackImages() {
  const outputDir = path.join(__dirname, '..', 'public', 'assets', 'cake-fallbacks');
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [tierKey, color] of Object.entries(tiers)) {
    for (let i = 1; i <= 3; i++) {
      const filename = `tier-${tierKey}-${i}.png`;
      const filepath = path.join(outputDir, filename);
      
      // Create a simple colored rectangle
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 3,
          background: { r: color.r, g: color.g, b: color.b }
        }
      })
      .png()
      .toFile(filepath);
      
      console.log(`Created: ${filename}`);
    }
  }
  
  console.log('All fallback images generated successfully!');
}

generateFallbackImages().catch(console.error);

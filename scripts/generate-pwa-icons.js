const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = path.join(__dirname, '..', 'src', 'assets', 'images', 'poker-logo.png');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// PWA icon sizes needed
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple touch icon sizes
const APPLE_SIZES = [120, 152, 167, 180];

async function generateIcons() {
  // Ensure public directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  console.log('Generating PWA icons from:', SOURCE_IMAGE);

  // Generate standard PWA icons
  for (const size of ICON_SIZES) {
    const outputPath = path.join(PUBLIC_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE_IMAGE)
      .resize(size, size, { fit: 'contain', background: { r: 13, g: 27, b: 30, alpha: 1 } })
      .png()
      .toFile(outputPath);
    console.log(`Created: icon-${size}x${size}.png`);
  }

  // Generate Apple touch icons
  for (const size of APPLE_SIZES) {
    const outputPath = path.join(PUBLIC_DIR, `apple-touch-icon-${size}x${size}.png`);
    await sharp(SOURCE_IMAGE)
      .resize(size, size, { fit: 'contain', background: { r: 13, g: 27, b: 30, alpha: 1 } })
      .png()
      .toFile(outputPath);
    console.log(`Created: apple-touch-icon-${size}x${size}.png`);
  }

  // Generate main apple-touch-icon (180x180)
  await sharp(SOURCE_IMAGE)
    .resize(180, 180, { fit: 'contain', background: { r: 13, g: 27, b: 30, alpha: 1 } })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('Created: apple-touch-icon.png');

  // Generate favicon
  await sharp(SOURCE_IMAGE)
    .resize(32, 32, { fit: 'contain', background: { r: 13, g: 27, b: 30, alpha: 1 } })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  console.log('Created: favicon.png');

  // Also update the assets/images favicon
  await sharp(SOURCE_IMAGE)
    .resize(32, 32, { fit: 'contain', background: { r: 13, g: 27, b: 30, alpha: 1 } })
    .png()
    .toFile(path.join(__dirname, '..', 'assets', 'images', 'favicon.png'));
  console.log('Updated: assets/images/favicon.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);

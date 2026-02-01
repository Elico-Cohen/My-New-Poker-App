/**
 * PWA Post-Export Script
 *
 * Run this after `npx expo export --platform web` to complete PWA setup.
 *
 * What it does:
 * 1. Copies public/manifest.json to dist/
 * 2. Copies icon files to dist/assets/images/
 * 3. Adds PWA meta tags and manifest link to dist/index.html
 *
 * Usage: node scripts/pwa-post-export.js
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');

// PWA meta tags to inject
const PWA_META_TAGS = `
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#35654d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Crazy Poker">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
`;

function copyManifest() {
  const src = path.join(PUBLIC_DIR, 'manifest.json');
  const dest = path.join(DIST_DIR, 'manifest.json');

  if (!fs.existsSync(src)) {
    console.error('ERROR: public/manifest.json not found');
    process.exit(1);
  }

  fs.copyFileSync(src, dest);
  console.log('Copied: public/manifest.json -> dist/manifest.json');
}

function copyIcons() {
  const destDir = path.join(DIST_DIR, 'assets', 'images');

  // Create destination directory if needed
  fs.mkdirSync(destDir, { recursive: true });

  const icons = ['icon.png', 'adaptive-icon.png'];

  for (const icon of icons) {
    const src = path.join(ASSETS_DIR, icon);
    const dest = path.join(destDir, icon);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied: assets/images/${icon} -> dist/assets/images/${icon}`);
    } else {
      console.warn(`WARNING: ${icon} not found at ${src}`);
    }
  }

  // Copy PWA icons from public/ to dist/
  const pwaIcons = [
    'icon-72x72.png', 'icon-96x96.png', 'icon-128x128.png', 'icon-144x144.png',
    'icon-152x152.png', 'icon-192x192.png', 'icon-384x384.png', 'icon-512x512.png',
    'apple-touch-icon.png', 'apple-touch-icon-120x120.png', 'apple-touch-icon-152x152.png',
    'apple-touch-icon-167x167.png', 'apple-touch-icon-180x180.png', 'favicon.png'
  ];

  for (const icon of pwaIcons) {
    const src = path.join(PUBLIC_DIR, icon);
    const dest = path.join(DIST_DIR, icon);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied: public/${icon} -> dist/${icon}`);
    } else {
      console.warn(`WARNING: ${icon} not found at ${src}`);
    }
  }
}

function injectPwaMetaTags() {
  const indexPath = path.join(DIST_DIR, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('ERROR: dist/index.html not found. Run expo export first.');
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Check if already injected
  if (html.includes('rel="manifest"')) {
    console.log('PWA meta tags already present in index.html');
    return;
  }

  // Inject before </head>
  html = html.replace('</head>', `${PWA_META_TAGS}</head>`);

  // Update lang attribute for Hebrew RTL
  html = html.replace('<html  lang="en">', '<html lang="he" dir="rtl">');

  fs.writeFileSync(indexPath, html);
  console.log('Injected: PWA meta tags into dist/index.html');
  console.log('Updated: HTML lang="he" dir="rtl"');
}

function main() {
  console.log('PWA Post-Export Script');
  console.log('======================\n');

  if (!fs.existsSync(DIST_DIR)) {
    console.error('ERROR: dist/ directory not found. Run `npx expo export --platform web` first.');
    process.exit(1);
  }

  copyManifest();
  copyIcons();
  injectPwaMetaTags();

  console.log('\nPWA setup complete!');
  console.log('\nNext steps:');
  console.log('1. Deploy: firebase deploy --only hosting');
  console.log('2. Test: Open in Chrome mobile -> Add to Home Screen');
}

main();

const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');

async function generate() {
  const assets = path.resolve(__dirname, '../public/assets');
  const source = path.join(assets, 'chatone-logo.png');
  const icons = [
    ['favicon-16x16.png', 16],
    ['favicon-32x32.png', 32],
    ['apple-touch-icon-180x180.png', 180],
    ['icon-192x192.png', 192],
  ];
  for (const [filename, size] of icons) {
    await sharp(source)
      .resize(size, size)
      .flatten({ background: '#fff' })
      .png()
      .toFile(path.join(assets, filename));
  }
  await sharp(source)
    .resize(410, 410)
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#fff' })
    .flatten({ background: '#fff' })
    .png()
    .toFile(path.join(assets, 'maskable-icon.png'));
  const png = await fs.readFile(source);
  await fs.writeFile(
    path.join(assets, 'logo.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="ChatOne"><image width="1024" height="1024" href="data:image/png;base64,${png.toString('base64')}"/></svg>\n`,
  );
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

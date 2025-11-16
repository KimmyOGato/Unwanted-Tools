const fs = require('fs');
const path = require('path');

const base64Path = path.join(__dirname, '..', 'build', 'icon.base64.txt');
const outPng = path.join(__dirname, '..', 'build', 'icon.png');
const svgPath = path.join(__dirname, '..', 'build', 'icon.svg');

if (!fs.existsSync(path.dirname(outPng))) fs.mkdirSync(path.dirname(outPng), { recursive: true });

// If an SVG icon exists, prefer it and skip writing the base64 placeholder.
if (fs.existsSync(svgPath)) {
	console.log('Found build/icon.svg — skipping base64 PNG write.');
	// Do not attempt to convert here; CI or local user should convert SVG to PNG (e.g., ImageMagick or png-to-ico will be used later).
	process.exit(0);
}

if (!fs.existsSync(base64Path)) {
	console.error('Base64 icon not found at', base64Path);
	process.exit(1);
}

const b64 = fs.readFileSync(base64Path, 'utf8').trim();
const buf = Buffer.from(b64, 'base64');
fs.writeFileSync(outPng, buf);
console.log('Wrote', outPng);

// Validate PNG dimensions (simple IHDR parse) and warn if too small for Windows icon conversion
try {
	const png = fs.readFileSync(outPng);
	if (png.length >= 24 && png.toString('ascii', 12, 16) === 'IHDR') {
		const width = png.readUInt32BE(16);
		const height = png.readUInt32BE(20);
		console.log('Icon dimensions:', width + 'x' + height);
		if (width < 256 || height < 256) {
			console.error('\nERROR: Icon image is smaller than the recommended 256x256 for Windows icons.');
			console.error('electron-builder/app-builder may fail to convert very small images (example: 1x1).');
			console.error('Please replace', base64Path, 'or provide a proper PNG (>=256x256) at', outPng);
			process.exit(2);
		}
	} else {
		console.warn('Warning: could not detect IHDR chunk in', outPng, '- file may not be a valid PNG.');
	}
} catch (e) {
	console.warn('Warning validating PNG dimensions:', e && e.message)
}

/**
 * Builds self-contained index.html and /Users/alexander/Downloads/digital_botanical_synthesizer.html
 * from the modular ES sources in src/* so the simulator works out-of-the-box on both file:// and http://.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const moduleFiles = [
  'src/biology/SpeciesProfiles.js',
  'src/biology/LivingBonsaiOrganism.js',
  'src/rendering/BotanicalGeometries.js',
  'src/rendering/AsciiThreeRenderer.js',
  'src/audio/BonsaiAudioSynth.js',
  'src/interaction/CameraController.js',
  'src/interaction/PruningController.js',
  'src/main.js'
];

let combinedJs = '';
for (const rel of moduleFiles) {
  let code = fs.readFileSync(path.join(root, rel), 'utf8');
  // Strip ES module import statements
  code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '');
  // Strip export keywords
  code = code.replace(/export\s+(class|function|const|let|var)\s+/g, '$1 ');
  combinedJs += `\n/* --- MODULE: ${rel} --- */\n` + code + '\n';
}

// Verify combined JavaScript syntax
new Function(combinedJs);

const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const scriptBlock = `<!-- Modular source in ./src/* (compiled via node scripts/build-bundle.mjs for file:// + http:// compatibility) -->\n  <script id="bonsaiBundleScript">\n${combinedJs}\n  </script>`;

if (/<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/.test(html)) {
  html = html.replace(/<script\s+type="module"\s+src="\.\/src\/main\.js"><\/script>/, scriptBlock);
} else if (/<script\s+id="bonsaiBundleScript">[\s\S]*?<\/script>/.test(html)) {
  html = html.replace(/<!-- Modular source in \.\/src\/\*[\s\S]*?<\/script>/, scriptBlock);
} else {
  throw new Error('Could not find target <script> tag in index.html');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`[PASS] Updated ${indexPath} (${html.length} bytes)`);

const downloadsPath = '/Users/alexander/Downloads/digital_botanical_synthesizer.html';
if (fs.existsSync(path.dirname(downloadsPath))) {
  fs.writeFileSync(downloadsPath, html, 'utf8');
  console.log(`[PASS] Synced ${downloadsPath} (${html.length} bytes)`);
}

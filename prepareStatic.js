const fs = require('fs');
const path = require('path');

// Build the backend's public directory from the repository frontend.
// Render can run this service with either the repository root or `backend/`
// as its working/root directory, so try both layouts without guessing.
const here = __dirname;
const backendDir = path.resolve(here, '..');
const publicDir = path.join(backendDir, 'public');

const frontendCandidates = [
  path.resolve(here, '../../frontend'), // repo root -> frontend
  path.resolve(here, '../frontend'),    // backend -> frontend (if copied there)
  path.resolve(process.cwd(), 'frontend')
];

const source = frontendCandidates.find((p) =>
  fs.existsSync(path.join(p, 'index.html'))
);

if (!source) {
  throw new Error(
    `[prepareStatic] frontend/index.html was not found. Checked: ${frontendCandidates.join(', ')}`
  );
}

fs.mkdirSync(publicDir, { recursive: true });
fs.cpSync(source, publicDir, { recursive: true, force: true });

console.log(`[prepareStatic] frontend: ${source} -> ${publicDir}`);

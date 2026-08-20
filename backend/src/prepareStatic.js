const fs = require('fs');
const path = require('path');

// Render may run the backend with `backend/` as its root directory.
// server.js expects ../admin and ../frontend relative to src/ in that case.
// When the repository root is used, the destinations already exist and are left untouched.
const here = __dirname;
const candidates = {
  admin: [path.resolve(here, '../admin'), path.resolve(here, '../../admin')],
  frontend: [path.resolve(here, '../frontend'), path.resolve(here, '../../frontend')]
};

for (const [name, sources] of Object.entries(candidates)) {
  const source = sources.find(p => fs.existsSync(p));
  if (!source) continue;
  const target = path.resolve(here, '../../', name);
  if (path.resolve(source) === path.resolve(target)) continue;
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
  console.log(`[prepareStatic] ${name}: ${source} -> ${target}`);
}

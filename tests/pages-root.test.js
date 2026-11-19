/* GitHub Pages may serve either frontend/ (Actions workflow) or the branch root: the root copies must match frontend/. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), front = path.join(root, 'frontend');
function assert(v, m) { if (!v) throw new Error(m); }
const list = (d, base = '') => fs.readdirSync(path.join(d, base), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? list(d, path.join(base, e.name)) : [path.join(base, e.name)]);
const files = list(front);
files.forEach((f) => assert(fs.existsSync(path.join(root, f)) && fs.readFileSync(path.join(root, f)).equals(fs.readFileSync(path.join(front, f))), 'root copy differs from frontend/: ' + f + ' (copy frontend/* to the root)'));
list(path.join(root, 'assets')).forEach((f) => assert(fs.existsSync(path.join(front, 'assets', f)), 'stale root asset: assets/' + f));
assert(fs.existsSync(path.join(root, '.nojekyll')), '.nojekyll keeps GitHub from rendering README as the home page');
console.log('PASS: ' + files.length + ' root copies match frontend/ (Pages from branch or Actions)');

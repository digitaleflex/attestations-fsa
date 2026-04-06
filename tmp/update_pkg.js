const fs = require('fs');
const path = 'c:\\Users\\PC\\Documents\\GitHub\\attestations-fsa\\package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.packageManager = "pnpm@9.15.4";
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json updated with pnpm@9.15.4');

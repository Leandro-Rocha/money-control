const fs = require('fs');
const path = require('path');
const p = path.join('openspec/changes/configure-drizzle-migrations/tasks.md');
let content = fs.readFileSync(p, 'utf8');
content = content.replace(/- \[ \]/g, '- [x]');
fs.writeFileSync(p, content);

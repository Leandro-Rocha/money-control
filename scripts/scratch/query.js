const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');
db.prepare('DELETE FROM dismissed_projections WHERE id IN (27, 28)').run();
console.log('Deleted orphaned dismissed projections');

const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');
const res2 = db.prepare("DELETE FROM dismissed_projections WHERE source_type = 'installment'").run();
console.log(`Linhas deletadas em dismissed_projections: ${res2.changes}`);

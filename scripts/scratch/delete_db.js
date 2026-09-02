const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');

const txId = 215;

const res1 = db.prepare("DELETE FROM transactions WHERE id = ?").run(txId);
console.log(`Deleted ${res1.changes} from transactions.`);

const res2 = db.prepare("DELETE FROM dismissed_projections WHERE source_type = 'installment' AND source_id = ?").run(txId);
console.log(`Deleted ${res2.changes} from dismissed_projections.`);


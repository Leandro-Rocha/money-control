const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');

// Delete any real transactions that have source_type = 'installment' AND installment_current is null
// (which happens when they are pulled via confirmProjectedRow)
const res = db.prepare("DELETE FROM transactions WHERE source_type = 'installment' AND installment_current IS NULL").run();
console.log(`Linhas apagadas: ${res.changes}`);

const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');

const rows = db.prepare("SELECT id, month, description, source_type, installment_current FROM transactions WHERE source_type = 'installment'").all();
console.log(rows);

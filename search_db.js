const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');

const rows = db.prepare("SELECT id, month, day, description, installment_current, installment_total FROM transactions WHERE description LIKE '%Água Vida%' OR description LIKE '%Agua Vida%'").all();
console.log(JSON.stringify(rows, null, 2));

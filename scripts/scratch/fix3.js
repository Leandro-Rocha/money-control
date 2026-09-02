const Database = require('better-sqlite3');
const db = new Database('data/money_control.db');

const rows = db.prepare("SELECT id FROM transactions WHERE source_type = 'installment'").all();
console.log(rows);
for (const row of rows) {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(row.id);
    db.prepare("DELETE FROM dismissed_projections WHERE source_type = 'installment'").run();
}
console.log("Deleted.");

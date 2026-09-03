import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const all = db.prepare('SELECT id, description, created_at FROM transactions WHERE account_id = 2 LIMIT 5').all();
console.log(all);

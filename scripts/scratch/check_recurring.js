import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const entries = db.prepare('SELECT r.id, r.description, a.name as account_name FROM recurring_entries r JOIN accounts a ON r.account_id = a.id').all();
console.log(entries);

import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const all = db.prepare('SELECT account_id, month, description, amount FROM transactions').all();
console.log(all.slice(0, 5));
console.log('Total:', all.length);

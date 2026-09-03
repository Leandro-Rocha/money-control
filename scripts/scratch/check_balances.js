import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const all = db.prepare('SELECT * FROM monthly_initial_balances').all();
console.log(all);

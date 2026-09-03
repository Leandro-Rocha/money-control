import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const all = db.prepare('SELECT amount FROM transactions WHERE account_id = 2').all();
const sum = all.reduce((acc, t) => acc + t.amount, 0);
console.log('Sum:', sum);

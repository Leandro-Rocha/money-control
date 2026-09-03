import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
console.log('Total Accounts:', db.prepare('SELECT COUNT(*) as c FROM accounts').get().c);
console.log('Total Transactions:', db.prepare('SELECT COUNT(*) as c FROM transactions').get().c);
console.log('Total Recurring:', db.prepare('SELECT COUNT(*) as c FROM recurring_entries').get().c);

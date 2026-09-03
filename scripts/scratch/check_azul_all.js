import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
console.log('Account 2 Transactions:', db.prepare('SELECT COUNT(*) as c FROM transactions WHERE account_id = 2').get().c);
console.log('Account 2 Recurring:', db.prepare('SELECT COUNT(*) as c FROM recurring_entries WHERE account_id = 2').get().c);
console.log('Account 2 Dismissals:', db.prepare('SELECT COUNT(*) as c FROM dismissed_projections WHERE account_id = 2').get().c);

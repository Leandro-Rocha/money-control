import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const res = db.prepare('DELETE FROM dismissed_projections WHERE account_id = 2').run();
console.log('Dismissals removidos:', res.changes);

import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const res = db.prepare('DELETE FROM recurring_entries').run();
console.log('Recorrentes removidos:', res.changes);

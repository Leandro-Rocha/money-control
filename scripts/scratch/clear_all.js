import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const t = db.prepare('DELETE FROM transactions').run();
const d = db.prepare('DELETE FROM dismissed_projections').run();
console.log('Transações:', t.changes, '| Dispensas:', d.changes);

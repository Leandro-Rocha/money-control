import Database from 'better-sqlite3';

const db = new Database('data/money_control.db');

const accounts = db.prepare('SELECT id, name FROM accounts WHERE name LIKE \'%azul%\' COLLATE NOCASE').all();
console.log('Contas encontradas:', accounts);

if (accounts.length > 0) {
  const accountId = accounts[0].id;
  const result = db.prepare('DELETE FROM transactions WHERE account_id = ?').run(accountId);
  console.log(`Transações deletadas para a conta ${accountId}: ${result.changes}`);
}

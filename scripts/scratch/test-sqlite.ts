import Database from "better-sqlite3";
const db = new Database(":memory:");
db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT,
    color TEXT
  );
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    account_id INTEGER,
    month TEXT,
    day INTEGER,
    description TEXT,
    category_id INTEGER,
    amount REAL,
    installment_current INTEGER,
    installment_total INTEGER
  );
  CREATE TABLE dismissed_projections (
    account_id INTEGER,
    month TEXT,
    source_type TEXT,
    source_id INTEGER
  );

  INSERT INTO categories VALUES (1, 'Food', 'red');
  INSERT INTO transactions VALUES (1, 1, '2024-03', 10, 'Pizza', 1, 10.0, 1, 3);
  INSERT INTO transactions VALUES (2, 1, '2024-04', 10, 'Pizza', 1, 10.0, 2, 3);
  INSERT INTO transactions VALUES (3, 1, '2023-12', 10, 'TV', NULL, 100.0, 4, 12);
  INSERT INTO transactions VALUES (4, 1, '2024-04', 10, 'Phone', NULL, 50.0, 1, 2);
  INSERT INTO dismissed_projections VALUES (1, '2024-05', 'installment', 4);
`);

const targetMonth = '2024-05';
const scanStart = '2022-05'; // -24 months
const scanEnd = '2024-04'; // -1 month

const query = `
  WITH base_installments AS (
    SELECT 
      t.*,
      c.name as category_name,
      c.color as category_color,
      strftime('%Y-%m', date(t.month || '-01', '-' || (t.installment_current - 1) || ' months')) as origin_month
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.month >= ?
      AND t.month <= ?
      AND t.installment_current IS NOT NULL
      AND t.installment_total IS NOT NULL
  ),
  deduped_installments AS (
    SELECT *,
           ROW_NUMBER() OVER (
             PARTITION BY account_id, trim(lower(description)), origin_month 
             ORDER BY installment_current DESC
           ) as rn
    FROM base_installments
  ),
  projected_installments AS (
    SELECT 
      d.*,
      1 + (strftime('%Y', ? || '-01') - strftime('%Y', origin_month || '-01')) * 12 + (strftime('%m', ? || '-01') - strftime('%m', origin_month || '-01')) as projected_current
    FROM deduped_installments d
    WHERE d.rn = 1
  )
  SELECT 
    -(p.id * 1000 + p.projected_current) as id,
    p.account_id as accountId,
    ? as month,
    p.day,
    p.description,
    p.category_id as categoryId,
    p.amount,
    NULL as installmentCurrent,
    NULL as installmentTotal,
    NULL as notes,
    p.category_name as categoryName,
    p.category_color as categoryColor,
    1 as isProjected,
    'installment' as projectionSourceType,
    p.id as projectionSourceId,
    p.projected_current as projectedInstallmentCurrent,
    p.installment_total as projectedInstallmentTotal
  FROM projected_installments p
  WHERE p.projected_current > p.installment_current
    AND p.projected_current <= p.installment_total
    AND NOT EXISTS (
      SELECT 1 FROM dismissed_projections dp
      WHERE dp.source_type = 'installment'
        AND dp.source_id = p.id
        AND dp.account_id = p.account_id
        AND dp.month = ?
    )
`;

const rows = db.prepare(query).all(scanStart, scanEnd, targetMonth, targetMonth, targetMonth, targetMonth);
console.log(rows);

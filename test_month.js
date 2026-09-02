const db = require('better-sqlite3')('data/money_control.db');

async function test() {
  const targetMonth = '2026-09';
  
  function parseMonth(m) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo };
  }
  function monthToOffset(m) {
    const { year, month } = parseMonth(m);
    return year * 12 + month;
  }
  function offsetToMonth(offset) {
    const year = Math.floor((offset - 1) / 12);
    const month = ((offset - 1) % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  function monthDiff(from, to) {
    return monthToOffset(to) - monthToOffset(from);
  }
  function addMonths(m, n) {
    return offsetToMonth(monthToOffset(m) + n);
  }

  const scanStart = addMonths(targetMonth, -24);
  const allInstallmentTx = db.prepare("SELECT account_id as accountId, month, description, installment_current as installmentCurrent, installment_total as installmentTotal FROM transactions WHERE month >= ? AND month <= ? AND installment_total IS NOT NULL").all(scanStart, addMonths(targetMonth, -1));
  
  const rawInstallments = allInstallmentTx;
  
  const dedupMap = new Map();
  for (const t of rawInstallments) {
    const originMonth = addMonths(t.month, -(t.installmentCurrent - 1));
    const key = `${t.accountId}-${t.description.trim().toLowerCase()}-${originMonth}`;
    const existing = dedupMap.get(key);
    if (!existing || t.installmentCurrent > existing.installmentCurrent) {
      dedupMap.set(key, t);
    }
  }
  const installmentTx = Array.from(dedupMap.values());
  
  let projected = [];
  for (const tx of installmentTx) {
    const originMonth = addMonths(tx.month, -(tx.installmentCurrent - 1));
    const offset = monthDiff(originMonth, targetMonth);
    const projectedCurrent = 1 + offset;

    if (projectedCurrent <= tx.installmentCurrent) {
      console.log(`Skipped ${tx.description} because ${projectedCurrent} <= ${tx.installmentCurrent}`);
      continue;
    }
    if (projectedCurrent > tx.installmentTotal) {
      console.log(`Skipped ${tx.description} because ${projectedCurrent} > ${tx.installmentTotal}`);
      continue;
    }
    projected.push({desc: tx.description, current: projectedCurrent});
  }
  console.log("Projected:", projected);
}
test();

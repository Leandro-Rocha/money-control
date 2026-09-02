function addMonths(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthDiff(m1, m2) {
  const [y1, mo1] = m1.split('-').map(Number);
  const [y2, mo2] = m2.split('-').map(Number);
  return (y2 - y1) * 12 + (mo2 - mo1);
}

const tx = { month: '2026-08', installmentCurrent: 2 };
const targetMonth = '2026-08';
const originMonth = addMonths(tx.month, -(tx.installmentCurrent - 1)); // 2026-07
const offset = monthDiff(originMonth, targetMonth); // 1
const projectedCurrent = tx.installmentCurrent + offset; // 2 + 1 = 3
console.log(originMonth, offset, projectedCurrent);

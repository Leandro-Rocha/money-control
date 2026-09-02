const fs = require('fs');
let content = fs.readFileSync('src/components/CreditCardColumn.tsx', 'utf8');

content = content.replace(/onClick=\{\(\) => !tx.isProjected && handleStartCellEdit\(tx, "description"\)\}/g, 'onClick={() => onCellClick("description")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "description"\)\}/g, 'onClick={() => onCellClick("description")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "installment"\)\}/g, 'onClick={() => onCellClick("installment")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "category"\)\}/g, 'onClick={() => onCellClick("category")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "amount"\)\}/g, 'onClick={() => onCellClick("amount")}');

fs.writeFileSync('src/components/CreditCardColumn.tsx', content);

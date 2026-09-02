const fs = require('fs');
let content = fs.readFileSync('src/components/CreditCardColumn.tsx', 'utf8');

// Replace isProjected assignment logic
content = content.replace(
  /const isProjected = tx\.isProjected;/g,
  `const isProjected = tx.isProjected;
                    const isInstallmentShadow = isProjected && tx.projectionSourceType === "installment";
                    const visuallyProjected = isProjected && !isInstallmentShadow;
                    const onCellClick = (field) => {
                      if (isInstallmentShadow) {
                        alert("Esta é uma parcela projetada automaticamente (sombra). Para alterá-la, edite a transação original.");
                        return;
                      }
                      if (!isProjected) handleStartCellEdit(tx, field);
                    };`
);

content = content.replace(/!isEditingDesc && !isProjected/g, '!isEditingDesc && !tx.isProjected');
content = content.replace(/!isEditingInst && !isProjected/g, '!isEditingInst && !tx.isProjected');
content = content.replace(/!isEditingCat && !isProjected/g, '!isEditingCat && !tx.isProjected');
content = content.replace(/!isEditingAmount && !isProjected/g, '!isEditingAmount && !tx.isProjected');

content = content.replace(/onClick=\{\(\) => !tx.isProjected && handleStartCellEdit\(tx, "description"\)\}/g, 'onClick={() => onCellClick("description")}');
content = content.replace(/onClick=\{\(\) => !tx.isProjected && handleStartCellEdit\(tx, "installment"\)\}/g, 'onClick={() => onCellClick("installment")}');
content = content.replace(/onClick=\{\(\) => !tx.isProjected && handleStartCellEdit\(tx, "category"\)\}/g, 'onClick={() => onCellClick("category")}');
content = content.replace(/onClick=\{\(\) => !tx.isProjected && handleStartCellEdit\(tx, "amount"\)\}/g, 'onClick={() => onCellClick("amount")}');

// Update visual stylings
content = content.replace(/isProjected\s*\?\s*"bg-slate-50\/70/g, 'visuallyProjected ? "bg-slate-50/70');
content = content.replace(/isProjected\n\s+\? "text-slate-500 italic"/g, 'visuallyProjected ? "text-slate-500 italic"');
content = content.replace(/isProjected\s*\?\s*"Projeção — confirme ou dispense"/g, 'visuallyProjected ? "Projeção — confirme ou dispense"');
content = content.replace(/isProjected\s*\?\s*"bg-blue-50\/60/g, 'visuallyProjected ? "bg-blue-50/60');
content = content.replace(/isProjected \? "Parcela projetada"/g, 'visuallyProjected ? "Parcela projetada"');
content = content.replace(/opacity: isProjected \? 0\.7 : 1/g, 'opacity: visuallyProjected ? 0.7 : 1');
content = content.replace(/cursor: isProjected \? "default" : "pointer"/g, 'cursor: tx.isProjected ? "default" : "pointer"');
content = content.replace(/isProjected \? 'border-amber-500\/50/g, 'visuallyProjected ? \'border-amber-500/50');
content = content.replace(/isProjected \? "Valor projetado"/g, 'visuallyProjected ? "Valor projetado"');

// Fix row action button Check
content = content.replace(/<DropdownMenuItem\n\s+onClick=\{\(\) => handleConfirmProjected\(tx\)\}/g, 
  `{!isInstallmentShadow && <DropdownMenuItem
                            onClick={() => handleConfirmProjected(tx)}`);
content = content.replace(/<Check className="w-4 h-4" \/> Confirmar projeção\n\s+<\/DropdownMenuItem>/g, 
  `<Check className="w-4 h-4" /> Confirmar projeção
                          </DropdownMenuItem>}`);

fs.writeFileSync('src/components/CreditCardColumn.tsx', content);

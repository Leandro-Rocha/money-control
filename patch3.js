const fs = require('fs');
let content = fs.readFileSync('src/components/BankAccountColumn.tsx', 'utf8');

content = content.replace(
  /const isProjected = tx\.isProjected === true;/g,
  `const isProjected = tx.isProjected === true;
                    const isInstallmentShadow = isProjected && tx.projectionSourceType === "installment";
                    const visuallyProjected = isProjected && !isInstallmentShadow;
                    const onCellClick = (field) => {
                      if (isInstallmentShadow) {
                        alert("Esta é uma parcela de um parcelamento (lançamento automático). Para alterá-la, volte ao mês original da compra e edite a transação principal.");
                        return;
                      }
                      if (!isProjected) handleStartCellEdit(tx, field);
                    };`
);

content = content.replace(/!isEditingDesc && !isProjected/g, '!isEditingDesc && !tx.isProjected');
content = content.replace(/!isEditingCat && !isProjected/g, '!isEditingCat && !tx.isProjected');
content = content.replace(/!isEditingAmount && !isProjected/g, '!isEditingAmount && !tx.isProjected');

content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "description"\)\}/g, 'onClick={() => onCellClick("description")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "category"\)\}/g, 'onClick={() => onCellClick("category")}');
content = content.replace(/onClick=\{\(\) => !isProjected && handleStartCellEdit\(tx, "amount"\)\}/g, 'onClick={() => onCellClick("amount")}');

// Update visual stylings
content = content.replace(/isProjected \? "bg-slate-50\/70/g, 'visuallyProjected ? "bg-slate-50/70');
content = content.replace(/isProjected\n\s+\? "text-slate-500 italic"/g, 'visuallyProjected ? "text-slate-500 italic"');
content = content.replace(/isProjected \? "Projeção — clique para confirmar com edição" : "Clique para editar"/g, 'visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar"');
content = content.replace(/isProjected \? "Projeção — clique para confirmar com edição" : "Clique para editar o valor"/g, 'visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar o valor"');
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

fs.writeFileSync('src/components/BankAccountColumn.tsx', content);

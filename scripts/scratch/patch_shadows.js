const fs = require('fs');
const files = ['src/components/CreditCardColumn.tsx', 'src/components/BankAccountColumn.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove alert
  content = content.replace(
    /if \(isInstallmentShadow\) \{\n\s+alert\("Esta é uma parcela de um parcelamento \(lançamento automático\)\. Para alterá-la, volte ao mês original da compra e edite a transação principal\."\);\n\s+return;\n\s+\}/g,
    'if (isInstallmentShadow) return;'
  );

  // Description styling
  content = content.replace(
    /visuallyProjected \? "text-slate-500 italic"\n\s+: "cursor-pointer text-slate-800"/g,
    'visuallyProjected ? "text-slate-500 italic"\n                                  : isInstallmentShadow ? "text-slate-500" : "cursor-pointer text-slate-800"'
  );
  content = content.replace(
    /title=\{visuallyProjected \? "Projeção — confirme ou dispense" : "Clique para editar"\}/g,
    'title={isInstallmentShadow ? "Lançamento automático (edite a original para alterar)" : visuallyProjected ? "Projeção — confirme ou dispense" : "Clique para editar"}'
  );
  content = content.replace(
    /title=\{visuallyProjected \? "Projeção — clique para confirmar com edição" : "Clique para editar"\}/g,
    'title={isInstallmentShadow ? "Lançamento automático (edite a original para alterar)" : visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar"}'
  );

  // Category styling
  content = content.replace(
    /cursor: tx\.isProjected \? "default" : "pointer"/g,
    'cursor: isProjected ? "default" : "pointer"'
  );
  
  // Amount styling
  // Wait, Amount uses isInstallmentShadow for hover styling already!
  // 'border-transparent text-foreground hover:bg-muted/50 cursor-pointer'
  content = content.replace(
    /isInstallmentShadow \? 'border-transparent text-foreground hover:bg-muted\/50 cursor-pointer'/g,
    'isInstallmentShadow ? \'border-transparent text-slate-500\''
  );
  content = content.replace(
    /title=\{isProjected && !isInstallmentShadow \? "Projeção — confirme ou dispense" : "Clique para editar"\}/g,
    'title={isInstallmentShadow ? "Lançamento automático" : visuallyProjected ? "Projeção — confirme ou dispense" : "Clique para editar"}'
  );
  content = content.replace(
    /title=\{isProjected && !isInstallmentShadow \? "Projeção — clique para confirmar com edição" : "Clique para editar o valor"\}/g,
    'title={isInstallmentShadow ? "Lançamento automático" : visuallyProjected ? "Projeção — clique para confirmar com edição" : "Clique para editar o valor"}'
  );

  fs.writeFileSync(file, content);
}

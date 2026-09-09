const fs = require('fs');
let content = fs.readFileSync('src/components/TransferAssistantModal.tsx', 'utf8');

// Imports
content = content.replace('import { ModalShell } from "./ModalShell";', 
  'import { ModalShell } from "./ModalShell";\nimport { EmptyState } from "./EmptyState";');

// Replace EmptyState
content = content.replace(/\) : candidates\.length === 0 \? \(\s*<div className="text-center py-12 px-4 bg-white border rounded-xl shadow-sm">\s*<div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">\s*<Check className="w-6 h-6" \/>\s*<\/div>\s*<h3 className="text-lg font-semibold text-slate-800">Tudo limpo!<\/h3>\s*<p className="text-slate-500 mt-1 max-w-sm mx-auto">\s*Não encontramos nenhuma transação órfã que pareça ser uma transferência neste mês\.\s*<\/p>\s*<\/div>\s*\) : \(/m,
`) : candidates.length === 0 ? (
        <EmptyState
          icon={Check}
          title="Tudo limpo!"
          description="Não encontramos nenhuma transação órfã que pareça ser uma transferência neste mês."
        />
      ) : (`);

// Button color classes
content = content.replace(/className="bg-blue-600 hover:bg-blue-700 text-white min-w-\[120px\]"/g, 'className="min-w-[120px]"');

// Color replacements
content = content.replace(/bg-white/g, 'bg-card');
content = content.replace(/bg-slate-100/g, 'bg-muted');
content = content.replace(/text-slate-800/g, 'text-foreground');
content = content.replace(/text-slate-700/g, 'text-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/text-slate-400/g, 'text-muted-foreground');
content = content.replace(/border-slate-300/g, 'border-border');

fs.writeFileSync('src/components/TransferAssistantModal.tsx', content);

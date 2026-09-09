const fs = require('fs');
let content = fs.readFileSync('src/components/PullProjectionsModal.tsx', 'utf8');

// Imports
content = content.replace('import { ModalShell } from "./ModalShell";', 
  'import { ModalShell } from "./ModalShell";\nimport { EmptyState } from "./EmptyState";');

// Replace EmptyState
content = content.replace(/\{projections\.length === 0 \? \(\s*<div className="border rounded-lg overflow-hidden bg-white shadow-sm p-12 text-center text-slate-500">\s*Nenhuma projeção pendente para este mês\. Tudo certo!\s*<\/div>\s*\) : \(/m,
`{projections.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Tudo certo!"
              description="Nenhuma projeção pendente para este mês."
            />
          ) : (`);

// Color replacements
content = content.replace(/bg-white/g, 'bg-card');
content = content.replace(/bg-slate-50/g, 'bg-muted/40');
content = content.replace(/bg-slate-100/g, 'bg-muted');
content = content.replace(/text-slate-800/g, 'text-foreground');
content = content.replace(/text-slate-700/g, 'text-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/border-slate-300/g, 'border-border');
content = content.replace(/divide-slate-100/g, 'divide-border');

fs.writeFileSync('src/components/PullProjectionsModal.tsx', content);

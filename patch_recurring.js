const fs = require('fs');
let content = fs.readFileSync('src/components/RecurringTab.tsx', 'utf8');

// Imports
content = content.replace('import { Button } from "@/components/ui/button";', 
  'import { Button } from "@/components/ui/button";\nimport { EmptyState } from "./EmptyState";\nimport { ConfirmDialog } from "@/components/ui/confirm-dialog";\nimport { Repeat } from "lucide-react";');

// State for confirm dialog
content = content.replace('const [editingId, setEditingId] = useState<number | null>(null);', 
  'const [editingId, setEditingId] = useState<number | null>(null);\n  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);');

// Replace handleDelete logic
content = content.replace(/const handleDelete = async \(id: number\) => \{\n    if \(confirm\("Remover esta despesa recorrente\?"\)\) \{\n      await deleteRecurringEntry\(id\);\n      onRefresh\(\);\n    \}\n  \};/m, 
`const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const onConfirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteRecurringEntry(deleteConfirmId);
      onRefresh();
    }
    setDeleteConfirmId(null);
  };`);

// Replace EmptyState
content = content.replace(/\{entries\.length === 0 && !isAdding && \(\s*<div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">\s*Nenhuma despesa recorrente cadastrada\.\s*<\/div>\s*\)\}/m,
`{entries.length === 0 && !isAdding && (
          <EmptyState
            icon={Repeat}
            title="Nenhuma despesa recorrente"
            description="Nenhuma despesa recorrente cadastrada."
          />
        )}`);

// Add ConfirmDialog just before the final </div>
const lastDivIndex = content.lastIndexOf('</div>');
const inject = `
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Remover Despesa"
        description="Remover esta despesa recorrente?"
        onConfirm={onConfirmDelete}
      />
`;
content = content.substring(0, lastDivIndex) + inject + content.substring(lastDivIndex);

// Color replacements
content = content.replace(/border-slate-300/g, 'border-border');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/bg-slate-100/g, 'bg-muted');

fs.writeFileSync('src/components/RecurringTab.tsx', content);

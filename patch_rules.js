const fs = require('fs');
let content = fs.readFileSync('src/components/RulesTab.tsx', 'utf8');

// Imports
content = content.replace('import { Button } from "@/components/ui/button";', 
  'import { Button } from "@/components/ui/button";\nimport { EmptyState } from "./EmptyState";\nimport { ConfirmDialog } from "@/components/ui/confirm-dialog";\nimport { Settings } from "lucide-react";');

// State for confirm dialog
content = content.replace('const [editingId, setEditingId] = useState<number | "new" | null>(null);', 
  'const [editingId, setEditingId] = useState<number | "new" | null>(null);\n  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);');

// Replace handleDelete logic
content = content.replace(/const handleDelete = async \(id: number\) => \{\n    if \(!confirm\("Tem certeza que deseja excluir esta regra\?"\)\) return;\n    setIsSubmitting\(true\);\n    await deleteTransactionRule\(id\);\n    await loadData\(\);\n    setIsSubmitting\(false\);\n  \};/m, 
`const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const onConfirmDelete = async () => {
    if (deleteConfirmId) {
      setIsSubmitting(true);
      await deleteTransactionRule(deleteConfirmId);
      await loadData();
      setIsSubmitting(false);
    }
    setDeleteConfirmId(null);
  };`);

// Replace EmptyState
content = content.replace(/\{rules\.length === 0 && editingId !== "new" && \(\s*<div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed">\s*Nenhuma regra cadastrada\.\s*<\/div>\s*\)\}/m,
`{rules.length === 0 && editingId !== "new" && (
          <EmptyState
            icon={Settings}
            title="Nenhuma regra"
            description="Nenhuma regra cadastrada."
          />
        )}`);

// Add ConfirmDialog just before the final </div>
const lastDivIndex = content.lastIndexOf('</div>');
const inject = `
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Excluir Regra"
        description="Tem certeza que deseja excluir esta regra?"
        onConfirm={onConfirmDelete}
      />
`;
content = content.substring(0, lastDivIndex) + inject + content.substring(lastDivIndex);

// Color replacements
content = content.replace(/bg-slate-50/g, 'bg-muted/40');
content = content.replace(/text-slate-800/g, 'text-foreground');
content = content.replace(/text-slate-700/g, 'text-foreground');
content = content.replace(/text-slate-600/g, 'text-muted-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/text-slate-400/g, 'text-muted-foreground');
content = content.replace(/border-slate-200/g, 'border-border');
content = content.replace(/bg-slate-100/g, 'bg-muted');

// Button color classes
content = content.replace(/className="bg-indigo-600 hover:bg-indigo-700"/g, '');
content = content.replace(/className=\{duplicateRule \? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"\}/g, 'className={duplicateRule ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}');

fs.writeFileSync('src/components/RulesTab.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/CategoriesTab.tsx', 'utf8');

// Imports
content = content.replace('import { Button } from "@/components/ui/button";', 
  'import { Button } from "@/components/ui/button";\nimport { EmptyState } from "./EmptyState";\nimport { ConfirmDialog } from "@/components/ui/confirm-dialog";');

// State for confirm dialog
content = content.replace('const [editingId, setEditingId] = useState<number | null>(null);', 
  'const [editingId, setEditingId] = useState<number | null>(null);\n  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, cat: Category | null, msg: string}>({ isOpen: false, cat: null, msg: "" });');

// Replace handleDelete logic
content = content.replace(/const handleDelete = async \([^]*?onRefresh\(\);\n    \}\n  \};/m, 
`const handleDelete = async (cat: Category) => {
    const isParent = !cat.parentId;
    const hasChildren = (subcategoriesByParent.get(cat.id)?.length ?? 0) > 0;
    const msg = isParent && hasChildren
      ? \`A categoria "\${cat.name}" possui subcategorias. Excluir o pai também removerá todas as suas subcategorias. Continuar?\`
      : \`Tem certeza que deseja excluir "\${cat.name}"?\`;

    setDeleteConfirm({ isOpen: true, cat, msg });
  };

  const onConfirmDelete = async () => {
    if (deleteConfirm.cat) {
      await deleteCategory(deleteConfirm.cat.id);
      onRefresh();
    }
    setDeleteConfirm({ isOpen: false, cat: null, msg: "" });
  };`);

// Replace EmptyState
content = content.replace(/\{parentCategories\.length === 0 && \(\s*<div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">\s*Nenhuma categoria cadastrada\. Clique em "Nova Categoria Pai" para começar\.\s*<\/div>\s*\)\}/m,
`{parentCategories.length === 0 && (
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria"
            description="Nenhuma categoria cadastrada. Clique em 'Nova Categoria Pai' para começar."
          />
        )}`);

// Color replacements
content = content.replace(/bg-slate-50\/75/g, 'bg-muted/75');
content = content.replace(/hover:bg-slate-50\/50/g, 'hover:bg-muted/50');
content = content.replace(/bg-slate-50\/50/g, 'bg-muted/50');
content = content.replace(/bg-slate-50/g, 'bg-muted/40');
content = content.replace(/text-slate-800/g, 'text-foreground');
content = content.replace(/text-slate-700/g, 'text-foreground');
content = content.replace(/text-slate-600/g, 'text-muted-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/text-slate-400/g, 'text-muted-foreground');
content = content.replace(/text-slate-300/g, 'text-muted-foreground/50');
content = content.replace(/border-slate-300/g, 'border-border');
content = content.replace(/border-slate-200/g, 'border-border');
content = content.replace(/border-slate-100/g, 'border-border');
content = content.replace(/divide-slate-100/g, 'divide-border');
content = content.replace(/bg-slate-100\/50/g, 'bg-muted/50');
content = content.replace(/bg-slate-100/g, 'bg-muted');

// Add ConfirmDialog just before the final </div>
const lastDivIndex = content.lastIndexOf('</div>');
const inject = `
      <ConfirmDialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, isOpen: open }))}
        title="Excluir Categoria"
        description={deleteConfirm.msg}
        onConfirm={onConfirmDelete}
      />
`;
content = content.substring(0, lastDivIndex) + inject + content.substring(lastDivIndex);

fs.writeFileSync('src/components/CategoriesTab.tsx', content);

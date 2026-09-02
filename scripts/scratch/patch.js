const fs = require('fs');

const path = 'src/components/BankAccountColumn.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add contextMenu state and useEffect
content = content.replace(
  'const [transferTxId, setTransferTxId] = useState<number | null>(null);',
  'const [transferTxId, setTransferTxId] = useState<number | null>(null);\n  const [contextMenu, setContextMenu] = useState<{ tx: TransactionWithCategory, x: number, y: number } | null>(null);\n\n  import("react").then(r => r.useEffect(() => {\n    const handleGlobalClick = () => setContextMenu(null);\n    window.addEventListener("click", handleGlobalClick);\n    return () => window.removeEventListener("click", handleGlobalClick);\n  }, []));\n'
);

// 2. Remove the empty TableHead for actions
content = content.replace(
  '<TableHead className="  w-8 text-center"></TableHead>',
  ''
);

// 3. Remove the empty TableCell for actions in Saldo anterior row
content = content.replace(
  '<TableCell className="text-center"></TableCell>',
  ''
);

// 4. Update TableRow for transactions to include onContextMenu
content = content.replace(
  /<TableRow\s+key=\{tx\.id\}\s+className=\{`group h-9 \$\{tx\.isProjected \? "bg-slate-50\/50" : ""\}`\}>/,
  `<TableRow
                        key={tx.id}
                        className={\`group h-9 \${tx.isProjected ? "bg-slate-50/50" : ""}\`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ tx, x: e.clientX, y: e.clientY });
                        }}
                      >`
);

// 5. Replace the whole Actions TableCell with nothing (it's between {/* Actions */} and </TableRow>)
content = content.replace(
  /\{\/\*\s*Actions\s*\*\/\}\s*<TableCell[\s\S]*?<\/TableCell>\s*(?=<\/TableRow>)/g,
  ''
);

// 6. Update Quick Add colSpan
content = content.replace(
  /<TableCell colSpan=\{2\} className="text-left pl-6">/,
  '<TableCell className="text-right pl-6">'
);

// 7. Render Context Menu at the end of the component
content = content.replace(
  '</Card>',
  `  {contextMenu && (
        <div 
          className="fixed z-50 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.tx.isProjected ? (
            <>
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-green-600"
                onClick={() => handleConfirmProjected(contextMenu.tx)}
              >
                <Check className="w-4 h-4" /> Confirmar projeção
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-slate-600"
                onClick={() => handleDismissProjected(contextMenu.tx)}
              >
                <X className="w-4 h-4" /> Dispensar este mês
              </button>
            </>
          ) : (
            <>
              {!contextMenu.tx.linkedTransactionId && (
                <button 
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-blue-600"
                  onClick={() => setTransferTxId(contextMenu.tx.id)}
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transformar em Transferência
                </button>
              )}
              <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 text-rose-600"
                onClick={() => handleDelete(contextMenu.tx.id, !!contextMenu.tx.linkedTransactionId)}
              >
                <Trash2 className="w-4 h-4" /> Excluir lançamento
              </button>
            </>
          )}
        </div>
      )}
      
      {transferTxId && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white p-5 rounded-xl shadow-2xl w-80 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h4 className="text-lg font-semibold text-slate-800">Transferência</h4>
            <p className="text-sm text-slate-500">Selecione a conta destino para criar a transação correspondente.</p>
            <select
              className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={transferTargetId || ""}
              onChange={(e) => setTransferTargetId(Number(e.target.value))}
            >
              <option value="">Selecione a conta...</option>
              {allAccounts.filter(a => a.id !== data.account.id).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end mt-2">
              <Button variant="ghost" onClick={() => { setTransferTxId(null); setTransferTargetId(null); }}>Cancelar</Button>
              <Button onClick={handleTransfer} disabled={!transferTargetId}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </Card>`
);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched!");

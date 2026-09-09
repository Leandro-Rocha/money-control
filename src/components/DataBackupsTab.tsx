"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileJson,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalShell } from "@/components/ModalShell";

interface ServerBackup {
  fileName: string;
  relativePath: string;
  sourceType: "daily" | "monthly" | "root";
  format: "sqlite" | "json";
  date: string;
  sizeBytes: number;
  lastModified: string;
}

interface RestoreResponse {
  success: boolean;
  type?: "sqlite" | "json";
  recordsRestored?: Record<string, number>;
  backupCreated?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DataBackupsTab() {
  const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedServerBackup, setSelectedServerBackup] = useState<ServerBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResponse | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadServerBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const res = await fetch("/api/backup/list");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error("Falha ao carregar lista de backups:", e);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadServerBackups();
  }, []);

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".db") && !lower.endsWith(".json")) {
      alert("Por favor, selecione um arquivo válido com extensão .db ou .json.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setSelectedServerBackup(null);
    setRestoreError(null);
    setConfirmModalOpen(true);
  };

  const handleSelectServerBackup = (backup: ServerBackup) => {
    setSelectedServerBackup(backup);
    setSelectedFile(null);
    setRestoreError(null);
    setConfirmModalOpen(true);
  };

  const executeRestore = async () => {
    setIsRestoring(true);
    setRestoreError(null);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        res = await fetch("/api/backup/restore", {
          method: "POST",
          body: formData,
        });
      } else if (selectedServerBackup) {
        res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupPath: selectedServerBackup.relativePath }),
        });
      } else {
        return;
      }

      const data: RestoreResponse = await res.json();

      if (!res.ok || !data.success) {
        setRestoreError(data.error || "Ocorreu um erro ao restaurar o backup.");
        return;
      }

      setRestoreResult(data);
      setConfirmModalOpen(false);
      setSuccessModalOpen(true);
      loadServerBackups();
    } catch (err: any) {
      setRestoreError(err?.message || "Falha na comunicação com o servidor.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-card border rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Gestão de Backups & Restauração</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exporte, baixe ou restaure backups com segurança diretamente pela interface.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadServerBackups}
            disabled={isLoadingBackups}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Atualizar lista de backups"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBackups ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Ações de Download e Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Download SQLite */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full justify-start gap-2 h-auto py-2.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
          >
            <a href="/api/backup" download>
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-semibold">Baixar Banco (.db)</div>
                <div className="text-[10px] text-muted-foreground font-normal">Snapshot nativo SQLite</div>
              </div>
            </a>
          </Button>

          {/* Download JSON */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full justify-start gap-2 h-auto py-2.5 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
          >
            <a href="/api/backup?format=json" download>
              <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-semibold">Baixar Dump (.json)</div>
                <div className="text-[10px] text-muted-foreground font-normal">Texto legível e versionado</div>
              </div>
            </a>
          </Button>
        </div>

        {/* Upload de Arquivo do Computador */}
        <div className="pt-2 border-t border-border/60">
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.json"
            className="hidden"
            onChange={handleSelectFile}
          />
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-dashed border-border">
            <div>
              <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-primary" />
                Restaurar a partir de arquivo local
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Selecione um arquivo <code className="font-mono text-foreground">.db</code> ou <code className="font-mono text-foreground">.json</code> do seu dispositivo.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 gap-1.5 text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Carregar Arquivo
            </Button>
          </div>
        </div>

        {/* Snapshots Armazenados no Servidor */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Backups Disponíveis no Servidor</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {backups.length} arquivo{backups.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isLoadingBackups && (
            <div className="p-4 text-center text-xs text-muted-foreground">Carregando lista de backups...</div>
          )}

          {!isLoadingBackups && backups.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
              Nenhum backup encontrado na pasta de dados do container ainda.
            </div>
          )}

          {!isLoadingBackups && backups.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {backups.map((b) => (
                <div
                  key={b.relativePath}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                      {b.format === "sqlite" ? (
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileJson className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        <span>{b.fileName}</span>
                        <Badge
                          variant={b.sourceType === "monthly" ? "default" : "secondary"}
                          className="text-[9px] px-1.5 py-0 h-4 font-normal"
                        >
                          {b.sourceType === "monthly" ? "Mensal" : "Diário"}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {b.date}
                        </span>
                        <span>•</span>
                        <span>{formatBytes(b.sizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectServerBackup(b)}
                    className="h-7 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-1 shrink-0 ml-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE RESTAURAÇÃO */}
      <ModalShell
        open={confirmModalOpen}
        onClose={() => !isRestoring && setConfirmModalOpen(false)}
        maxWidth="max-w-md"
        title="Confirmar Restauração de Dados"
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        titleColor="text-amber-700 dark:text-amber-400"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isRestoring}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={executeRestore}
              disabled={isRestoring}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Restaurando...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Confirmar e Restaurar
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs">
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Atenção: Substituição de Dados Ativos
            </div>
            <p className="leading-relaxed">
              Todos os lançamentos, contas e categorias atuais serão substituídos pelo conteúdo do backup selecionado.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Arquivo a ser restaurado:
            </div>
            <div className="font-mono text-xs text-foreground break-all">
              {selectedFile ? selectedFile.name : selectedServerBackup?.fileName}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Tamanho:{" "}
              {selectedFile
                ? formatBytes(selectedFile.size)
                : selectedServerBackup
                ? formatBytes(selectedServerBackup.sizeBytes)
                : "—"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Segurança Automática:</span>
              <p className="leading-relaxed">
                Antes de iniciar a substituição, uma cópia de segurança do seu banco atual será salva automaticamente no servidor com extensão <code className="font-mono text-[11px]">.pre-restore.bak</code>.
              </p>
            </div>
          </div>

          {restoreError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-medium">
              {restoreError}
            </div>
          )}
        </div>
      </ModalShell>

      {/* MODAL DE SUCESSO NA RESTAURAÇÃO */}
      <ModalShell
        open={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          window.location.reload();
        }}
        maxWidth="max-w-md"
        title="Restauração Concluída com Sucesso"
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        titleColor="text-emerald-700 dark:text-emerald-400"
        footer={
          <div className="flex items-center justify-end w-full">
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            O banco de dados da aplicação foi restaurado e sincronizado com sucesso. Recarregue a página para atualizar todos os dados em tela.
          </p>

          {restoreResult?.backupCreated && (
            <div className="p-3 rounded-lg bg-muted/50 border text-[11px] text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground">Backup preventivo criado:</span>
              <p className="font-mono break-all">{restoreResult.backupCreated}</p>
            </div>
          )}

          {restoreResult?.recordsRestored && Object.keys(restoreResult.recordsRestored).length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-foreground">Resumo dos dados importados:</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(restoreResult.recordsRestored).map(([table, count]) => (
                  <div key={table} className="p-2 rounded-lg bg-muted/40 border flex justify-between">
                    <span className="text-muted-foreground capitalize">{table.replace(/_/g, " ")}:</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}

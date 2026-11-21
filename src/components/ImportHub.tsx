import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { ERPRow, ParsedFileResult, PhysicalRow } from '../types/audit';
import {
  downloadLayoutTemplates,
  parseERPFile,
  parsePhysicalFile,
} from '../utils/fileParser';
import { formatFileSize, formatNumber } from '../utils/formatters';

interface ImportHubProps {
  erpData: ParsedFileResult<ERPRow> | null;
  physicalData: ParsedFileResult<PhysicalRow> | null;
  onErpLoaded: (data: ParsedFileResult<ERPRow> | null) => void;
  onPhysicalLoaded: (data: ParsedFileResult<PhysicalRow> | null) => void;
  onExecuteAudit: () => void;
}

interface DropzoneCardProps<T> {
  title: string;
  subtitle: string;
  accent: 'indigo' | 'cyan';
  icon: React.ReactNode;
  expectedColumns: { name: string; optional?: boolean }[];
  parsedData: ParsedFileResult<T> | null;
  error: string | null;
  isParsing: boolean;
  inputId: string;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

function DropzoneCard<T>({
  title,
  subtitle,
  accent,
  icon,
  expectedColumns,
  parsedData,
  error,
  isParsing,
  inputId,
  onFileSelected,
  onClear,
}: DropzoneCardProps<T>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isIndigo = accent === 'indigo';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = '';
  };

  const triggerFilePicker = () => {
    inputRef.current?.click();
  };

  return (
    <div className="card-elevated card-elevated-hover flex flex-col justify-between rounded-2xl p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isIndigo ? 'bg-indigo-50 text-[#4F46E5]' : 'bg-cyan-50 text-[#0891B2]'
              }`}
            >
              {icon}
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              parsedData
                ? 'bg-[#ECFDF5] text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {parsedData ? 'Carregado' : 'Aguardando'}
          </span>
        </div>

        {/* Colunas esperadas */}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Colunas esperadas (.csv ou .xlsx)
          </p>
          <div className="flex min-h-[52px] flex-wrap content-start gap-1.5">
            {expectedColumns.map((col) => (
              <span
                key={col.name}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  col.optional
                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                    : isIndigo
                      ? 'border-indigo-100 bg-indigo-50/70 text-indigo-700'
                      : 'border-cyan-100 bg-cyan-50/70 text-cyan-800'
                }`}
              >
                <span>{col.name}</span>
                {col.optional && <span className="text-[10px] text-slate-400">(opcional)</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Área de Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!parsedData ? triggerFilePicker : undefined}
          role={!parsedData ? 'button' : undefined}
          tabIndex={!parsedData ? 0 : undefined}
          onKeyDown={
            !parsedData
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerFilePicker();
                  }
                }
              : undefined
          }
          className={`mt-5 rounded-xl border-2 border-dashed p-6 transition ${
            parsedData
              ? 'border-emerald-200 bg-[#ECFDF5]/60'
              : isDragging
                ? isIndigo
                  ? 'border-[#4F46E5] bg-indigo-50/70'
                  : 'border-[#06B6D4] bg-cyan-50/70'
                : error
                  ? 'border-rose-300 bg-[#FFF1F2]/60 cursor-pointer hover:border-rose-400'
                  : isIndigo
                    ? 'border-slate-200 bg-slate-50/60 cursor-pointer hover:border-[#4F46E5]/60 hover:bg-indigo-50/30'
                    : 'border-slate-200 bg-slate-50/60 cursor-pointer hover:border-[#06B6D4]/70 hover:bg-cyan-50/30'
          }`}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleInputChange}
            className="sr-only"
          />

          {isParsing ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#4F46E5]" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Lendo planilha...</p>
              <p className="text-xs text-slate-500">Validando colunas e formatos numéricos</p>
            </div>
          ) : parsedData ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#10B981] shadow-xs ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {parsedData.fileName}
                    </p>
                    <p className="tabular-nums text-xs font-medium text-emerald-700">
                      {formatNumber(parsedData.rows.length)} linhas lidas •{' '}
                      {formatFileSize(parsedData.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={triggerFilePicker}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-[#4F46E5] cursor-pointer"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={onClear}
                    aria-label={`Remover ${parsedData.fileName}`}
                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-500 transition hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {parsedData.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-[#FFF7ED] px-3 py-2 text-[11px] text-amber-800">
                  {parsedData.warnings.map((warn, i) => (
                    <p key={i}>{warn}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  isDragging
                    ? isIndigo
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#06B6D4] text-white'
                    : 'bg-white text-slate-500 shadow-xs ring-1 ring-slate-200'
                }`}
              >
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Arraste sua planilha aqui ou{' '}
                <span className={isIndigo ? 'text-[#4F46E5]' : 'text-[#0891B2]'}>
                  clique para selecionar
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Suporta arquivos <span className="font-medium">.CSV</span> (vírgula ou ponto e
                vírgula) e <span className="font-medium">.XLSX</span>
              </p>
            </div>
          )}
        </div>

        {/* Erro amigável */}
        {error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-[#FFF1F2] p-3 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F43F5E]" />
            <div>
              <p className="font-semibold">Não foi possível importar este arquivo</p>
              <p className="mt-0.5 leading-relaxed text-rose-600">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportHub({
  erpData,
  physicalData,
  onErpLoaded,
  onPhysicalLoaded,
  onExecuteAudit,
}: ImportHubProps) {
  const [erpError, setErpError] = useState<string | null>(null);
  const [physicalError, setPhysicalError] = useState<string | null>(null);
  const [isParsingErp, setIsParsingErp] = useState(false);
  const [isParsingPhysical, setIsParsingPhysical] = useState(false);
  const [templateNotice, setTemplateNotice] = useState(false);

  const handleErpFile = async (file: File) => {
    setErpError(null);
    setIsParsingErp(true);
    try {
      const result = await parseERPFile(file);
      onErpLoaded(result);
    } catch (err) {
      onErpLoaded(null);
      setErpError(err instanceof Error ? err.message : 'Erro desconhecido ao ler planilha ERP.');
    } finally {
      setIsParsingErp(false);
    }
  };

  const handlePhysicalFile = async (file: File) => {
    setPhysicalError(null);
    setIsParsingPhysical(true);
    try {
      const result = await parsePhysicalFile(file);
      onPhysicalLoaded(result);
    } catch (err) {
      onPhysicalLoaded(null);
      setPhysicalError(
        err instanceof Error ? err.message : 'Erro desconhecido ao ler contagem física.'
      );
    } finally {
      setIsParsingPhysical(false);
    }
  };

  const handleDownloadTemplates = () => {
    downloadLayoutTemplates();
    setTemplateNotice(true);
    window.setTimeout(() => setTemplateNotice(false), 4500);
  };

  const canExecute = Boolean(erpData && physicalData && !isParsingErp && !isParsingPhysical);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* Cabeçalho do Hub */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-[#4F46E5]">
          <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
          Hub de Conciliação Contábil × Inventário Físico
        </span>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Audite seu estoque com precisão executiva e{' '}
          <span className="bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] bg-clip-text text-transparent">
            diagnóstico de causa raiz por IA
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Importe a posição contábil do seu ERP/SAP e a planilha da contagem física. O StockGuard AI
          calcula acuracidade, impacto financeiro, Curva ABC e gera seu relatório PDF pronto para
          assinatura gerencial.
        </p>
      </div>

      {/* Duas áreas grandes de Drag & Drop lado a lado */}
      <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DropzoneCard
          title="1. Base Contábil (ERP / SAP)"
          subtitle="Posição de estoque contábil e custo unitário por SKU"
          accent="indigo"
          icon={<Database className="h-5 w-5" />}
          expectedColumns={[
            { name: 'SKU' },
            { name: 'Descricao' },
            { name: 'Categoria' },
            { name: 'Custo_Unitario' },
            { name: 'Saldo_ERP' },
            { name: 'Ultima_Movimentacao_SAP', optional: true },
          ]}
          parsedData={erpData}
          error={erpError}
          isParsing={isParsingErp}
          inputId="upload-erp-input"
          onFileSelected={handleErpFile}
          onClear={() => {
            onErpLoaded(null);
            setErpError(null);
          }}
        />

        <DropzoneCard
          title="2. Contagem Física (Inventário)"
          subtitle="Quantidades apuradas no galpão ou loja por endereço"
          accent="cyan"
          icon={<ClipboardCheck className="h-5 w-5" />}
          expectedColumns={[
            { name: 'SKU' },
            { name: 'Qtd_Contada' },
            { name: 'Localizacao' },
            { name: 'Responsavel_Contagem' },
            { name: 'Observacao', optional: true },
          ]}
          parsedData={physicalData}
          error={physicalError}
          isParsing={isParsingPhysical}
          inputId="upload-physical-input"
          onFileSelected={handlePhysicalFile}
          onClear={() => {
            onPhysicalLoaded(null);
            setPhysicalError(null);
          }}
        />
      </div>

      {/* Ação principal + link discreto de download dos modelos */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          disabled={!canExecute}
          onClick={onExecuteAudit}
          className={`inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-bold transition ${
            canExecute
              ? 'bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] text-white shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 cursor-pointer'
              : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Executar Auditoria Inteligente</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadTemplates}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-[#4F46E5] hover:decoration-[#4F46E5] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar modelo de layout (.csv)</span>
          </button>

          {templateNotice && (
            <p className="animate-fade-in-up text-[11px] font-medium text-emerald-700">
              Modelos <span className="font-semibold">modelo_erp_sap.csv</span> e{' '}
              <span className="font-semibold">modelo_contagem_fisica.csv</span> gerados com os
              cabeçalhos padrão.
            </p>
          )}
        </div>
      </div>

      {/* Três pilares do processo */}
      <div className="mt-12 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-8 md:grid-cols-3">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5]">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Conciliação 100% Real</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Agrega múltiplas contagens por endereço e detecta automaticamente SKUs ausentes no
              físico ou sem saldo no ERP.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-[#0891B2]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Curva ABC &amp; Pareto Financeiro</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Classifica o estoque em A (80%), B (15%) e C (5%), destacando imediatamente os furos
              críticos de maior impacto em R$.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F3FF] text-[#8B5CF6]">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Copiloto IA &amp; PDF Gerencial</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Diagnóstico de movimentos SAP e plano de ação em 3 passos com exportação PDF pronta
              para assinatura da Controladoria.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

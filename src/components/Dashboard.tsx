import { useState } from 'react';
import { CalendarClock, FileDown, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type { AIDiagnostic, AuditResult, ReconciledItem } from '../types/audit';
import { exportReconciliationCSV } from '../utils/csvExporter';
import { formatDateTimeBR, formatNumber } from '../utils/formatters';
import { exportExecutivePDF } from '../utils/pdfExporter';
import { AuditTable } from './AuditTable';
import { ChartsSection } from './ChartsSection';
import { KpiCards } from './KpiCards';

interface DashboardProps {
  audit: AuditResult;
  diagnosticsBySku: Record<string, AIDiagnostic>;
  onSelectItem: (item: ReconciledItem) => void;
}

export function Dashboard({ audit, diagnosticsBySku, onSelectItem }: DashboardProps) {
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const handleExportPDF = () => {
    exportExecutivePDF(audit, diagnosticsBySku);
    setExportMessage(`Relatório PDF ${audit.reportCode} gerado com sucesso.`);
    window.setTimeout(() => setExportMessage(null), 4000);
  };

  const handleExportCSV = () => {
    exportReconciliationCSV(audit, diagnosticsBySku);
    setExportMessage(`Planilha de conciliação ${audit.reportCode}.csv exportada.`);
    window.setTimeout(() => setExportMessage(null), 4000);
  };

  const reviewedCount = Object.keys(diagnosticsBySku).length;

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* Barra Executiva Superior */}
      <section className="card-elevated flex flex-col justify-between gap-4 rounded-2xl p-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-[#4F46E5]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Auditoria {audit.reportCode}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDateTimeBR(audit.generatedAt)}
            </span>
            {reviewedCount > 0 && (
              <span className="rounded-full bg-[#F5F3FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#7C3AED]">
                {reviewedCount} parecer(es) de IA gerados
              </span>
            )}
          </div>
          <h1 className="font-display mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Dashboard Executivo de Auditoria &amp; Divergências
          </h1>
          <p className="tabular-nums mt-0.5 text-xs text-slate-500">
            Conciliação concluída para{' '}
            <span className="font-semibold text-slate-700">
              {formatNumber(audit.kpis.totalSKUs)} SKUs
            </span>{' '}
            ({audit.erpFileName} × {audit.physicalFileName})
          </p>
        </div>

        {/* Botões de Exportação */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-indigo-200 hover:bg-slate-50 hover:text-[#4F46E5] cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#0891B2]" />
            <span>Exportar Conciliação (.CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            <span>Exportar Relatório de Auditoria (PDF)</span>
          </button>
        </div>
      </section>

      {exportMessage && (
        <div className="animate-fade-in-up rounded-xl border border-emerald-200 bg-[#ECFDF5] px-4 py-2.5 text-xs font-semibold text-emerald-800">
          {exportMessage}
        </div>
      )}

      {/* 4 Cards de KPIs */}
      <KpiCards kpis={audit.kpis} />

      {/* Visualizações Interativas (Pareto + Curva ABC + Medidor de Saúde) */}
      <ChartsSection
        topDivergences={audit.topDivergences}
        abcDistribution={audit.abcDistribution}
        kpis={audit.kpis}
        onSelectItem={onSelectItem}
      />

      {/* Tabela Inteligente de Auditoria */}
      <AuditTable
        items={audit.items}
        diagnosticsBySku={diagnosticsBySku}
        onAnalyzeItem={onSelectItem}
      />
    </main>
  );
}

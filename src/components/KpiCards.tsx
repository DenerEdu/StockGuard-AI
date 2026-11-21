import { AlertTriangle, CheckCircle2, Layers, TrendingDown, TrendingUp } from 'lucide-react';
import type { AuditKPIs } from '../types/audit';
import { formatBRL, formatNumber, formatPercent } from '../utils/formatters';

interface KpiCardsProps {
  kpis: AuditKPIs;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const accuracyBarColor =
    kpis.saudeNivel === 'Excelente'
      ? 'bg-[#10B981]'
      : kpis.saudeNivel === 'Atenção'
        ? 'bg-[#F97316]'
        : 'bg-[#F43F5E]';

  const accuracyBadgeStyle =
    kpis.saudeNivel === 'Excelente'
      ? 'bg-[#ECFDF5] text-[#10B981]'
      : kpis.saudeNivel === 'Atenção'
        ? 'bg-[#FFF7ED] text-[#F97316]'
        : 'bg-[#FFF1F2] text-[#F43F5E]';

  const isNegativeImpact = kpis.impactoFinanceiroLiquido < 0;
  const isPositiveImpact = kpis.impactoFinanceiroLiquido > 0;

  return (
    <section
      aria-label="Indicadores Chave da Auditoria"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* Card 1: Acuracidade Geral (%) */}
      <div className="card-elevated card-elevated-hover rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Acuracidade Geral
            </p>
            <p className="font-display tabular-nums mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {formatPercent(kpis.acuracidadeGeral, 1)}
            </p>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accuracyBadgeStyle}`}
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${accuracyBarColor}`}
              style={{ width: `${Math.min(100, Math.max(0, kpis.acuracidadeGeral))}%` }}
            />
          </div>
          <p className="tabular-nums mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{formatNumber(kpis.itensAcurados)}</span>{' '}
            de <span className="font-semibold text-slate-700">{formatNumber(kpis.totalSKUs)}</span>{' '}
            SKUs sem divergência
          </p>
        </div>
      </div>

      {/* Card 2: Impacto Financeiro Líquido (R$) */}
      <div className="card-elevated card-elevated-hover rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Impacto Financeiro Líquido
            </p>
            <p
              className={`font-display tabular-nums mt-2 truncate text-2xl font-extrabold sm:text-3xl ${
                isNegativeImpact
                  ? 'text-[#F43F5E]'
                  : isPositiveImpact
                    ? 'text-[#10B981]'
                    : 'text-slate-900'
              }`}
            >
              {formatBRL(kpis.impactoFinanceiroLiquido, true)}
            </p>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isNegativeImpact
                ? 'bg-[#FFF1F2] text-[#F43F5E]'
                : 'bg-[#ECFDF5] text-[#10B981]'
            }`}
          >
            {isNegativeImpact ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </div>
        </div>

        <div className="tabular-nums mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF1F2] px-2 py-0.5 font-semibold text-[#F43F5E]">
            Quebras: {formatBRL(kpis.totalQuebrasFinanceiro)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 font-semibold text-[#10B981]">
            Sobras: {formatBRL(kpis.totalSobrasFinanceiro, true)}
          </span>
        </div>
      </div>

      {/* Card 3: Itens com Divergência Crítica */}
      <div className="card-elevated card-elevated-hover rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Divergência Crítica
            </p>
            <p
              className={`font-display tabular-nums mt-2 text-2xl font-extrabold sm:text-3xl ${
                kpis.itensCriticos > 0 ? 'text-[#F97316]' : 'text-[#10B981]'
              }`}
            >
              {formatNumber(kpis.itensCriticos)}
            </p>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              kpis.itensCriticos > 0
                ? 'bg-[#FFF7ED] text-[#F97316]'
                : 'bg-[#ECFDF5] text-[#10B981]'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <p className="tabular-nums mt-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Curva A com furo</span> •{' '}
          {formatNumber(kpis.itensQuebra + kpis.itensSobra)} divergências totais
        </p>
      </div>

      {/* Card 4: Valor Total Auditado (R$) */}
      <div className="card-elevated card-elevated-hover rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valor Total Auditado
            </p>
            <p className="font-display tabular-nums mt-2 truncate text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {formatBRL(kpis.valorTotalAuditado)}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <p className="tabular-nums mt-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{formatNumber(kpis.totalSKUs)} SKUs</span>{' '}
          • {formatNumber(kpis.totalUnidadesERP)} un. no ERP
        </p>
      </div>
    </section>
  );
}

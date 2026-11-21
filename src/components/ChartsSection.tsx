import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Gauge, PieChart as PieChartIcon, TrendingDown } from 'lucide-react';
import type { ABCDistribution, AuditKPIs, ReconciledItem } from '../types/audit';
import { formatBRL, formatPercent, formatSignedNumber } from '../utils/formatters';

interface ChartsSectionProps {
  topDivergences: ReconciledItem[];
  abcDistribution: ABCDistribution;
  kpis: AuditKPIs;
  onSelectItem: (item: ReconciledItem) => void;
}

const ABC_COLORS: Record<'A' | 'B' | 'C', string> = {
  A: '#4F46E5',
  B: '#06B6D4',
  C: '#8B5CF6',
};

interface ParetoTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      sku: string;
      descricao: string;
      curvaABC: string;
      divergenciaQtd: number;
      impactoFinanceiro: number;
      impactoAbsoluto: number;
    };
  }>;
}

function ParetoTooltip({ active, payload }: ParetoTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const isFalta = d.impactoFinanceiro < 0;

  return (
    <div className="max-w-xs rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900">{d.sku}</span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-[#4F46E5]">
          Curva {d.curvaABC}
        </span>
      </div>
      <p className="mt-1 truncate text-slate-600">{d.descricao}</p>
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Divergência (Qtd):</span>
          <span className={`font-semibold ${isFalta ? 'text-[#F43F5E]' : 'text-[#10B981]'}`}>
            {formatSignedNumber(d.divergenciaQtd)} un.
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Impacto (R$):</span>
          <span className={`font-bold ${isFalta ? 'text-[#F43F5E]' : 'text-[#10B981]'}`}>
            {formatBRL(d.impactoFinanceiro, true)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ABCTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      curva: 'A' | 'B' | 'C';
      skuCount: number;
      valorTotal: number;
      percentualValor: number;
      divergenciasCount: number;
    };
  }>;
}

function ABCTooltip({ active, payload }: ABCTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl tabular-nums">
      <p className="font-bold text-slate-900">Curva {d.curva}</p>
      <p className="mt-1 text-slate-600">
        Valor: <span className="font-semibold text-slate-900">{formatBRL(d.valorTotal)}</span> (
        {formatPercent(d.percentualValor, 1)})
      </p>
      <p className="text-slate-600">
        SKUs: <span className="font-semibold text-slate-900">{d.skuCount}</span> | Divergências:{' '}
        <span className="font-semibold text-[#F43F5E]">{d.divergenciasCount}</span>
      </p>
    </div>
  );
}

function InventoryHealthGauge({ kpis }: { kpis: AuditKPIs }) {
  const pct = Math.min(100, Math.max(0, kpis.acuracidadeGeral));
  // Arco semicircular: centro (110, 108), raio 80 -> ângulo de 180° (esquerda) a 0° (direita)
  const cx = 110;
  const cy = 108;
  const r = 78;

  const polarToCartesian = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
    const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(
      2
    )} ${end.y.toFixed(2)}`;
  };

  // Ângulo proporcional ao valor (180 -> 0%) e (0 -> 100%), com escala real de 0..100
  const needleAngle = 180 - (pct / 100) * 180;
  const needleTip = {
    x: cx + (r - 12) * Math.cos((needleAngle * Math.PI) / 180),
    y: cy - (r - 12) * Math.sin((needleAngle * Math.PI) / 180),
  };

  const statusColor =
    kpis.saudeNivel === 'Excelente'
      ? '#10B981'
      : kpis.saudeNivel === 'Atenção'
        ? '#F97316'
        : '#F43F5E';

  const statusBadgeClasses =
    kpis.saudeNivel === 'Excelente'
      ? 'bg-[#ECFDF5] text-emerald-700 border-emerald-200'
      : kpis.saudeNivel === 'Atenção'
        ? 'bg-[#FFF7ED] text-orange-700 border-orange-200'
        : 'bg-[#FFF1F2] text-rose-700 border-rose-200';

  return (
    <div className="flex flex-col items-center justify-between">
      <div className="relative flex w-full justify-center">
        <svg viewBox="0 0 220 132" className="h-[168px] w-full max-w-[240px]" aria-hidden="true">
          {/* Trilha de fundo */}
          <path
            d={describeArc(180, 0)}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Faixas de referência sutis (0-95 Crítico, 95-98 Atenção, 98-100 Excelente -> visualmente proporcionais) */}
          <path
            d={describeArc(180, 36)}
            fill="none"
            stroke="#FECDD3"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path d={describeArc(36, 14)} fill="none" stroke="#FED7AA" strokeWidth="16" />
          <path
            d={describeArc(14, 0)}
            fill="none"
            stroke="#A7F3D0"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Arco preenchido da acuracidade */}
          {pct > 0 && (
            <path
              d={describeArc(180, needleAngle)}
              fill="none"
              stroke={statusColor}
              strokeWidth="16"
              strokeLinecap="round"
            />
          )}

          {/* Ponteiro suave */}
          <line
            x1={cx}
            y1={cy}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5.5" fill="#0F172A" />
          <circle cx={cx} cy={cy} r="2.5" fill="#FFFFFF" />
        </svg>
      </div>

      <div className="-mt-3 text-center">
        <p className="font-display tabular-nums text-3xl font-extrabold text-slate-900">
          {formatPercent(kpis.acuracidadeGeral, 1)}
        </p>
        <span
          className={`mt-1.5 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold ${statusBadgeClasses}`}
        >
          {kpis.saudeNivel}
        </span>
      </div>

      {/* Legenda das faixas */}
      <div className="mt-4 grid w-full grid-cols-3 gap-1.5 border-t border-slate-100 pt-3 text-center text-[10px]">
        <div className="rounded-lg bg-[#ECFDF5] px-1.5 py-1.5">
          <p className="font-bold text-emerald-700">Excelente</p>
          <p className="tabular-nums text-emerald-600">&gt; 98%</p>
        </div>
        <div className="rounded-lg bg-[#FFF7ED] px-1.5 py-1.5">
          <p className="font-bold text-orange-700">Atenção</p>
          <p className="tabular-nums text-orange-600">95% – 98%</p>
        </div>
        <div className="rounded-lg bg-[#FFF1F2] px-1.5 py-1.5">
          <p className="font-bold text-rose-700">Crítico</p>
          <p className="tabular-nums text-rose-600">&lt; 95%</p>
        </div>
      </div>
    </div>
  );
}

export function ChartsSection({
  topDivergences,
  abcDistribution,
  kpis,
  onSelectItem,
}: ChartsSectionProps) {
  const paretoData = topDivergences.map((item) => ({
    ...item,
    label: item.sku.length > 14 ? `${item.sku.slice(0, 12)}…` : item.sku,
  }));

  const pieData = abcDistribution.filter((d) => d.skuCount > 0);

  return (
    <section
      aria-label="Visualizações Executivas"
      className="grid grid-cols-1 gap-5 lg:grid-cols-12"
    >
      {/* 1. Pareto / Top 5 Divergências Financeiras */}
      <div className="card-elevated flex min-w-0 flex-col justify-between rounded-2xl p-5 lg:col-span-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#F43F5E]">
                <TrendingDown className="h-4 w-4" />
              </div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Pareto — Top 5 Divergências (R$)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              SKUs com maior impacto financeiro absoluto. Clique na barra para auditar com IA.
            </p>
          </div>
        </div>

        <div className="mt-4 min-w-0">
          {paretoData.length === 0 ? (
            <div className="flex h-[250px] flex-col items-center justify-center rounded-xl border border-emerald-100 bg-[#ECFDF5]/60 p-6 text-center">
              <CheckCircle2 className="h-9 w-9 text-[#10B981]" />
              <p className="mt-2 text-sm font-bold text-emerald-900">Inventário 100% Acurado</p>
              <p className="mt-1 text-xs text-emerald-700">
                Nenhuma divergência financeira identificada entre ERP e contagem física.
              </p>
            </div>
          ) : (
            <div className="h-[255px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paretoData}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 6, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={92}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ParetoTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar
                    dataKey="impactoAbsoluto"
                    radius={[0, 8, 8, 0]}
                    barSize={24}
                    onClick={(barData) => {
                      const clickedSku = (barData as unknown as { sku?: string })?.sku;
                      const match = topDivergences.find((i) => i.sku === clickedSku);
                      if (match) onSelectItem(match);
                    }}
                    className="cursor-pointer"
                  >
                    {paretoData.map((entry) => (
                      <Cell
                        key={entry.sku}
                        fill={entry.status === 'quebra' ? '#F43F5E' : '#10B981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-end gap-4 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E]" />
            Quebra (Falta)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
            Sobra
          </span>
        </div>
      </div>

      {/* 2. Distribuição por Curva ABC (Donut Chart) */}
      <div className="card-elevated flex min-w-0 flex-col justify-between rounded-2xl p-5 lg:col-span-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5]">
            <PieChartIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Distribuição por Curva ABC
            </h2>
            <p className="text-xs text-slate-500">Representatividade financeira (80 / 15 / 5)</p>
          </div>
        </div>

        <div className="mt-2 h-[175px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="valorTotal"
                nameKey="curva"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={74}
                paddingAngle={3}
                stroke="none"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.curva} fill={ABC_COLORS[entry.curva]} />
                ))}
              </Pie>
              <Tooltip content={<ABCTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 space-y-1.5">
          {abcDistribution.map((entry) => (
            <div
              key={entry.curva}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-1.5 text-xs tabular-nums"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ABC_COLORS[entry.curva] }}
                />
                <span className="font-bold text-slate-800">Curva {entry.curva}</span>
                <span className="text-slate-500">
                  ({entry.skuCount} {entry.skuCount === 1 ? 'SKU' : 'SKUs'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">
                  {formatPercent(entry.percentualValor, 1)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    entry.divergenciasCount > 0
                      ? 'bg-[#FFF1F2] text-[#F43F5E]'
                      : 'bg-[#ECFDF5] text-[#10B981]'
                  }`}
                >
                  {entry.divergenciasCount} div.
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Indicador de Saúde do Inventário (Gauge) */}
      <div className="card-elevated flex min-w-0 flex-col justify-between rounded-2xl p-5 lg:col-span-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-[#0891B2]">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">Saúde do Inventário</h2>
            <p className="text-xs text-slate-500">Termômetro de acuracidade</p>
          </div>
        </div>

        <div className="mt-3">
          <InventoryHealthGauge kpis={kpis} />
        </div>
      </div>
    </section>
  );
}

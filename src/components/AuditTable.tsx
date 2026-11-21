import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
} from 'lucide-react';
import type { AIDiagnostic, CurvaABC, DivergenceStatus, ReconciledItem } from '../types/audit';
import { formatBRL, formatNumber, formatSignedNumber } from '../utils/formatters';

interface AuditTableProps {
  items: ReconciledItem[];
  diagnosticsBySku: Record<string, AIDiagnostic>;
  onAnalyzeItem: (item: ReconciledItem) => void;
}

type StatusFilter = 'todos' | DivergenceStatus;
type AbcFilter = 'todas' | CurvaABC;
type SortKey =
  | 'sku'
  | 'descricao'
  | 'curvaABC'
  | 'saldoERP'
  | 'qtdContada'
  | 'divergenciaQtd'
  | 'impactoFinanceiro';

export function AuditTable({ items, diagnosticsBySku, onAnalyzeItem }: AuditTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [abcFilter, setAbcFilter] = useState<AbcFilter>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('impactoFinanceiro');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const counts = useMemo(() => {
    return {
      todos: items.length,
      quebra: items.filter((i) => i.status === 'quebra').length,
      sobra: items.filter((i) => i.status === 'sobra').length,
      acurado: items.filter((i) => i.status === 'acurado').length,
    };
  }, [items]);

  const filteredAndSorted = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (statusFilter !== 'todos' && item.status !== statusFilter) return false;
      if (abcFilter !== 'todas' && item.curvaABC !== abcFilter) return false;
      if (query) {
        const haystack = `${item.sku} ${item.descricao} ${item.categoria} ${item.localizacao}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'sku') {
        cmp = a.sku.localeCompare(b.sku);
      } else if (sortKey === 'descricao') {
        cmp = a.descricao.localeCompare(b.descricao);
      } else if (sortKey === 'curvaABC') {
        cmp = a.curvaABC.localeCompare(b.curvaABC);
      } else if (sortKey === 'saldoERP') {
        cmp = a.saldoERP - b.saldoERP;
      } else if (sortKey === 'qtdContada') {
        cmp = a.qtdContada - b.qtdContada;
      } else if (sortKey === 'divergenciaQtd') {
        cmp = Math.abs(a.divergenciaQtd) - Math.abs(b.divergenciaQtd);
      } else {
        cmp = a.impactoAbsoluto - b.impactoAbsoluto;
      }

      if (cmp === 0) {
        cmp = a.sku.localeCompare(b.sku);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [items, statusFilter, abcFilter, searchTerm, sortKey, sortDir]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems =
    pageSize === 0
      ? filteredAndSorted
      : filteredAndSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'sku' || key === 'descricao' || key === 'curvaABC' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleStatusChange = (next: StatusFilter) => {
    setStatusFilter(next);
    setPage(1);
  };

  const handleAbcChange = (next: AbcFilter) => {
    setAbcFilter(next);
    setPage(1);
  };

  const abcBadgeClass = (curva: CurvaABC) => {
    if (curva === 'A') return 'border-indigo-200 bg-indigo-50 text-[#4F46E5]';
    if (curva === 'B') return 'border-cyan-200 bg-cyan-50 text-[#0891B2]';
    return 'border-violet-200 bg-[#F5F3FF] text-[#7C3AED]';
  };

  return (
    <section className="card-elevated overflow-hidden rounded-2xl">
      {/* Cabeçalho e Filtros */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Tabela Inteligente de Auditoria
            </h2>
            <p className="text-xs text-slate-500">
              Inspecione cada SKU, filtre por status ou Curva ABC e acione o Copiloto IA para
              diagnóstico.
            </p>
          </div>

          {/* Busca */}
          <div className="relative w-full xl:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por SKU, produto ou endereço..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-[#4F46E5] focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none"
            />
          </div>
        </div>

        {/* Pílulas de filtro */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: 'todos',
                  label: 'Todos',
                  count: counts.todos,
                  active: 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-xs',
                  idle: 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                },
                {
                  id: 'quebra',
                  label: 'Quebra (Falta)',
                  count: counts.quebra,
                  active: 'bg-[#F43F5E] text-white border-[#F43F5E] shadow-xs',
                  idle: 'bg-[#FFF1F2] text-[#F43F5E] border-rose-200 hover:bg-rose-100/70',
                },
                {
                  id: 'sobra',
                  label: 'Sobra',
                  count: counts.sobra,
                  active: 'bg-[#F97316] text-white border-[#F97316] shadow-xs',
                  idle: 'bg-[#FFF7ED] text-[#EA580C] border-orange-200 hover:bg-orange-100/70',
                },
                {
                  id: 'acurado',
                  label: 'Acurados',
                  count: counts.acurado,
                  active: 'bg-[#10B981] text-white border-[#10B981] shadow-xs',
                  idle: 'bg-[#ECFDF5] text-[#059669] border-emerald-200 hover:bg-emerald-100/70',
                },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => handleStatusChange(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === pill.id ? pill.active : pill.idle
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    statusFilter === pill.id
                      ? 'bg-white/20 text-white'
                      : 'bg-white/80 text-slate-700'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Curva ABC */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 p-1">
            {(['todas', 'A', 'B', 'C'] as const).map((abc) => (
              <button
                key={abc}
                type="button"
                onClick={() => handleAbcChange(abc)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  abcFilter === abc
                    ? 'bg-white text-[#4F46E5] shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {abc === 'todas' ? 'Todas Curvas' : `Curva ${abc}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('sku')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>SKU</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('descricao')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Produto</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-center">
                <button
                  type="button"
                  onClick={() => handleSort('curvaABC')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Curva ABC</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('saldoERP')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Saldo ERP</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('qtdContada')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Físico</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('divergenciaQtd')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Divergência (Qtd)</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3.5 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('impactoFinanceiro')}
                  className="inline-flex items-center gap-1 hover:text-[#4F46E5] cursor-pointer"
                >
                  <span>Impacto (R$)</span>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                  Nenhum item corresponde aos filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const hasDiagnostic = Boolean(diagnosticsBySku[item.sku]);
                return (
                  <tr
                    key={item.sku}
                    className="transition hover:bg-indigo-50/35"
                  >
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{item.sku}</span>
                        {item.isCritico && (
                          <span
                            title="Item Curva A com divergência"
                            className="inline-block h-2 w-2 rounded-full bg-[#F43F5E]"
                          />
                        )}
                      </div>
                    </td>
                    <td className="max-w-[270px] px-4 py-3.5">
                      <p className="truncate font-medium text-slate-800" title={item.descricao}>
                        {item.descricao}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {item.categoria} • {item.localizacao}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-flex h-6 w-7 items-center justify-center rounded-md border text-[11px] font-bold ${abcBadgeClass(
                          item.curvaABC
                        )}`}
                      >
                        {item.curvaABC}
                      </span>
                    </td>
                    <td className="tabular-nums px-3 py-3.5 text-right font-medium text-slate-700">
                      {formatNumber(item.saldoERP)}
                    </td>
                    <td className="tabular-nums px-3 py-3.5 text-right font-medium text-slate-700">
                      {formatNumber(item.qtdContada)}
                    </td>
                    <td
                      className={`tabular-nums px-3 py-3.5 text-right font-bold ${
                        item.divergenciaQtd < 0
                          ? 'text-[#F43F5E]'
                          : item.divergenciaQtd > 0
                            ? 'text-[#F97316]'
                            : 'text-slate-400'
                      }`}
                    >
                      {item.divergenciaQtd === 0 ? '0' : formatSignedNumber(item.divergenciaQtd)}
                    </td>
                    <td
                      className={`tabular-nums px-4 py-3.5 text-right font-bold ${
                        item.impactoFinanceiro < 0
                          ? 'text-[#F43F5E]'
                          : item.impactoFinanceiro > 0
                            ? 'text-[#10B981]'
                            : 'text-slate-400'
                      }`}
                    >
                      {formatBRL(item.impactoFinanceiro, true)}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {item.status === 'quebra' ? (
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-[#FFF1F2] px-2.5 py-0.5 text-[11px] font-bold text-[#F43F5E]">
                          Quebra
                        </span>
                      ) : item.status === 'sobra' ? (
                        <span className="inline-flex items-center rounded-full border border-orange-200 bg-[#FFF7ED] px-2.5 py-0.5 text-[11px] font-bold text-[#EA580C]">
                          Sobra
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                          Acurado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onAnalyzeItem(item)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                          hasDiagnostic
                            ? 'border-violet-300 bg-[#8B5CF6] text-white shadow-xs hover:bg-[#7C3AED]'
                            : 'border-violet-200 bg-[#F5F3FF] text-[#7C3AED] hover:border-[#8B5CF6] hover:bg-violet-100/80'
                        }`}
                      >
                        {hasDiagnostic ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{hasDiagnostic ? 'Parecer IA ✨' : 'Analisar com IA ✨'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-600 sm:flex-row">
        <div className="flex items-center gap-2 tabular-nums">
          <span>
            Exibindo <span className="font-bold text-slate-900">{paginatedItems.length}</span> de{' '}
            <span className="font-bold text-slate-900">{filteredAndSorted.length}</span> itens
          </span>
          <span className="text-slate-300">|</span>
          <label className="inline-flex items-center gap-1.5">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-[#4F46E5] focus:outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={0}>Todos</option>
            </select>
          </label>
        </div>

        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5 tabular-nums">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700">
              Página {safePage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Próxima página"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

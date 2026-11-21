import type {
  ABCDistribution,
  AuditKPIs,
  AuditResult,
  CurvaABC,
  DivergenceStatus,
  ERPRow,
  HealthLevel,
  PhysicalRow,
  ReconciledItem,
} from '../types/audit';
import { generateReportCode } from './formatters';

function roundQty(value: number): number {
  const rounded = Math.round(value * 10000) / 10000;
  return Math.abs(rounded) < 1e-6 ? 0 : rounded;
}

function roundMoney(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded) < 0.005 ? 0 : rounded;
}

interface AggregatedERP {
  sku: string;
  descricao: string;
  categoria: string;
  totalSaldo: number;
  totalValor: number;
  lastNonZeroCost: number;
  ultimaMovimentacaoSAP?: string;
}

interface AggregatedPhysical {
  sku: string;
  totalQtd: number;
  localizacoes: Set<string>;
  responsaveis: Set<string>;
  observacoes: Set<string>;
}

export function runInventoryAudit(
  erpRows: ERPRow[],
  physicalRows: PhysicalRow[],
  erpFileName: string,
  physicalFileName: string
): AuditResult {
  const erpMap = new Map<string, AggregatedERP>();
  for (const row of erpRows) {
    const key = row.sku.trim().toUpperCase();
    const existing = erpMap.get(key);
    const rowValue = row.saldoERP * row.custoUnitario;
    if (!existing) {
      erpMap.set(key, {
        sku: row.sku.trim(),
        descricao: row.descricao.trim() || row.sku.trim(),
        categoria: row.categoria.trim() || 'Geral',
        totalSaldo: row.saldoERP,
        totalValor: rowValue,
        lastNonZeroCost: row.custoUnitario > 0 ? row.custoUnitario : 0,
        ultimaMovimentacaoSAP: row.ultimaMovimentacaoSAP?.trim() || undefined,
      });
    } else {
      existing.totalSaldo += row.saldoERP;
      existing.totalValor += rowValue;
      if (row.custoUnitario > 0) {
        existing.lastNonZeroCost = row.custoUnitario;
      }
      if (row.ultimaMovimentacaoSAP?.trim()) {
        existing.ultimaMovimentacaoSAP = row.ultimaMovimentacaoSAP.trim();
      }
    }
  }

  const physicalMap = new Map<string, AggregatedPhysical>();
  for (const row of physicalRows) {
    const key = row.sku.trim().toUpperCase();
    const existing = physicalMap.get(key);
    if (!existing) {
      const localizacoes = new Set<string>();
      const responsaveis = new Set<string>();
      const observacoes = new Set<string>();
      if (row.localizacao && row.localizacao !== 'Não informada') {
        localizacoes.add(row.localizacao.trim());
      }
      if (row.responsavelContagem && row.responsavelContagem !== 'Não informado') {
        responsaveis.add(row.responsavelContagem.trim());
      }
      if (row.observacao?.trim()) {
        observacoes.add(row.observacao.trim());
      }
      physicalMap.set(key, {
        sku: row.sku.trim(),
        totalQtd: row.qtdContada,
        localizacoes,
        responsaveis,
        observacoes,
      });
    } else {
      existing.totalQtd += row.qtdContada;
      if (row.localizacao && row.localizacao !== 'Não informada') {
        existing.localizacoes.add(row.localizacao.trim());
      }
      if (row.responsavelContagem && row.responsavelContagem !== 'Não informado') {
        existing.responsaveis.add(row.responsavelContagem.trim());
      }
      if (row.observacao?.trim()) {
        existing.observacoes.add(row.observacao.trim());
      }
    }
  }

  // Full Outer Join
  const allKeys = new Set<string>([...erpMap.keys(), ...physicalMap.keys()]);
  const rawItems: ReconciledItem[] = [];

  for (const key of allKeys) {
    const erp = erpMap.get(key);
    const phys = physicalMap.get(key);

    const ausenteNaContagem = Boolean(erp && !phys);
    const ausenteNoERP = Boolean(!erp && phys);

    const saldoERP = roundQty(erp ? erp.totalSaldo : 0);
    const qtdContada = roundQty(phys ? phys.totalQtd : 0);

    let custoUnitario = 0;
    if (erp) {
      if (erp.totalSaldo > 0 && erp.totalValor > 0) {
        custoUnitario = erp.totalValor / erp.totalSaldo;
      } else {
        custoUnitario = erp.lastNonZeroCost;
      }
    }

    const divergenciaQtd = roundQty(qtdContada - saldoERP);
    const valorERP = roundMoney(saldoERP * custoUnitario);
    const valorFisico = roundMoney(qtdContada * custoUnitario);
    const impactoFinanceiro = roundMoney(divergenciaQtd * custoUnitario);
    const impactoAbsoluto = roundMoney(Math.abs(impactoFinanceiro));

    const status: DivergenceStatus =
      divergenciaQtd < 0 ? 'quebra' : divergenciaQtd > 0 ? 'sobra' : 'acurado';

    const localizacao = ausenteNaContagem
      ? 'Não localizado na contagem'
      : phys && phys.localizacoes.size > 0
        ? Array.from(phys.localizacoes).join('; ')
        : 'Não informada';

    const responsavelContagem =
      phys && phys.responsaveis.size > 0
        ? Array.from(phys.responsaveis).join('; ')
        : 'Não informado';

    const observacao =
      phys && phys.observacoes.size > 0 ? Array.from(phys.observacoes).join('; ') : undefined;

    rawItems.push({
      sku: erp?.sku || phys?.sku || key,
      descricao: erp?.descricao || 'Item sem cadastro no ERP',
      categoria: erp?.categoria || 'Não Classificado',
      custoUnitario,
      saldoERP,
      qtdContada,
      divergenciaQtd,
      valorERP,
      valorFisico,
      impactoFinanceiro,
      impactoAbsoluto,
      curvaABC: 'C',
      percentualAcumulado: 100,
      status,
      isCritico: false,
      localizacao,
      responsavelContagem,
      ultimaMovimentacaoSAP: erp?.ultimaMovimentacaoSAP,
      observacao,
      ausenteNaContagem,
      ausenteNoERP,
    });
  }

  // Cálculo da Curva ABC pelo valor base (ERP ou Físico quando ausente no ERP)
  const sortedForABC = [...rawItems].sort((a, b) => {
    const valA = a.valorERP > 0 ? a.valorERP : a.valorFisico;
    const valB = b.valorERP > 0 ? b.valorERP : b.valorFisico;
    return valB - valA || b.saldoERP - a.saldoERP || a.sku.localeCompare(b.sku);
  });

  const totalBaseValue = sortedForABC.reduce(
    (sum, item) => sum + (item.valorERP > 0 ? item.valorERP : item.valorFisico),
    0
  );

  let cumulativeValue = 0;
  for (const item of sortedForABC) {
    const itemBase = item.valorERP > 0 ? item.valorERP : item.valorFisico;
    const prevCumPct = totalBaseValue > 0 ? (cumulativeValue / totalBaseValue) * 100 : 100;

    let curva: CurvaABC = 'C';
    if (totalBaseValue > 0) {
      if (prevCumPct < 80) {
        curva = 'A';
      } else if (prevCumPct < 95) {
        curva = 'B';
      } else {
        curva = 'C';
      }
    }

    cumulativeValue += itemBase;
    const currentCumPct = totalBaseValue > 0 ? (cumulativeValue / totalBaseValue) * 100 : 100;

    item.curvaABC = curva;
    item.percentualAcumulado = Math.min(100, Math.round(currentCumPct * 10) / 10);
    item.isCritico = curva === 'A' && item.divergenciaQtd !== 0;
  }

  // Ordenação padrão por impacto absoluto decrescente
  const items = [...sortedForABC].sort(
    (a, b) =>
      b.impactoAbsoluto - a.impactoAbsoluto ||
      Math.abs(b.divergenciaQtd) - Math.abs(a.divergenciaQtd) ||
      a.sku.localeCompare(b.sku)
  );

  const totalSKUs = items.length;
  const itensAcurados = items.filter((i) => i.status === 'acurado').length;
  const itensQuebra = items.filter((i) => i.status === 'quebra').length;
  const itensSobra = items.filter((i) => i.status === 'sobra').length;
  const itensCriticos = items.filter((i) => i.isCritico).length;

  const acuracidadeGeral =
    totalSKUs > 0 ? Math.round((itensAcurados / totalSKUs) * 1000) / 10 : 100;

  const saudeNivel: HealthLevel =
    acuracidadeGeral > 98 ? 'Excelente' : acuracidadeGeral >= 95 ? 'Atenção' : 'Crítico';

  const valorTotalAuditado = roundMoney(items.reduce((sum, i) => sum + i.valorERP, 0));
  const valorTotalFisico = roundMoney(items.reduce((sum, i) => sum + i.valorFisico, 0));
  const impactoFinanceiroLiquido = roundMoney(
    items.reduce((sum, i) => sum + i.impactoFinanceiro, 0)
  );
  const totalQuebrasFinanceiro = roundMoney(
    items
      .filter((i) => i.impactoFinanceiro < 0)
      .reduce((sum, i) => sum + i.impactoFinanceiro, 0)
  );
  const totalSobrasFinanceiro = roundMoney(
    items
      .filter((i) => i.impactoFinanceiro > 0)
      .reduce((sum, i) => sum + i.impactoFinanceiro, 0)
  );
  const totalUnidadesERP = roundQty(items.reduce((sum, i) => sum + i.saldoERP, 0));
  const totalUnidadesFisico = roundQty(items.reduce((sum, i) => sum + i.qtdContada, 0));

  const kpis: AuditKPIs = {
    totalSKUs,
    itensAcurados,
    itensQuebra,
    itensSobra,
    acuracidadeGeral,
    impactoFinanceiroLiquido,
    totalQuebrasFinanceiro,
    totalSobrasFinanceiro,
    itensCriticos,
    valorTotalAuditado,
    valorTotalFisico,
    totalUnidadesERP,
    totalUnidadesFisico,
    saudeNivel,
  };

  const topDivergences = items
    .filter((i) => i.divergenciaQtd !== 0)
    .sort(
      (a, b) =>
        b.impactoAbsoluto - a.impactoAbsoluto ||
        Math.abs(b.divergenciaQtd) - Math.abs(a.divergenciaQtd)
    )
    .slice(0, 5);

  const totalValorParaABC = items.reduce(
    (sum, i) => sum + (i.valorERP > 0 ? i.valorERP : i.valorFisico),
    0
  );

  const abcDistribution: ABCDistribution = (['A', 'B', 'C'] as CurvaABC[]).map((curva) => {
    const group = items.filter((i) => i.curvaABC === curva);
    const valorTotal = roundMoney(
      group.reduce((sum, i) => sum + (i.valorERP > 0 ? i.valorERP : i.valorFisico), 0)
    );
    const percentualValor =
      totalValorParaABC > 0 ? Math.round((valorTotal / totalValorParaABC) * 1000) / 10 : 0;
    const divergenciasCount = group.filter((i) => i.divergenciaQtd !== 0).length;
    const impactoAbsoluto = roundMoney(group.reduce((sum, i) => sum + i.impactoAbsoluto, 0));
    const impactoLiquido = roundMoney(group.reduce((sum, i) => sum + i.impactoFinanceiro, 0));

    return {
      curva,
      skuCount: group.length,
      valorTotal,
      percentualValor,
      divergenciasCount,
      impactoAbsoluto,
      impactoLiquido,
    };
  });

  return {
    reportCode: generateReportCode(),
    generatedAt: new Date().toISOString(),
    erpFileName,
    physicalFileName,
    items,
    kpis,
    topDivergences,
    abcDistribution,
  };
}

import type { AIDiagnostic, AuditResult } from '../types/audit';

function csvEscape(value: string | number | boolean | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportReconciliationCSV(
  audit: AuditResult,
  diagnosticsBySku: Record<string, AIDiagnostic>
): void {
  const headers = [
    'SKU',
    'Descricao',
    'Categoria',
    'Curva_ABC',
    'Custo_Unitario',
    'Saldo_ERP',
    'Qtd_Contada',
    'Divergencia_Qtd',
    'Valor_ERP',
    'Valor_Fisico',
    'Impacto_Financeiro_BRL',
    'Status',
    'Critico_Curva_A',
    'Localizacao',
    'Responsavel_Contagem',
    'Ultima_Movimentacao_SAP',
    'Observacao',
    'Risco_IA',
    'Hipotese_IA',
  ];

  const lines = [headers.join(';')];

  for (const item of audit.items) {
    const diag = diagnosticsBySku[item.sku];
    const statusLabel =
      item.status === 'quebra' ? 'Quebra (Falta)' : item.status === 'sobra' ? 'Sobra' : 'Acurado';

    const row = [
      csvEscape(item.sku),
      csvEscape(item.descricao),
      csvEscape(item.categoria),
      csvEscape(item.curvaABC),
      csvEscape(item.custoUnitario.toFixed(2).replace('.', ',')),
      csvEscape(String(item.saldoERP).replace('.', ',')),
      csvEscape(String(item.qtdContada).replace('.', ',')),
      csvEscape(String(item.divergenciaQtd).replace('.', ',')),
      csvEscape(item.valorERP.toFixed(2).replace('.', ',')),
      csvEscape(item.valorFisico.toFixed(2).replace('.', ',')),
      csvEscape(item.impactoFinanceiro.toFixed(2).replace('.', ',')),
      csvEscape(statusLabel),
      csvEscape(item.isCritico ? 'Sim' : 'Não'),
      csvEscape(item.localizacao),
      csvEscape(item.responsavelContagem),
      csvEscape(item.ultimaMovimentacaoSAP || ''),
      csvEscape(item.observacao || ''),
      csvEscape(diag?.nivelRisco || ''),
      csvEscape(diag?.hipotesePrincipal || ''),
    ];
    lines.push(row.join(';'));
  }

  const content = `\uFEFF${lines.join('\r\n')}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Conciliacao_StockGuard_${audit.reportCode}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

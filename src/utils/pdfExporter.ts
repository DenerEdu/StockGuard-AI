import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AIDiagnostic, AuditResult } from '../types/audit';
import { generateLocalDiagnostic } from './aiService';
import { formatBRL, formatDateTimeBR, formatNumber, formatPercent, formatSignedNumber } from './formatters';

function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[→➔➜]/g, '->')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, 'x')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
    .trim();
}

export function exportExecutivePDF(
  audit: AuditResult,
  diagnosticsBySku: Record<string, AIDiagnostic>
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Faixa superior corporativa (Índigo -> Ciano)
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth * 0.65, 3.5, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(pageWidth * 0.65, 0, pageWidth * 0.35, 3.5, 'F');

  // Logo vetorial minimalista (Escudo + Cubo)
  doc.setFillColor(79, 70, 229);
  doc.roundedRect(margin, 10, 11, 11, 2.5, 2.5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.55);
  // Desenho simplificado de cubo isométrico interno com linhas
  const cx = margin + 5.5;
  const topY = 12.2;
  const midY = 15.5;
  const botY = 18.8;
  const leftX = margin + 2.4;
  const rightX = margin + 8.6;
  const upperSideY = 13.8;
  const lowerSideY = 17.2;

  doc.line(cx, topY, rightX, upperSideY);
  doc.line(rightX, upperSideY, rightX, lowerSideY);
  doc.line(rightX, lowerSideY, cx, botY);
  doc.line(cx, botY, leftX, lowerSideY);
  doc.line(leftX, lowerSideY, leftX, upperSideY);
  doc.line(leftX, upperSideY, cx, topY);
  doc.line(cx, midY, cx, botY);
  doc.line(cx, midY, rightX, upperSideY);
  doc.line(cx, midY, leftX, upperSideY);

  // Cabeçalho título e metadados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('StockGuard AI', margin + 14, 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    sanitizePdfText('Relatório Executivo de Auditoria de Inventário & Divergências'),
    margin + 14,
    19.8
  );

  // Bloco de identificação à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text(sanitizePdfText(`Código: ${audit.reportCode}`), pageWidth - margin, 14, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    sanitizePdfText(`Emitido em: ${formatDateTimeBR(audit.generatedAt)}`),
    pageWidth - margin,
    18.8,
    { align: 'right' }
  );

  // Linha divisória + bases processadas
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(margin, 24.5, pageWidth - margin, 24.5);

  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    sanitizePdfText(
      `Base Contábil (ERP): ${audit.erpFileName}   |   Contagem Física: ${audit.physicalFileName}`
    ),
    margin,
    29.5
  );

  // 1. Cards de Resumo Executivo (4 cards lado a lado)
  let y = 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Resumo Executivo da Auditoria', margin, y);
  y += 4;

  const cardGap = 3.5;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 20;

  const kpiCardsData = [
    {
      label: 'Acuracidade Geral',
      value: formatPercent(audit.kpis.acuracidadeGeral, 1),
      sub: `Saúde: ${audit.kpis.saudeNivel} (${audit.kpis.itensAcurados}/${audit.kpis.totalSKUs})`,
      accent:
        audit.kpis.saudeNivel === 'Excelente'
          ? ([16, 185, 129] as const)
          : audit.kpis.saudeNivel === 'Atenção'
            ? ([249, 115, 22] as const)
            : ([244, 63, 94] as const),
    },
    {
      label: 'Impacto Financeiro Líquido',
      value: formatBRL(audit.kpis.impactoFinanceiroLiquido, true),
      sub: `Quebras: ${formatBRL(audit.kpis.totalQuebrasFinanceiro)}`,
      accent:
        audit.kpis.impactoFinanceiroLiquido < 0
          ? ([244, 63, 94] as const)
          : ([16, 185, 129] as const),
    },
    {
      label: 'Divergências Críticas',
      value: String(audit.kpis.itensCriticos),
      sub: `Curva A c/ furo (${audit.kpis.itensQuebra + audit.kpis.itensSobra} total)`,
      accent:
        audit.kpis.itensCriticos > 0 ? ([249, 115, 22] as const) : ([16, 185, 129] as const),
    },
    {
      label: 'Valor Total Auditado',
      value: formatBRL(audit.kpis.valorTotalAuditado),
      sub: `${formatNumber(audit.kpis.totalUnidadesERP)} un. no ERP`,
      accent: [79, 70, 229] as const,
    },
  ];

  kpiCardsData.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    // Barra lateral de acento
    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(x, y + 2.5, 1.2, cardHeight - 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(card.label), x + 3.2, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(card.value), x + 3.2, y + 12.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(card.sub), x + 3.2, y + 17);
  });

  y += cardHeight + 5;

  // Mini resumo da Curva ABC
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 9.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(79, 70, 229);
  doc.text('Distribuição Curva ABC:', margin + 3, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const abcSummary = audit.abcDistribution
    .map(
      (d) =>
        `Curva ${d.curva}: ${formatPercent(d.percentualValor, 1)} valor (${d.skuCount} SKUs | ${d.divergenciasCount} div.)`
    )
    .join('   |   ');
  doc.text(sanitizePdfText(abcSummary), margin + 40, y + 6);

  y += 14.5;

  // 2. Tabela de Divergências Críticas Ordenadas por Impacto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Divergências Identificadas (Ordenadas por Impacto Financeiro)', margin, y);
  y += 3.5;

  const divergentItems = audit.items
    .filter((i) => i.divergenciaQtd !== 0)
    .sort((a, b) => b.impactoAbsoluto - a.impactoAbsoluto);

  if (divergentItems.length === 0) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text(
      sanitizePdfText(
        'Conformidade Total: Nenhuma divergência encontrada entre o Saldo Contábil (ERP) e a Contagem Física.'
      ),
      margin + 4,
      y + 8.5
    );
    y += 20;
  } else {
    const displayedItems = divergentItems.slice(0, 40);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['SKU', 'Produto', 'ABC', 'ERP', 'Físico', 'Div.', 'Impacto (R$)', 'Status']],
      body: displayedItems.map((item) => [
        sanitizePdfText(item.sku),
        sanitizePdfText(
          item.descricao.length > 34 ? `${item.descricao.slice(0, 32)}...` : item.descricao
        ),
        item.curvaABC,
        formatNumber(item.saldoERP),
        formatNumber(item.qtdContada),
        formatSignedNumber(item.divergenciaQtd),
        sanitizePdfText(formatBRL(item.impactoFinanceiro, true)),
        item.status === 'quebra' ? 'Quebra' : 'Sobra',
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.6,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 50 },
        2: { halign: 'center', cellWidth: 11 },
        3: { halign: 'right', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 16 },
        6: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
        7: { halign: 'center', cellWidth: 18 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const rowItem = displayedItems[hookData.row.index];
          if (hookData.column.index === 6 && rowItem) {
            hookData.cell.styles.textColor =
              rowItem.impactoFinanceiro < 0 ? [225, 29, 72] : [5, 150, 105];
          }
          if (hookData.column.index === 7 && rowItem) {
            hookData.cell.styles.textColor =
              rowItem.status === 'quebra' ? [234, 88, 12] : [5, 150, 105];
          }
        }
      },
    });

    const tableEndY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY;
    y = (tableEndY || y + 20) + 4;

    if (divergentItems.length > displayedItems.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        sanitizePdfText(
          `Nota: Exibindo os ${displayedItems.length} maiores desvios de ${divergentItems.length} itens divergentes. Consulte a exportação CSV para a relação completa.`
        ),
        margin,
        y + 2
      );
      y += 6;
    }
  }

  // 3. Síntese dos Pareceres Gerados pela IA
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 18;
  } else {
    y += 4;
  }

  const userGeneratedList = Object.values(diagnosticsBySku);
  const usingAutoTop3 = userGeneratedList.length === 0 && divergentItems.length > 0;
  const opinionsToPrint: AIDiagnostic[] =
    userGeneratedList.length > 0
      ? userGeneratedList
      : divergentItems.slice(0, 3).map((item) => generateLocalDiagnostic(item));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Síntese dos Pareceres do Copiloto Auditor IA', margin, y);
  y += 4.5;

  if (usingAutoTop3) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.6);
    doc.setTextColor(109, 40, 217);
    doc.text(
      sanitizePdfText(
        'Síntese Automática - Motor Analítico StockGuard AI para os Top 3 itens de maior impacto financeiro:'
      ),
      margin,
      y
    );
    y += 4;
  }

  if (opinionsToPrint.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      sanitizePdfText(
        'Não há pareceres de divergência a reportar, pois todos os SKUs encontram-se 100% acurados.'
      ),
      margin,
      y + 2
    );
    y += 10;
  } else {
    for (const diag of opinionsToPrint) {
      const itemRef = audit.items.find((i) => i.sku === diag.sku);
      const headerLine = sanitizePdfText(
        `SKU ${diag.sku}${itemRef ? ` - ${itemRef.descricao}` : ''} | Risco Contábil: ${diag.nivelRisco}${itemRef ? ` | Impacto: ${formatBRL(itemRef.impactoFinanceiro, true)}` : ''}`
      );
      const hypLines = doc.splitTextToSize(
        sanitizePdfText(`Hipótese: ${diag.hipotesePrincipal}`),
        contentWidth - 8
      ) as string[];
      const actionLines = doc.splitTextToSize(
        sanitizePdfText(
          `Plano de Ação: 1) ${diag.planoAcao[0]}  2) ${diag.planoAcao[1]}  3) ${diag.planoAcao[2]}`
        ),
        contentWidth - 8
      ) as string[];

      const boxHeight = 9 + hypLines.length * 3.8 + actionLines.length * 3.8 + 4;
      if (y + boxHeight > pageHeight - 25) {
        doc.addPage();
        y = 18;
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

      doc.setFillColor(139, 92, 246);
      doc.rect(margin, y + 2, 1.3, boxHeight - 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(79, 70, 229);
      doc.text(headerLine, margin + 4, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(30, 41, 59);
      doc.text(hypLines, margin + 4, y + 10);

      const actionY = y + 10 + hypLines.length * 3.8 + 1;
      doc.setTextColor(71, 85, 105);
      doc.text(actionLines, margin + 4, actionY);

      y += boxHeight + 3.5;
    }
  }

  // 4. Bloco Formal de Assinaturas no Rodapé
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 22;
  } else {
    y = Math.max(y + 6, pageHeight - 46);
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Aprovação e Assinaturas Gerenciais', margin, y);

  const sigY = y + 17;
  const sigWidth = (contentWidth - 18) / 2;

  // Assinatura 1
  doc.setDrawColor(100, 116, 139);
  doc.line(margin, sigY, margin + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Auditor Responsável', margin + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    sanitizePdfText('Auditoria de Inventário / Controladoria   |   Data: ____/____/______'),
    margin + sigWidth / 2,
    sigY + 8.5,
    { align: 'center' }
  );

  // Assinatura 2
  const sig2X = margin + sigWidth + 18;
  doc.line(sig2X, sigY, sig2X + sigWidth, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('Gerência de Controladoria / Operações'),
    sig2X + sigWidth / 2,
    sigY + 4.5,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    sanitizePdfText('Aprovação Executiva   |   Data: ____/____/______'),
    sig2X + sigWidth / 2,
    sigY + 8.5,
    { align: 'center' }
  );

  // Paginação e Rodapé institucional em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      sanitizePdfText(
        `StockGuard AI | Relatório de Auditoria ${audit.reportCode} | Página ${p} de ${totalPages}`
      ),
      pageWidth / 2,
      pageHeight - 6.5,
      { align: 'center' }
    );
  }

  doc.save(`Relatorio_Auditoria_StockGuard_${audit.reportCode}.pdf`);
}

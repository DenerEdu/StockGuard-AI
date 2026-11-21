import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ERPRow, ParsedFileResult, PhysicalRow } from '../types/audit';

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-.\/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function parseLocalizedNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : NaN;
  }
  if (raw === null || raw === undefined) {
    return NaN;
  }
  let text = String(raw).trim();
  if (!text) {
    return NaN;
  }

  // Formato contábil entre parênteses representa negativo: (120,50)
  let isNegative = false;
  if (text.startsWith('(') && text.endsWith(')')) {
    isNegative = true;
    text = text.slice(1, -1).trim();
  }

  // Remover prefixos de moeda, espaços e NBSP
  text = text.replace(/[R$\s\u00A0]/gi, '');
  if (text.startsWith('-')) {
    isNegative = true;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  if (!text) {
    return NaN;
  }

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Ex: 1.234,56 -> milhar "." e decimal ","
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex: 1,234.56 -> milhar "," e decimal "."
      text = text.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (text.match(/,/g) || []).length;
    if (commaCount > 1) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const dotCount = (text.match(/\./g) || []).length;
    if (dotCount > 1) {
      text = text.replace(/\./g, '');
    }
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }
  return isNegative ? -parsed : parsed;
}

const SKU_ALIASES = [
  'sku',
  'codigo',
  'cod_sku',
  'codigo_sku',
  'material',
  'item',
  'cod_item',
  'cod_produto',
  'id_produto',
];

const ERP_FIELD_ALIASES = {
  sku: SKU_ALIASES,
  descricao: [
    'descricao',
    'produto',
    'nome',
    'nome_produto',
    'description',
    'texto_breve',
    'descricao_item',
  ],
  categoria: ['categoria', 'grupo', 'grupo_mercadoria', 'departamento', 'familia', 'category'],
  custoUnitario: [
    'custo_unitario',
    'custo',
    'valor_unitario',
    'preco_unitario',
    'custo_medio',
    'unit_cost',
    'vlr_unitario',
  ],
  saldoERP: [
    'saldo_erp',
    'saldo_contabil',
    'estoque_erp',
    'qtd_erp',
    'saldo_sistema',
    'saldo_sap',
    'quantidade_erp',
    'saldo',
  ],
  ultimaMovimentacaoSAP: [
    'ultima_movimentacao_sap',
    'movimentacao_sap',
    'tipo_movimento',
    'mov_sap',
    'ultima_movimentacao',
    'ultimo_movimento',
    'mvt',
    'sap_movement',
  ],
};

const PHYSICAL_FIELD_ALIASES = {
  sku: SKU_ALIASES,
  qtdContada: [
    'qtd_contada',
    'quantidade_contada',
    'contagem',
    'saldo_fisico',
    'qtd_fisica',
    'fisico',
    'contado',
    'estoque_fisico',
  ],
  localizacao: [
    'localizacao',
    'endereco',
    'posicao',
    'rua',
    'galpao',
    'deposito',
    'setor',
    'bin',
    'location',
  ],
  responsavelContagem: [
    'responsavel_contagem',
    'responsavel',
    'auditor',
    'contador',
    'operador',
    'conferente',
  ],
  observacao: ['observacao', 'observacoes', 'obs', 'notas', 'comentario', 'comentarios', 'notes'],
};

interface RawSpreadsheetData {
  headers: string[];
  records: Record<string, unknown>[];
}

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

async function readSpreadsheetRaw(file: File): Promise<RawSpreadsheetData> {
  const ext = getFileExtension(file.name);
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    throw new Error(
      `Formato de arquivo ".${ext || 'desconhecido'}" não suportado. Envie uma planilha .csv ou .xlsx.`
    );
  }

  if (ext === 'csv') {
    const text = await file.text();
    const cleaned = text.replace(/^\uFEFF/, '');
    if (!cleaned.trim()) {
      throw new Error('O arquivo CSV enviado está completamente vazio.');
    }

    const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0 && !parsed.meta.fields?.length) {
      throw new Error(
        `Não foi possível interpretar o CSV "${file.name}". Verifique o separador e a codificação UTF-8.`
      );
    }

    const headers = (parsed.meta.fields || []).map((h) => h.trim()).filter(Boolean);
    return {
      headers,
      records: parsed.data,
    };
  }

  // XLSX ou XLS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`A planilha "${file.name}" não possui nenhuma aba legível.`);
  }

  const sheet = workbook.Sheets[firstSheetName];
  const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const rawHeaders = Array.isArray(headerMatrix[0])
    ? headerMatrix[0].map((cell) => String(cell ?? '').trim()).filter(Boolean)
    : [];

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const headers =
    rawHeaders.length > 0
      ? rawHeaders
      : records.length > 0
        ? Object.keys(records[0]).map((k) => k.trim())
        : [];

  return { headers, records };
}

function resolveColumnMap(
  detectedHeaders: string[],
  aliasesByField: Record<string, string[]>
): Record<string, string | undefined> {
  const normalizedToOriginal = new Map<string, string>();
  for (const h of detectedHeaders) {
    const norm = normalizeHeader(h);
    if (norm && !normalizedToOriginal.has(norm)) {
      normalizedToOriginal.set(norm, h);
    }
  }

  const resolved: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(aliasesByField)) {
    for (const alias of aliases) {
      const match = normalizedToOriginal.get(alias);
      if (match) {
        resolved[field] = match;
        break;
      }
    }
  }
  return resolved;
}

function isCompletelyBlankRecord(record: Record<string, unknown>): boolean {
  return Object.values(record).every((val) => String(val ?? '').trim() === '');
}

export async function parseERPFile(file: File): Promise<ParsedFileResult<ERPRow>> {
  const { headers, records } = await readSpreadsheetRaw(file);
  if (headers.length === 0) {
    throw new Error('Não encontramos cabeçalhos na primeira linha da planilha ERP / SAP.');
  }

  const colMap = resolveColumnMap(headers, ERP_FIELD_ALIASES);
  const missing: string[] = [];
  if (!colMap.sku) missing.push('SKU');
  if (!colMap.custoUnitario) missing.push('Custo_Unitario');
  if (!colMap.saldoERP) missing.push('Saldo_ERP');

  if (missing.length > 0) {
    throw new Error(
      `Coluna(s) obrigatória(s) ausente(s) na Base ERP: ${missing.join(', ')}. ` +
        `Colunas encontradas no arquivo: ${headers.join(', ')}.`
    );
  }

  const nonEmptyRecords = records.filter((r) => !isCompletelyBlankRecord(r));
  if (nonEmptyRecords.length === 0) {
    throw new Error(
      'A planilha contém apenas o cabeçalho (0 registros). Preencha os dados reais antes de importar.'
    );
  }

  const warnings: string[] = [];
  const rows: ERPRow[] = [];
  let skippedNoSku = 0;
  let invalidNumbersCount = 0;

  for (const rec of nonEmptyRecords) {
    const skuRaw = String(rec[colMap.sku!] ?? '').trim();
    if (!skuRaw) {
      skippedNoSku += 1;
      continue;
    }

    const descricaoRaw = colMap.descricao ? String(rec[colMap.descricao] ?? '').trim() : '';
    const categoriaRaw = colMap.categoria ? String(rec[colMap.categoria] ?? '').trim() : '';
    const movRaw = colMap.ultimaMovimentacaoSAP
      ? String(rec[colMap.ultimaMovimentacaoSAP] ?? '').trim()
      : '';

    const parsedCost = parseLocalizedNumber(rec[colMap.custoUnitario!]);
    const parsedSaldo = parseLocalizedNumber(rec[colMap.saldoERP!]);

    if (Number.isNaN(parsedCost) || Number.isNaN(parsedSaldo)) {
      invalidNumbersCount += 1;
    }

    rows.push({
      sku: skuRaw,
      descricao: descricaoRaw || skuRaw,
      categoria: categoriaRaw || 'Geral',
      custoUnitario: Number.isNaN(parsedCost) ? 0 : Math.max(0, parsedCost),
      saldoERP: Number.isNaN(parsedSaldo) ? 0 : parsedSaldo,
      ultimaMovimentacaoSAP: movRaw || undefined,
    });
  }

  if (rows.length === 0) {
    throw new Error('Nenhum registro com SKU válido foi encontrado na Base Contábil (ERP).');
  }

  if (skippedNoSku > 0) {
    warnings.push(`${skippedNoSku} linha(s) sem SKU foram ignoradas durante a leitura.`);
  }
  if (invalidNumbersCount > 0) {
    warnings.push(
      `${invalidNumbersCount} linha(s) continham valores numéricos inválidos em Custo ou Saldo ERP e foram tratadas como 0.`
    );
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    rows,
    rawRowCount: nonEmptyRecords.length,
    detectedColumns: headers,
    warnings,
  };
}

export async function parsePhysicalFile(file: File): Promise<ParsedFileResult<PhysicalRow>> {
  const { headers, records } = await readSpreadsheetRaw(file);
  if (headers.length === 0) {
    throw new Error('Não encontramos cabeçalhos na primeira linha da Contagem Física.');
  }

  const colMap = resolveColumnMap(headers, PHYSICAL_FIELD_ALIASES);
  const missing: string[] = [];
  if (!colMap.sku) missing.push('SKU');
  if (!colMap.qtdContada) missing.push('Qtd_Contada');

  if (missing.length > 0) {
    throw new Error(
      `Coluna(s) obrigatória(s) ausente(s) na Contagem Física: ${missing.join(', ')}. ` +
        `Colunas encontradas no arquivo: ${headers.join(', ')}.`
    );
  }

  const nonEmptyRecords = records.filter((r) => !isCompletelyBlankRecord(r));
  if (nonEmptyRecords.length === 0) {
    throw new Error(
      'A planilha contém apenas o cabeçalho (0 registros). Preencha os dados reais antes de importar.'
    );
  }

  const warnings: string[] = [];
  const rows: PhysicalRow[] = [];
  let skippedNoSku = 0;
  let invalidNumbersCount = 0;

  for (const rec of nonEmptyRecords) {
    const skuRaw = String(rec[colMap.sku!] ?? '').trim();
    if (!skuRaw) {
      skippedNoSku += 1;
      continue;
    }

    const localizacaoRaw = colMap.localizacao ? String(rec[colMap.localizacao] ?? '').trim() : '';
    const responsavelRaw = colMap.responsavelContagem
      ? String(rec[colMap.responsavelContagem] ?? '').trim()
      : '';
    const obsRaw = colMap.observacao ? String(rec[colMap.observacao] ?? '').trim() : '';

    const parsedQtd = parseLocalizedNumber(rec[colMap.qtdContada!]);
    if (Number.isNaN(parsedQtd)) {
      invalidNumbersCount += 1;
    }

    rows.push({
      sku: skuRaw,
      qtdContada: Number.isNaN(parsedQtd) ? 0 : parsedQtd,
      localizacao: localizacaoRaw || 'Não informada',
      responsavelContagem: responsavelRaw || 'Não informado',
      observacao: obsRaw || undefined,
    });
  }

  if (rows.length === 0) {
    throw new Error('Nenhum registro com SKU válido foi encontrado na Contagem Física.');
  }

  if (skippedNoSku > 0) {
    warnings.push(`${skippedNoSku} linha(s) sem SKU foram ignoradas durante a leitura.`);
  }
  if (invalidNumbersCount > 0) {
    warnings.push(
      `${invalidNumbersCount} linha(s) continham quantidade contada inválida e foram tratadas como 0.`
    );
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    rows,
    rawRowCount: nonEmptyRecords.length,
    detectedColumns: headers,
    warnings,
  };
}

function triggerCsvDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Gera e faz download de dois modelos CSV vazios contendo exclusivamente os cabeçalhos estruturados.
 */
export function downloadLayoutTemplates(): void {
  const erpHeader = '\uFEFFSKU,Descricao,Categoria,Custo_Unitario,Saldo_ERP,Ultima_Movimentacao_SAP\r\n';
  const physicalHeader = '\uFEFFSKU,Qtd_Contada,Localizacao,Responsavel_Contagem,Observacao\r\n';

  triggerCsvDownload('modelo_erp_sap.csv', erpHeader);
  window.setTimeout(() => {
    triggerCsvDownload('modelo_contagem_fisica.csv', physicalHeader);
  }, 250);
}

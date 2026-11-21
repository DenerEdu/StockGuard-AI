export interface ERPRow {
  sku: string;
  descricao: string;
  categoria: string;
  custoUnitario: number;
  saldoERP: number;
  ultimaMovimentacaoSAP?: string;
}

export interface PhysicalRow {
  sku: string;
  qtdContada: number;
  localizacao: string;
  responsavelContagem: string;
  observacao?: string;
}

export interface ParsedFileResult<T> {
  fileName: string;
  fileSize: number;
  rows: T[];
  rawRowCount: number;
  detectedColumns: string[];
  warnings: string[];
}

export type CurvaABC = 'A' | 'B' | 'C';

export type DivergenceStatus = 'quebra' | 'sobra' | 'acurado';

export type RiskLevel = 'Baixo' | 'Médio' | 'Crítico';

export interface ReconciledItem {
  sku: string;
  descricao: string;
  categoria: string;
  custoUnitario: number;
  saldoERP: number;
  qtdContada: number;
  divergenciaQtd: number;
  valorERP: number;
  valorFisico: number;
  impactoFinanceiro: number;
  impactoAbsoluto: number;
  curvaABC: CurvaABC;
  percentualAcumulado: number;
  status: DivergenceStatus;
  isCritico: boolean;
  localizacao: string;
  responsavelContagem: string;
  ultimaMovimentacaoSAP?: string;
  observacao?: string;
  ausenteNaContagem?: boolean;
  ausenteNoERP?: boolean;
}

export type HealthLevel = 'Excelente' | 'Atenção' | 'Crítico';

export interface AuditKPIs {
  totalSKUs: number;
  itensAcurados: number;
  itensQuebra: number;
  itensSobra: number;
  acuracidadeGeral: number;
  impactoFinanceiroLiquido: number;
  totalQuebrasFinanceiro: number;
  totalSobrasFinanceiro: number;
  itensCriticos: number;
  valorTotalAuditado: number;
  valorTotalFisico: number;
  totalUnidadesERP: number;
  totalUnidadesFisico: number;
  saudeNivel: HealthLevel;
}

export interface ABCDistributionEntry {
  curva: CurvaABC;
  skuCount: number;
  valorTotal: number;
  percentualValor: number;
  divergenciasCount: number;
  impactoAbsoluto: number;
  impactoLiquido: number;
}

export type ABCDistribution = ABCDistributionEntry[];

export interface AuditResult {
  reportCode: string;
  generatedAt: string;
  erpFileName: string;
  physicalFileName: string;
  items: ReconciledItem[];
  kpis: AuditKPIs;
  topDivergences: ReconciledItem[];
  abcDistribution: ABCDistribution;
}

export interface AIDiagnostic {
  sku: string;
  hipotesePrincipal: string;
  nivelRisco: RiskLevel;
  justificativaRisco: string;
  planoAcao: [string, string, string];
  padraoDetectado: string;
  fonte: 'gemini' | 'openai' | 'local';
  geradoEm: string;
  avisoFallback?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIConfig {
  provider: 'local' | 'gemini' | 'openai';
  apiKey: string;
  model: string;
}

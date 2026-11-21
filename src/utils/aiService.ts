import type {
  AIConfig,
  AIDiagnostic,
  AuditResult,
  ChatMessage,
  ReconciledItem,
  RiskLevel,
} from '../types/audit';
import { formatBRL, formatNumber, formatSignedNumber } from './formatters';

interface SAPMovementInfo {
  code: string;
  label: string;
  meaning: string;
}

const SAP_MOVEMENT_DICT: Record<string, SAPMovementInfo> = {
  '101': {
    code: '101',
    label: 'Entrada de mercadoria c/ pedido de compras (MIGO)',
    meaning: 'recebimento de fornecedor vinculado a pedido de compra',
  },
  '102': {
    code: '102',
    label: 'Estorno de entrada de mercadoria',
    meaning: 'cancelamento ou reversão de recebimento de compra',
  },
  '122': {
    code: '122',
    label: 'Devolução ao fornecedor',
    meaning: 'saída física/contábil por devolução de mercadoria ao fornecedor',
  },
  '201': {
    code: '201',
    label: 'Consumo para centro de custo',
    meaning: 'requisição interna / baixa de material para centro de custo',
  },
  '202': {
    code: '202',
    label: 'Estorno de consumo para centro de custo',
    meaning: 'retorno ao estoque de material anteriormente baixado em centro de custo',
  },
  '261': {
    code: '261',
    label: 'Saída para ordem de produção',
    meaning: 'consumo de matéria-prima ou componente em ordem de produção',
  },
  '262': {
    code: '262',
    label: 'Estorno de saída para ordem de produção',
    meaning: 'devolução de componente de ordem de produção para o estoque',
  },
  '301': {
    code: '301',
    label: 'Transferência entre centros',
    meaning: 'movimentação de estoque entre plantas/filiais distintas',
  },
  '311': {
    code: '311',
    label: 'Transferência entre depósitos',
    meaning: 'mudança de depósito/armazém dentro do mesmo centro',
  },
  '551': {
    code: '551',
    label: 'Baixa por sucata / avaria',
    meaning: 'eliminação contábil por perda, vencimento ou dano físico',
  },
  '561': {
    code: '561',
    label: 'Carga inicial de estoque',
    meaning: 'implantação inicial ou ajuste de saldo de abertura',
  },
  '601': {
    code: '601',
    label: 'Saída de mercadoria para remessa de vendas',
    meaning: 'expedição e faturamento de pedido ao cliente',
  },
  '602': {
    code: '602',
    label: 'Estorno de saída de remessa de vendas',
    meaning: 'reversão de expedição ou cancelamento logístico de entrega',
  },
  '701': {
    code: '701',
    label: 'Ajuste de inventário positivo',
    meaning: 'lançamento contábil de sobra apurada em inventário anterior',
  },
  '702': {
    code: '702',
    label: 'Ajuste de inventário negativo',
    meaning: 'lançamento contábil de quebra/falta apurada em inventário anterior',
  },
};

function extractSapMovement(raw?: string): SAPMovementInfo | null {
  if (!raw) return null;
  const match = raw.match(/\b(\d{3})\b/);
  if (!match) return null;
  const code = match[1];
  return (
    SAP_MOVEMENT_DICT[code] || {
      code,
      label: `Movimento SAP ${code}`,
      meaning: `operação logística registrada sob código ${code}`,
    }
  );
}

function detectPackagingMultiple(absDiff: number): number | null {
  if (!Number.isInteger(absDiff) || absDiff < 6) return null;
  const factors = [100, 50, 24, 12, 10, 6];
  for (const factor of factors) {
    if (absDiff % factor === 0) {
      return factor;
    }
  }
  return null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface ObservationSignal {
  tag: string;
  insight: string;
  action: string;
}

function analyzeObservation(obs?: string): ObservationSignal | null {
  if (!obs?.trim()) return null;
  const norm = normalizeText(obs);

  if (/(avaria|quebra|danific|amassad|molhad|vencid|validade)/.test(norm)) {
    return {
      tag: 'Avaria / Segregação Física',
      insight: `A equipe de contagem registrou ocorrência de avaria/validade ("${obs}"), indicando provável segregação física sem baixa ou transferência para depósito de bloqueio.`,
      action:
        'Inspecionar área de quarentena/avarias e formalizar baixa por sucata (SAP 551) ou bloqueio de lote caso os itens estejam impróprios para venda.',
    };
  }
  if (/(caixa|embalagem|fardo|pallet|palete|fechad|unid)/.test(norm)) {
    return {
      tag: 'Conversão de Unidade / Embalagem',
      insight: `A observação de campo ("${obs}") aponta risco de divergência entre fator de conversão de embalagem master e unidade base do ERP.`,
      action:
        'Validar fator de conversão na aba Dados Básicos / Unidades de Medida do cadastro de materiais (MM03) e recontar desmembrando caixas fechadas.',
    };
  }
  if (/(nota|nf|nfe|fatur|remessa|expedi|separad|pendente)/.test(norm)) {
    return {
      tag: 'Corte Documental (Cut-off NF-e)',
      insight: `A anotação ("${obs}") sugere descasamento temporal (cut-off) entre movimentação física no doca/expedição e emissão ou estorno de NF-e.`,
      action:
        'Auditar notas fiscais emitidas/recebidas nas últimas 48h e confirmar se houve faturamento sem saída física ou recebimento sem entrada fiscal.',
    };
  }
  if (/(etiqueta|trocad|codigo|cod|identific|mistur)/.test(norm)) {
    return {
      tag: 'Identificação / Troca de SKU',
      insight: `O apontamento ("${obs}") indica possível inversão de etiquetas ou armazenagem cruzada entre SKUs semelhantes na mesma rua/posição.`,
      action:
        'Verificar SKUs correlatos da mesma família/corredor com divergência de sinal oposto para confirmar eventual compensação cruzada.',
    };
  }
  if (/(bloquead|quarentena|emprest|amostra|devoluc)/.test(norm)) {
    return {
      tag: 'Estoque em Trânsito / Terceiros / Quarentena',
      insight: `A observação ("${obs}") evidencia movimentação fora do fluxo padrão de prateleira (quarentena, amostra, empréstimo ou devolução em análise).`,
      action:
        'Cruzar saldos em depósitos especiais/bloqueados (MMBE) e validar termos de saída ou devolução pendentes de regularização sistêmica.',
    };
  }

  return {
    tag: 'Apontamento de Campo Registrado',
    insight: `A contagem trouxe a observação "${obs}", que deve ser confrontada com o histórico de movimentação do endereço ${''}.`.trim(),
    action: `Entrevistar o conferente responsável pela anotação ("${obs}") e confrontar com o log de transações recentes do SKU.`,
  };
}

function classifyRisk(item: ReconciledItem): { level: RiskLevel; justification: string } {
  if (item.divergenciaQtd === 0) {
    return {
      level: 'Baixo',
      justification:
        'Saldo físico integralmente alinhado ao saldo contábil do ERP, sem exposição financeira.',
    };
  }

  const relativeError =
    item.saldoERP > 0 ? Math.abs(item.divergenciaQtd) / item.saldoERP : 1;

  if (
    item.isCritico ||
    item.impactoAbsoluto >= 5000 ||
    (relativeError >= 0.25 && item.impactoAbsoluto >= 1000)
  ) {
    const reasons: string[] = [];
    if (item.isCritico) reasons.push('item pertencente à Curva A (alta representatividade)');
    if (item.impactoAbsoluto >= 5000) {
      reasons.push(`impacto financeiro elevado (${formatBRL(item.impactoAbsoluto)})`);
    }
    if (relativeError >= 0.25 && item.saldoERP > 0) {
      reasons.push(`desvio percentual expressivo (${Math.round(relativeError * 100)}% do saldo ERP)`);
    }
    return {
      level: 'Crítico',
      justification: `Classificação crítica devido a ${reasons.join(' e ')}. Exige validação imediata antes de qualquer ajuste contábil.`,
    };
  }

  if (item.curvaABC === 'B' || item.impactoAbsoluto >= 500) {
    return {
      level: 'Médio',
      justification: `Item da Curva ${item.curvaABC} com impacto de ${formatBRL(item.impactoAbsoluto)}, requerendo apuração documental antes da aprovação do ajuste.`,
    };
  }

  return {
    level: 'Baixo',
    justification: `Item de Curva ${item.curvaABC} com impacto material restrito (${formatBRL(item.impactoAbsoluto)}), adequado para tratamento no fluxo rotineiro de conciliação.`,
  };
}

export function generateLocalDiagnostic(item: ReconciledItem): AIDiagnostic {
  const { level: nivelRisco, justification: justificativaRisco } = classifyRisk(item);
  const now = new Date().toISOString();

  if (item.divergenciaQtd === 0) {
    return {
      sku: item.sku,
      hipotesePrincipal: `Item 100% acurado entre o saldo contábil do ERP (${formatNumber(item.saldoERP)} un.) e a contagem física no endereço ${item.localizacao}. Não há indício de erro de corte documental, falha de apontamento ou perda operacional.`,
      nivelRisco: 'Baixo',
      justificativaRisco,
      padraoDetectado: 'Conformidade Integral ERP × Físico',
      planoAcao: [
        `Manter frequência de contagem cíclica alinhada à Curva ${item.curvaABC} para preservar o nível de acuracidade.`,
        `Validar integridade de etiquetagem e endereçamento padrão (${item.localizacao}) em inspeções amostrais.`,
        'Registrar aprovação de conformidade no dossiê de auditoria sem necessidade de lançamento de ajuste.',
      ],
      fonte: 'local',
      geradoEm: now,
    };
  }

  const sapMov = extractSapMovement(item.ultimaMovimentacaoSAP);
  const obsSignal = analyzeObservation(item.observacao);
  const absDiff = Math.abs(item.divergenciaQtd);
  const packFactor = detectPackagingMultiple(absDiff);
  const isFalta = item.status === 'quebra';

  const padroes: string[] = [];
  const hipoteses: string[] = [];
  const acoes: string[] = [];

  if (item.ausenteNaContagem || (item.qtdContada === 0 && item.saldoERP > 0)) {
    padroes.push('SKU Ausente na Contagem Física');
    hipoteses.push(
      `O ERP aponta saldo de ${formatNumber(item.saldoERP)} unidades (${formatBRL(item.valorERP)}), porém nenhuma unidade foi localizada na contagem física. Esse padrão ocorre tipicamente quando há transferência física para outro endereço/doca sem registro no sistema, baixa operacional não apontada ou erro de endereçamento no inventário.`
    );
    acoes.push(
      'Executar varredura física nos endereços adjacentes, docas de expedição, recebimento e área de quarentena antes de assumir perda total.'
    );
  } else if (item.ausenteNoERP) {
    padroes.push('Sobra Física sem Cadastro/Saldo ERP');
    hipoteses.push(
      `Foram contabilizadas ${formatNumber(item.qtdContada)} unidades fisicamente em ${item.localizacao}, sem saldo correspondente na base contábil exportada do ERP. Indica recebimento físico sem entrada fiscal (MIGO/101), retorno de cliente sem NF-e de devolução ou troca de código SKU na etiquetagem.`
    );
    acoes.push(
      'Verificar notas fiscais de entrada/devolução pendentes de lançamento no recebimento e conferir se o código físico corresponde exatamente ao cadastro do ERP.'
    );
  }

  if (sapMov) {
    padroes.push(`Movimento SAP ${sapMov.code}`);
    if (sapMov.code === '601' && !isFalta) {
      hipoteses.push(
        `A última movimentação SAP registrada foi ${sapMov.code} (${sapMov.label}), combinada com sobra física de ${formatSignedNumber(item.divergenciaQtd)} un. Forte indício de remessa faturada/baixada no sistema cuja mercadoria permaneceu fisicamente no galpão (corte de expedição ou carregamento parcial).`
      );
      acoes.push(
        `Auditar remessas recentes na transação VL03N/MB51 com movimento 601 para confirmar se houve retenção de carga ou necessidade de estorno (movimento 602).`
      );
    } else if (sapMov.code === '601' && isFalta) {
      hipoteses.push(
        `Associado ao movimento SAP ${sapMov.code} (${sapMov.label}), a quebra de ${formatNumber(absDiff)} un. sugere expedição em duplicidade, erro de picking (separação a maior para cliente) ou saída emergencial sem geração de remessa.`
      );
      acoes.push(
        `Conferir romaneios de embarque e pesagem/conferência de saída vinculados às últimas remessas de vendas (movimento 601) na MB51.`
      );
    } else if ((sapMov.code === '101' || sapMov.code === '102') && !isFalta) {
      hipoteses.push(
        `Com histórico recente de ${sapMov.code} (${sapMov.label}), a sobra de ${formatNumber(absDiff)} un. aponta recebimento físico de fornecedor em quantidade superior à NF-e, estorno indevido (102) ou entrada ainda pendente de confirmação contábil.`
      );
      acoes.push(
        'Confrontar pedido de compra e XML da NF-e de entrada na MIGO/MB51 para verificar divergência de recebimento ou estorno de entrada (102).'
      );
    } else if ((sapMov.code === '101' || sapMov.code === '102') && isFalta) {
      hipoteses.push(
        `Diante do último movimento SAP ${sapMov.code} (${sapMov.label}), a falta de ${formatNumber(absDiff)} un. indica possível lançamento integral de NF-e no recebimento (MIGO 101) com entrega física parcial ou desvio no armazenamento pós-doca.`
      );
      acoes.push(
        'Auditar o comprovante de recebimento físico (conferência cega da portaria/doca) contra a NF-e lançada no movimento 101.'
      );
    } else if (sapMov.code === '201' || sapMov.code === '261') {
      hipoteses.push(
        `O último registro SAP ${sapMov.code} (${sapMov.label}) sinaliza fluxo de consumo interno/produtivo. A divergência de ${formatSignedNumber(item.divergenciaQtd)} un. decorre frequentemente de retirada ou devolução física sem o devido apontamento de consumo ou estorno (${sapMov.code === '201' ? '202' : '262'}).`
      );
      acoes.push(
        `Cruzar requisições internas e ordens de produção recentes na MB51 (movimentos ${sapMov.code}/${sapMov.code === '201' ? '202' : '262'}) com os apontamentos da equipe solicitante.`
      );
    } else if (sapMov.code === '301' || sapMov.code === '311') {
      hipoteses.push(
        `O movimento SAP ${sapMov.code} (${sapMov.label}) indica transferência de estoque recente. A diferença de ${formatSignedNumber(item.divergenciaQtd)} un. aponta provável estoque em trânsito entre depósitos ou erro na origem/destino da transferência.`
      );
      acoes.push(
        `Verificar saldos nos depósitos paralelos/em trânsito (MMBE e MB52) e rastrear documentos de transferência ${sapMov.code} não concluídos.`
      );
    } else if (sapMov.code === '701' || sapMov.code === '702') {
      hipoteses.push(
        `Consta ajuste prévio de inventário (${sapMov.code} — ${sapMov.label}), evidenciando reincidência de falha de acuracidade no SKU ou ajuste anterior efetuado sobre saldo incorreto (contagem precipitada sem cut-off).`
      );
      acoes.push(
        'Reconstruir o kardex completo do item na MB51 a partir do último inventário (movimento 701/702) para identificar o ponto exato de desvio.'
      );
    } else {
      hipoteses.push(
        `A última movimentação SAP informada (${sapMov.code} — ${sapMov.label}) deve ser auditada no corte temporal do inventário para verificar se houve ${sapMov.meaning} durante a janela de contagem física.`
      );
    }
  }

  if (packFactor !== null) {
    padroes.push(`Múltiplo Exato de ${packFactor} un.`);
    hipoteses.push(
      `A diferença exata de ${formatNumber(absDiff)} unidades é múltipla inteira de ${packFactor} (${absDiff / packFactor}x ${packFactor}), padrão clássico de erro de contagem por caixa master/fardo fechado ou descasamento de unidade de medida (UN × CX) entre o coletor e o ERP.`
    );
    acoes.push(
      `Realizar recontagem cega confirmando a embalagem padrão do SKU (múltiplo de ${packFactor} un.) e validar o fator de conversão no cadastro de materiais.`
    );
  }

  if (obsSignal) {
    padroes.push(obsSignal.tag);
    hipoteses.push(obsSignal.insight);
    acoes.push(obsSignal.action);
  }

  if (hipoteses.length === 0) {
    padroes.push(isFalta ? 'Quebra Operacional / Corte' : 'Sobra Não Conciliada');
    hipoteses.push(
      isFalta
        ? `A quebra física de ${formatNumber(absDiff)} unidades (${formatBRL(item.impactoFinanceiro)}) em ${item.localizacao} sugere saída operacional sem baixa sistêmica, erro de separação (picking) ou troca de endereçamento com SKU similar.`
        : `A sobra física de ${formatNumber(absDiff)} unidades (${formatBRL(item.impactoFinanceiro, true)}) em ${item.localizacao} aponta entrada não contabilizada, devolução sem lançamento ou divergência de corte entre faturamento e expedição.`
    );
  }

  // Garantir sempre 3 passos claros e distintos
  const defaultSteps = [
    `Executar recontagem física cega no endereço ${item.localizacao} (e posições adjacentes) com dupla conferência independente.`,
    'Extrair razão/kardex de movimentações (MB51) dos últimos 15 dias verificando notas fiscais, transferências e estornos na janela de corte do inventário.',
    isFalta
      ? `Submeter parecer à Controladoria antes de efetivar ajuste contábil de baixa (${formatBRL(item.impactoFinanceiro)}) e atualizar trava de conferência do SKU.`
      : `Confirmar titularidade contábil das unidades excedentes antes de efetivar ajuste positivo (${formatBRL(item.impactoFinanceiro, true)}) para evitar duplicidade fiscal.`,
  ];

  for (const step of defaultSteps) {
    if (acoes.length >= 3) break;
    if (!acoes.includes(step)) {
      acoes.push(step);
    }
  }

  return {
    sku: item.sku,
    hipotesePrincipal: hipoteses.slice(0, 2).join(' '),
    nivelRisco,
    justificativaRisco,
    padraoDetectado: padroes.slice(0, 2).join(' • ') || (isFalta ? 'Quebra de Inventário' : 'Sobra de Inventário'),
    planoAcao: [acoes[0], acoes[1], acoes[2]],
    fonte: 'local',
    geradoEm: now,
  };
}

function buildDiagnosticPrompt(item: ReconciledItem, audit: AuditResult): string {
  return `Você é um Auditor Sênior de Controladoria e Supply Chain (especialista em ERP/SAP e acuracidade de inventário).
Analise o seguinte item de inventário em Português (PT-BR) e retorne EXATAMENTE um JSON válido com as chaves:
{
  "hipotesePrincipal": "string detalhada e técnica explicando a causa raiz provável",
  "nivelRisco": "Baixo" | "Médio" | "Crítico",
  "justificativaRisco": "string curta justificando o risco contábil",
  "padraoDetectado": "string curta de 3 a 6 palavras com o padrão principal",
  "planoAcao": ["passo 1 prático", "passo 2 prático", "passo 3 prático"]
}

Dados do SKU auditado:
- SKU: ${item.sku}
- Descrição: ${item.descricao}
- Categoria: ${item.categoria}
- Curva ABC: ${item.curvaABC}
- Custo Unitário: ${formatBRL(item.custoUnitario)}
- Saldo ERP: ${item.saldoERP}
- Quantidade Contada (Físico): ${item.qtdContada}
- Divergência (Qtd): ${item.divergenciaQtd}
- Impacto Financeiro: ${formatBRL(item.impactoFinanceiro, true)}
- Status: ${item.status}
- Localização Física: ${item.localizacao}
- Responsável pela Contagem: ${item.responsavelContagem}
- Última Movimentação SAP: ${item.ultimaMovimentacaoSAP || 'Não informada'}
- Observação da Contagem: ${item.observacao || 'Nenhuma'}
- Contexto geral da auditoria: ${audit.kpis.totalSKUs} SKUs auditados, acuracidade geral de ${audit.kpis.acuracidadeGeral}%, impacto líquido de ${formatBRL(audit.kpis.impactoFinanceiroLiquido, true)}.`;
}

function parseAIJsonResponse(rawText: string, item: ReconciledItem, fonte: 'gemini' | 'openai'): AIDiagnostic {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as {
    hipotesePrincipal?: string;
    nivelRisco?: string;
    justificativaRisco?: string;
    padraoDetectado?: string;
    planoAcao?: string[];
  };

  const localFallback = generateLocalDiagnostic(item);
  const riscoRaw = (parsed.nivelRisco || '').trim();
  const nivelRisco: RiskLevel =
    riscoRaw === 'Crítico' || riscoRaw === 'Médio' || riscoRaw === 'Baixo'
      ? riscoRaw
      : localFallback.nivelRisco;

  const steps = Array.isArray(parsed.planoAcao)
    ? parsed.planoAcao.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return {
    sku: item.sku,
    hipotesePrincipal: parsed.hipotesePrincipal?.trim() || localFallback.hipotesePrincipal,
    nivelRisco,
    justificativaRisco: parsed.justificativaRisco?.trim() || localFallback.justificativaRisco,
    padraoDetectado: parsed.padraoDetectado?.trim() || localFallback.padraoDetectado,
    planoAcao: [
      steps[0] || localFallback.planoAcao[0],
      steps[1] || localFallback.planoAcao[1],
      steps[2] || localFallback.planoAcao[2],
    ],
    fonte,
    geradoEm: new Date().toISOString(),
  };
}

export async function generateItemDiagnostic(
  item: ReconciledItem,
  audit: AuditResult,
  config: AIConfig
): Promise<AIDiagnostic> {
  if (config.provider === 'local' || !config.apiKey.trim()) {
    return generateLocalDiagnostic(item);
  }

  const prompt = buildDiagnosticPrompt(item, audit);

  try {
    if (config.provider === 'gemini') {
      const model = config.model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini HTTP ${response.status}: ${errBody.slice(0, 140)}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Resposta vazia da API Gemini.');
      }
      return parseAIJsonResponse(text, item, 'gemini');
    }

    if (config.provider === 'openai') {
      const model = config.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Você é um Auditor Sênior de Estoque e Controladoria. Responda estritamente em JSON válido em Português do Brasil.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${errBody.slice(0, 140)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Resposta vazia da API OpenAI.');
      }
      return parseAIJsonResponse(text, item, 'openai');
    }
  } catch (err) {
    const local = generateLocalDiagnostic(item);
    const msg = err instanceof Error ? err.message : 'Falha de conexão com a API';
    return {
      ...local,
      avisoFallback: `Não foi possível consultar a API externa (${msg}). Diagnóstico gerado pelo Motor Analítico Local.`,
    };
  }

  return generateLocalDiagnostic(item);
}

function generateLocalChatReply(
  item: ReconciledItem,
  audit: AuditResult,
  diagnostic: AIDiagnostic,
  userMessage: string
): string {
  const q = normalizeText(userMessage);

  // 1. E-mail formal cobrando explicação do supervisor/responsável
  if (/(email|e-mail|mensagem|cobrar|cobranca|notificar|comunicar|supervisor|gerente)/.test(q)) {
    const tipo =
      item.status === 'quebra'
        ? 'Quebra (Falta)'
        : item.status === 'sobra'
          ? 'Sobra'
          : 'Conformidade';
    return [
      `Assunto: [Auditoria ${audit.reportCode}] Esclarecimento de Divergência — SKU ${item.sku} (${item.descricao})`,
      '',
      `Prezado(a) Supervisor(a) de Operações / ${item.responsavelContagem !== 'Não informado' ? item.responsavelContagem : 'Responsável pelo Galpão'},`,
      '',
      `Durante a conciliação oficial do inventário (${audit.reportCode}), identificamos uma divergência de ${tipo} classificada como Risco ${diagnostic.nivelRisco} no item abaixo:`,
      `• SKU / Produto: ${item.sku} — ${item.descricao} (Curva ${item.curvaABC})`,
      `• Endereço / Localização: ${item.localizacao}`,
      `• Saldo Contábil (ERP): ${formatNumber(item.saldoERP)} un. | Contagem Física: ${formatNumber(item.qtdContada)} un.`,
      `• Divergência Apurada: ${formatSignedNumber(item.divergenciaQtd)} un. | Impacto Financeiro: ${formatBRL(item.impactoFinanceiro, true)}`,
      item.ultimaMovimentacaoSAP ? `• Última Movimentação SAP: ${item.ultimaMovimentacaoSAP}` : null,
      item.observacao ? `• Observação de Campo: ${item.observacao}` : null,
      '',
      `Diagnóstico preliminar da Auditoria: ${diagnostic.hipotesePrincipal}`,
      '',
      'Solicitamos retorno formal com as evidências das seguintes verificações até o fechamento do turno:',
      `1. ${diagnostic.planoAcao[0]}`,
      `2. ${diagnostic.planoAcao[1]}`,
      `3. ${diagnostic.planoAcao[2]}`,
      '',
      'Atenciosamente,',
      'Equipe de Auditoria de Inventário & Controladoria — StockGuard AI',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  // 2. Transações SAP / ERP
  if (/(sap|transacao|transacoes|mb51|migo|mmbe|mi04|vl03n|sistema|kardex)/.test(q)) {
    const sapMov = extractSapMovement(item.ultimaMovimentacaoSAP);
    return [
      `Roteiro de Transações SAP recomendadas para o SKU ${item.sku}:`,
      '',
      `1. MB51 (Lista de Documentos de Material): filtrar pelo material ${item.sku} nos últimos 30 dias para auditar a sequência de entradas, saídas e estornos${sapMov ? `, com foco no movimento ${sapMov.code} (${sapMov.label})` : ''}.`,
      `2. MMBE / MB52 (Visão de Estoque): confirmar se há saldo preso em "Estoque Bloqueado", "Em Controle de Qualidade" ou em depósito paralelo fora de ${item.localizacao}.`,
      `3. MI20 / MI04 (Documento de Inventário): conferir se o lançamento da contagem cega foi registrado na unidade de medida correta antes da aprovação na MI07.`,
      item.status === 'sobra'
        ? '4. MIGO / MIRO: verificar recebimentos físicos que ainda não tiveram entrada fiscal concluída.'
        : '4. VL03N / CO03: validar remessas de expedição (601) ou ordens de produção (261) em aberto na data de corte.',
    ].join('\n');
  }

  // 3. Roteiro de recontagem cega
  if (/(recont|cega|passo|check|auditar|galpao|campo|endereco|conferir)/.test(q)) {
    return [
      `Checklist de Recontagem Cega — SKU ${item.sku} (${item.descricao}):`,
      '',
      `• Ponto focal: ${item.localizacao} (Responsável anterior: ${item.responsavelContagem}).`,
      `• Regra cega: ocultar o saldo contábil do ERP (${formatNumber(item.saldoERP)} un.) na ficha do segundo conferente para eliminar viés de confirmação.`,
      `• Conferência de embalagem: verificar se há caixas fechadas, paletes mistos ou lotes vencidos/avariados separados.`,
      `• Varredura periférica: inspecionar posições vizinhas, pulmão aéreo e área de devolução/quarentena.`,
      `• Meta de convergência: justificar a diferença de ${formatSignedNumber(item.divergenciaQtd)} un. (${formatBRL(item.impactoFinanceiro, true)}) antes da liberação na Controladoria.`,
    ].join('\n');
  }

  // 4. Impacto contábil / percentual / financeiro
  if (/(impacto|contabil|percentual|reais|valor|ajuste|dre|balanco|custo)/.test(q)) {
    const totalAbsImpact = audit.items.reduce((s, i) => s + i.impactoAbsoluto, 0);
    const shareOfDivergence =
      totalAbsImpact > 0 ? ((item.impactoAbsoluto / totalAbsImpact) * 100).toFixed(1) : '0,0';
    return [
      `Análise Contábil e Financeira — SKU ${item.sku}:`,
      '',
      `• Valor contábil no ERP: ${formatBRL(item.valorERP)} (${formatNumber(item.saldoERP)} un. × ${formatBRL(item.custoUnitario)})`,
      `• Valor apurado no físico: ${formatBRL(item.valorFisico)} (${formatNumber(item.qtdContada)} un. × ${formatBRL(item.custoUnitario)})`,
      `• Impacto líquido do SKU: ${formatBRL(item.impactoFinanceiro, true)} (representa ${shareOfDivergence.replace('.', ',')}% do volume financeiro total das divergências desta auditoria).`,
      `• Enquadramento ABC: Curva ${item.curvaABC} | Risco Contábil: ${diagnostic.nivelRisco}.`,
      item.divergenciaQtd !== 0
        ? `• Recomendação contábil: ${diagnostic.nivelRisco === 'Crítico' ? 'reter lançamento de ajuste até conclusão da recontagem cega e validação documental com assinatura gerencial.' : 'validar documentação suporte e aprovar ajuste dentro da alçada da Controladoria.'}`
        : '• Recomendação contábil: nenhum ajuste financeiro necessário.',
    ].join('\n');
  }

  // 5. Resposta analítica geral contextualizada
  return [
    `Parecer contextualizado para o SKU ${item.sku} (${item.descricao}):`,
    '',
    `Considerando que este item pertence à Curva ${item.curvaABC}, apresenta divergência de ${formatSignedNumber(item.divergenciaQtd)} un. (${formatBRL(item.impactoFinanceiro, true)}) no endereço ${item.localizacao} e nível de risco ${diagnostic.nivelRisco}:`,
    '',
    `• Padrão identificado: ${diagnostic.padraoDetectado}.`,
    `• Síntese diagnóstica: ${diagnostic.hipotesePrincipal}`,
    `• Próximo passo imediato recomendado: ${diagnostic.planoAcao[0]}`,
    '',
    'Dica: você pode solicitar um "e-mail formal para o supervisor", um "checklist de recontagem cega" ou as "transações SAP para conferir".',
  ].join('\n');
}

export async function askItemCopilot(
  item: ReconciledItem,
  audit: AuditResult,
  diagnostic: AIDiagnostic,
  history: ChatMessage[],
  userMessage: string,
  config: AIConfig
): Promise<string> {
  if (config.provider === 'local' || !config.apiKey.trim()) {
    return generateLocalChatReply(item, audit, diagnostic, userMessage);
  }

  const systemContext = `Você é o Copiloto Auditor da plataforma StockGuard AI. Responda em Português (PT-BR), de forma objetiva, executiva e prática, usando apenas os dados reais fornecidos abaixo.

Contexto do SKU:
- SKU: ${item.sku} | Descrição: ${item.descricao} | Categoria: ${item.categoria}
- Curva ABC: ${item.curvaABC} | Custo Unitário: ${formatBRL(item.custoUnitario)}
- Saldo ERP: ${item.saldoERP} | Físico: ${item.qtdContada} | Divergência: ${item.divergenciaQtd}
- Impacto Financeiro: ${formatBRL(item.impactoFinanceiro, true)} | Status: ${item.status}
- Localização: ${item.localizacao} | Responsável: ${item.responsavelContagem}
- Última Movimentação SAP: ${item.ultimaMovimentacaoSAP || 'Não informada'}
- Observação: ${item.observacao || 'Nenhuma'}
- Diagnóstico prévio (${diagnostic.nivelRisco}): ${diagnostic.hipotesePrincipal}
- Plano de Ação: 1) ${diagnostic.planoAcao[0]} 2) ${diagnostic.planoAcao[1]} 3) ${diagnostic.planoAcao[2]}
- Relatório: ${audit.reportCode} | Acuracidade geral: ${audit.kpis.acuracidadeGeral}%`;

  try {
    if (config.provider === 'gemini') {
      const model = config.model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;

      const contents = [
        { role: 'user', parts: [{ text: systemContext }] },
        ...history.slice(-6).map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.35 },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    }

    if (config.provider === 'openai') {
      const model = config.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          messages: [
            { role: 'system', content: systemContext },
            ...history.slice(-6).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    }
  } catch {
    return generateLocalChatReply(item, audit, diagnostic, userMessage);
  }

  return generateLocalChatReply(item, audit, diagnostic, userMessage);
}

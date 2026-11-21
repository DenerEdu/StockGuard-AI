import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  MapPin,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  AIConfig,
  AIDiagnostic,
  AuditResult,
  ChatMessage,
  ReconciledItem,
} from '../types/audit';
import { askItemCopilot, generateItemDiagnostic } from '../utils/aiService';
import { formatBRL, formatNumber, formatSignedNumber } from '../utils/formatters';

interface AICopilotDrawerProps {
  item: ReconciledItem | null;
  audit: AuditResult;
  aiConfig: AIConfig;
  diagnostic?: AIDiagnostic;
  chatHistory: ChatMessage[];
  onClose: () => void;
  onSaveDiagnostic: (sku: string, diagnostic: AIDiagnostic) => void;
  onAppendChatMessages: (sku: string, newMessages: ChatMessage[]) => void;
}

const QUICK_QUESTIONS = [
  'Gere um e-mail formal cobrando explicação do supervisor do galpão sobre esse SKU',
  'Quais transações SAP devo conferir para auditar esse item?',
  'Monte um checklist de recontagem cega para esse endereço',
];

export function AICopilotDrawer({
  item,
  audit,
  aiConfig,
  diagnostic,
  chatHistory,
  onClose,
  onSaveDiagnostic,
  onAppendChatMessages,
}: AICopilotDrawerProps) {
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);
  const [question, setQuestion] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const activeSkuRef = useRef<string | null>(null);
  activeSkuRef.current = item?.sku ?? null;

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  useEffect(() => {
    if (!item || diagnostic) {
      setIsLoadingDiag(false);
      return;
    }
    const targetSku = item.sku;
    setIsLoadingDiag(true);
    generateItemDiagnostic(item, audit, aiConfig)
      .then((res) => {
        if (activeSkuRef.current === targetSku) {
          onSaveDiagnostic(targetSku, res);
        }
      })
      .finally(() => {
        if (activeSkuRef.current === targetSku) {
          setIsLoadingDiag(false);
        }
      });
  }, [item, diagnostic, audit, aiConfig, onSaveDiagnostic]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length, isSendingChat]);

  if (!item) return null;

  const handleRegenerateDiagnostic = async () => {
    setIsLoadingDiag(true);
    try {
      const res = await generateItemDiagnostic(item, audit, aiConfig);
      onSaveDiagnostic(item.sku, res);
    } finally {
      setIsLoadingDiag(false);
    }
  };

  const handleSendChat = async (textOverride?: string) => {
    const promptText = (textOverride ?? question).trim();
    if (!promptText || !diagnostic || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toISOString(),
    };

    if (!textOverride) {
      setQuestion('');
    }
    onAppendChatMessages(item.sku, [userMsg]);
    setIsSendingChat(true);

    try {
      const reply = await askItemCopilot(
        item,
        audit,
        diagnostic,
        [...chatHistory, userMsg],
        promptText,
        aiConfig
      );
      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      onAppendChatMessages(item.sku, [assistantMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback silencioso caso clipboard esteja bloqueado
    }
  };

  const riskBadgeClass =
    diagnostic?.nivelRisco === 'Crítico'
      ? 'border-rose-200 bg-[#FFF1F2] text-[#F43F5E]'
      : diagnostic?.nivelRisco === 'Médio'
        ? 'border-orange-200 bg-[#FFF7ED] text-[#EA580C]'
        : 'border-emerald-200 bg-[#ECFDF5] text-[#059669]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop claro translúcido */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer lateral */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Copiloto Auditor IA — SKU ${item.sku}`}
        className="relative z-10 flex h-full w-full max-w-xl animate-slide-in-right flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        {/* Cabeçalho do Drawer */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-[#F5F3FF] via-white to-indigo-50/70 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5] text-white shadow-sm shadow-violet-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-extrabold text-slate-900">
                  Copiloto Auditor de Causa Raiz
                </span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">
                  SKU {item.sku}
                </span>
              </div>
              <p className="truncate text-xs text-slate-600" title={item.descricao}>
                {item.descricao}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Copiloto Auditor IA"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* 1. Raio-X do SKU */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Raio-X do SKU (ERP × Físico)
              </h3>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-[#4F46E5]">
                Curva {item.curvaABC}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-medium text-slate-500">Saldo ERP</p>
                <p className="tabular-nums mt-1 text-lg font-extrabold text-slate-900">
                  {formatNumber(item.saldoERP)}
                </p>
                <p className="tabular-nums text-[11px] text-slate-400">
                  {formatBRL(item.valorERP)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-medium text-slate-500">Físico Contado</p>
                <p className="tabular-nums mt-1 text-lg font-extrabold text-slate-900">
                  {formatNumber(item.qtdContada)}
                </p>
                <p className="tabular-nums text-[11px] text-slate-400">
                  {formatBRL(item.valorFisico)}
                </p>
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  item.divergenciaQtd < 0
                    ? 'border-rose-200 bg-[#FFF1F2]'
                    : item.divergenciaQtd > 0
                      ? 'border-orange-200 bg-[#FFF7ED]'
                      : 'border-emerald-200 bg-[#ECFDF5]'
                }`}
              >
                <p className="text-[11px] font-medium text-slate-600">Impacto (R$)</p>
                <p
                  className={`tabular-nums mt-1 text-base font-extrabold ${
                    item.impactoFinanceiro < 0
                      ? 'text-[#F43F5E]'
                      : item.impactoFinanceiro > 0
                        ? 'text-[#10B981]'
                        : 'text-emerald-700'
                  }`}
                >
                  {formatBRL(item.impactoFinanceiro, true)}
                </p>
                <p className="tabular-nums text-[11px] font-semibold text-slate-600">
                  Div: {formatSignedNumber(item.divergenciaQtd)} un.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600 sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#4F46E5]" />
                <span className="truncate">
                  <strong className="text-slate-800">Local:</strong> {item.localizacao}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 shrink-0 text-[#0891B2]" />
                <span className="truncate">
                  <strong className="text-slate-800">Conferente:</strong>{' '}
                  {item.responsavelContagem}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 shrink-0 text-[#8B5CF6]" />
                <span className="tabular-nums truncate">
                  <strong className="text-slate-800">Custo Unit.:</strong>{' '}
                  {formatBRL(item.custoUnitario)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="truncate">
                  <strong className="text-slate-800">Mov. SAP:</strong>{' '}
                  {item.ultimaMovimentacaoSAP || 'Não informada'}
                </span>
              </div>
            </div>

            {item.observacao && (
              <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-[#FFF7ED] px-3 py-2 text-xs text-amber-900">
                <span className="font-bold">Observação de campo:</span> {item.observacao}
              </div>
            )}
          </section>

          {/* 2. Diagnóstico de Causa Raiz */}
          <section className="rounded-2xl border border-violet-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#8B5CF6]" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Diagnóstico de Causa Raiz
                </h3>
              </div>

              {diagnostic && !isLoadingDiag && (
                <button
                  type="button"
                  onClick={handleRegenerateDiagnostic}
                  title="Reprocessar diagnóstico com o motor atual"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-violet-200 hover:text-[#7C3AED] cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Atualizar</span>
                </button>
              )}
            </div>

            {isLoadingDiag ? (
              <div className="mt-4 space-y-3">
                <div className="h-4 w-1/3 rounded-md animate-shimmer" />
                <div className="h-16 w-full rounded-xl animate-shimmer" />
                <div className="h-24 w-full rounded-xl animate-shimmer" />
              </div>
            ) : diagnostic ? (
              <div className="mt-3 space-y-4">
                {diagnostic.avisoFallback && (
                  <div className="rounded-xl border border-amber-200 bg-[#FFF7ED] px-3 py-2 text-[11px] text-amber-800">
                    {diagnostic.avisoFallback}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED]">
                    Padrão: {diagnostic.padraoDetectado}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${riskBadgeClass}`}
                  >
                    Risco Contábil: {diagnostic.nivelRisco}
                  </span>
                </div>

                {/* 1. Hipótese Principal */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    1. Hipótese Principal da Divergência
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                    {diagnostic.hipotesePrincipal}
                  </p>
                </div>

                {/* 2. Nível de Risco Contábil */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    2. Nível de Risco Contábil ({diagnostic.nivelRisco})
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                    {diagnostic.justificativaRisco}
                  </p>
                </div>

                {/* 3. Plano de Ação em 3 Passos */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    3. Plano de Ação em 3 Passos
                  </p>
                  <ol className="space-y-2">
                    {diagnostic.planoAcao.map((step, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2.5 rounded-xl border border-indigo-100/80 bg-indigo-50/35 p-2.5 text-xs leading-relaxed text-slate-700"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-[11px] font-bold text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <p className="text-right text-[10px] font-medium text-slate-400">
                  Parecer gerado via{' '}
                  {diagnostic.fonte === 'gemini'
                    ? 'Google Gemini API'
                    : diagnostic.fonte === 'openai'
                      ? 'OpenAI API'
                      : 'Motor Analítico StockGuard AI'}
                </p>
              </div>
            ) : null}
          </section>

          {/* 3. Assistente Interativo do Item (Mini Chat) */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#4F46E5]" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Assistente Interativo do Item
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Solicite e-mails formais de cobrança, roteiros de conferência ou dúvidas sobre este
              SKU.
            </p>

            {/* Sugestões rápidas */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!diagnostic || isSendingChat}
                  onClick={() => handleSendChat(q)}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-[#7C3AED] transition hover:border-[#8B5CF6] hover:bg-[#F5F3FF] disabled:opacity-50 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Histórico de mensagens */}
            {chatHistory.length > 0 && (
              <div className="mt-4 space-y-3">
                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-800 shadow-xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#4F46E5] cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#10B981]" />
                            <span className="text-[#10B981]">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copiar resposta</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}

                {isSendingChat && (
                  <div className="flex items-start">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500">
                      Elaborando resposta técnica...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </section>
        </div>

        {/* Input fixo no rodapé do Drawer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChat();
          }}
          className="border-t border-slate-200 bg-white px-6 py-3.5"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!diagnostic || isSendingChat}
              placeholder="Pergunte ao Copiloto sobre este SKU..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#8B5CF6] focus:bg-white focus:ring-2 focus:ring-violet-500/15 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!question.trim() || !diagnostic || isSendingChat}
              aria-label="Enviar pergunta ao Copiloto IA"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#4F46E5] px-4 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar</span>
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

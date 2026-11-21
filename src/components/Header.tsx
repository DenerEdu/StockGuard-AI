import { ArrowLeft, Cpu, FileSpreadsheet, Settings, Sparkles } from 'lucide-react';
import type { AIConfig, AuditResult } from '../types/audit';

interface HeaderProps {
  aiConfig: AIConfig;
  auditResult: AuditResult | null;
  onOpenSettings: () => void;
  onResetAudit: () => void;
}

export function Header({ aiConfig, auditResult, onOpenSettings, onResetAudit }: HeaderProps) {
  const isExternalAI = aiConfig.provider !== 'local' && Boolean(aiConfig.apiKey.trim());
  const statusLabel =
    aiConfig.provider === 'gemini' && isExternalAI
      ? 'Gemini Conectado'
      : aiConfig.provider === 'openai' && isExternalAI
        ? 'OpenAI Conectado'
        : 'Motor Analítico Local';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo + Identidade */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#06B6D4] shadow-sm shadow-indigo-500/25">
            <svg
              viewBox="0 0 32 32"
              className="h-6 w-6 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M16 3L6 7.4v7.9c0 6.7 4.3 12.8 10 14.7 5.7-1.9 10-8 10-14.7V7.4L16 3z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
                fill="rgba(255,255,255,0.14)"
              />
              <path
                d="M16 9.5l5.5 3.2v6.4L16 22.3l-5.5-3.2v-6.4L16 9.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M16 15.9v6.4M16 15.9l5.5-3.2M16 15.9l-5.5-3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display truncate text-lg font-bold tracking-tight text-slate-900">
                StockGuard
              </span>
              <span className="font-display bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] bg-clip-text text-lg font-extrabold text-transparent">
                AI
              </span>
            </div>
            <p className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
              Auditoria Inteligente de Inventário &amp; Divergências
            </p>
          </div>
        </div>

        {/* Contexto da auditoria no centro/direita quando no Dashboard */}
        {auditResult && (
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-xs text-slate-600 lg:flex">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#4F46E5]" />
            <span className="max-w-[180px] truncate font-medium text-slate-700">
              {auditResult.erpFileName}
            </span>
            <span className="text-slate-300">×</span>
            <span className="max-w-[180px] truncate font-medium text-slate-700">
              {auditResult.physicalFileName}
            </span>
          </div>
        )}

        {/* Controles à direita */}
        <div className="flex shrink-0 items-center gap-2.5">
          {auditResult && (
            <button
              type="button"
              onClick={onResetAudit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-[#4F46E5] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Nova Auditoria</span>
            </button>
          )}

          {/* Status da IA */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurar Motor de Inteligência Artificial"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              isExternalAI
                ? 'border-violet-200 bg-[#F5F3FF] text-[#7C3AED] hover:bg-violet-100/80'
                : 'border-emerald-200 bg-[#ECFDF5] text-emerald-700 hover:bg-emerald-100/80'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isExternalAI ? 'bg-[#8B5CF6]' : 'bg-[#10B981]'
              }`}
            />
            {isExternalAI ? (
              <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
            ) : (
              <Cpu className="h-3.5 w-3.5 text-[#10B981]" />
            )}
            <span className="hidden sm:inline">{statusLabel}</span>
          </button>

          {/* Engrenagem discreta */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurações da API de IA"
            title="Configurações da API de IA"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-indigo-200 hover:bg-slate-50 hover:text-[#4F46E5] cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useState } from 'react';
import { Check, Cpu, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { AIConfig } from '../types/audit';

interface AISettingsModalProps {
  isOpen: boolean;
  config: AIConfig;
  onClose: () => void;
  onSave: (newConfig: AIConfig) => void;
}

const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado — Rápido)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Recomendado — Ágil)' },
  { id: 'gpt-4o', label: 'GPT-4o' },
];

export function AISettingsModal({ isOpen, config, onClose, onSave }: AISettingsModalProps) {
  const [provider, setProvider] = useState<AIConfig['provider']>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProvider(config.provider);
      setApiKey(config.apiKey);
      setModel(config.model);
      setShowKey(false);
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProviderChange = (next: AIConfig['provider']) => {
    setProvider(next);
    if (next === 'gemini') {
      setModel('gemini-2.5-flash');
    } else if (next === 'openai') {
      setModel('gpt-4o-mini');
    } else {
      setModel('local-heuristic');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      apiKey: provider === 'local' ? '' : apiKey.trim(),
      model,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className="relative z-10 w-full max-w-lg animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#8B5CF6]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ai-settings-title" className="font-display text-base font-bold text-slate-900">
                Configuração do Copiloto Auditor IA
              </h2>
              <p className="text-xs text-slate-500">
                Conecte Gemini ou OpenAI, ou utilize o motor analítico local integrado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Provedor de Inteligência
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleProviderChange('local')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition cursor-pointer ${
                  provider === 'local'
                    ? 'border-[#10B981] bg-[#ECFDF5]/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Cpu className="h-4 w-4 text-[#10B981]" />
                  {provider === 'local' && <Check className="h-4 w-4 text-[#10B981]" />}
                </div>
                <span className="text-xs font-bold text-slate-900">Motor Local</span>
                <span className="text-[11px] text-slate-500">Sem chave (Fallback)</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition cursor-pointer ${
                  provider === 'gemini'
                    ? 'border-[#4F46E5] bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Sparkles className="h-4 w-4 text-[#4F46E5]" />
                  {provider === 'gemini' && <Check className="h-4 w-4 text-[#4F46E5]" />}
                </div>
                <span className="text-xs font-bold text-slate-900">Google Gemini</span>
                <span className="text-[11px] text-slate-500">API Key própria</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition cursor-pointer ${
                  provider === 'openai'
                    ? 'border-[#8B5CF6] bg-[#F5F3FF]/80 ring-2 ring-violet-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
                  {provider === 'openai' && <Check className="h-4 w-4 text-[#8B5CF6]" />}
                </div>
                <span className="text-xs font-bold text-slate-900">OpenAI</span>
                <span className="text-[11px] text-slate-500">API Key própria</span>
              </button>
            </div>
          </div>

          {provider !== 'local' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <label
                  htmlFor="ai-api-key"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#4F46E5]" />
                  Chave da API ({provider === 'gemini' ? 'Google AI Studio' : 'OpenAI Platform'})
                </label>
                <div className="relative">
                  <input
                    id="ai-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-10 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-model-select"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Modelo
                </label>
                <select
                  id="ai-model-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  {(provider === 'gemini' ? GEMINI_MODELS : OPENAI_MODELS).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
            <p>
              Sua chave permanece armazenada apenas no navegador (localStorage) e nunca é enviada a
              servidores intermediários. Caso não informe uma chave ou ocorra indisponibilidade, o
              Motor Analítico JavaScript assume automaticamente.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:opacity-95 cursor-pointer"
            >
              Salvar Configuração
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

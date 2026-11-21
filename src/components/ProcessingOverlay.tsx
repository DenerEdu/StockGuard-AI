import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
}

const PROCESSING_STEPS = [
  'Normalizando SKUs e consolidando endereços físicos...',
  'Cruzando Saldo Contábil (ERP) × Contagem Física...',
  'Calculando Curva ABC (80 / 15 / 5) e Impacto em R$...',
  'Preparando painel executivo e Copiloto Auditor IA...',
];

export function ProcessingOverlay({ isVisible }: ProcessingOverlayProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    if (!isVisible) {
      setActiveStep(0);
      setProgress(12);
      return;
    }

    const t1 = window.setTimeout(() => {
      setActiveStep(1);
      setProgress(42);
    }, 220);
    const t2 = window.setTimeout(() => {
      setActiveStep(2);
      setProgress(74);
    }, 520);
    const t3 = window.setTimeout(() => {
      setActiveStep(3);
      setProgress(96);
    }, 820);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#06B6D4] text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Executando Auditoria Inteligente
            </h3>
            <p className="text-xs text-slate-500">
              Processando conciliação e classificando divergências...
            </p>
          </div>
        </div>

        {/* Barra de progresso animada */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="text-[#4F46E5]">Progresso da conciliação</span>
            <span className="tabular-nums text-slate-700">{progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Etapas */}
        <ul className="mt-5 space-y-2.5">
          {PROCESSING_STEPS.map((label, idx) => {
            const done = idx < activeStep;
            const current = idx === activeStep;
            return (
              <li
                key={label}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition ${
                  done
                    ? 'bg-[#ECFDF5] font-medium text-emerald-800'
                    : current
                      ? 'bg-indigo-50/80 font-semibold text-indigo-900'
                      : 'text-slate-400'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4F46E5]" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-slate-200 bg-white" />
                )}
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

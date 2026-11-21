import { useCallback, useEffect, useState } from 'react';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { AISettingsModal } from './components/AISettingsModal';
import { Dashboard } from './components/Dashboard';
import { Header } from './components/Header';
import { ImportHub } from './components/ImportHub';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import type {
  AIConfig,
  AIDiagnostic,
  AuditResult,
  ChatMessage,
  ERPRow,
  ParsedFileResult,
  PhysicalRow,
  ReconciledItem,
} from './types/audit';
import { runInventoryAudit } from './utils/auditEngine';

const AI_CONFIG_STORAGE_KEY = 'stockguard_ai_config';

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'local',
  apiKey: '',
  model: 'local-heuristic',
};

function loadInitialAIConfig(): AIConfig {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    if (
      parsed.provider === 'gemini' ||
      parsed.provider === 'openai' ||
      parsed.provider === 'local'
    ) {
      return {
        provider: parsed.provider,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        model: typeof parsed.model === 'string' ? parsed.model : 'local-heuristic',
      };
    }
  } catch {
    // Ignorar falha de leitura do localStorage
  }
  return DEFAULT_AI_CONFIG;
}

export function App() {
  const [aiConfig, setAiConfig] = useState<AIConfig>(loadInitialAIConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [erpData, setErpData] = useState<ParsedFileResult<ERPRow> | null>(null);
  const [physicalData, setPhysicalData] = useState<ParsedFileResult<PhysicalRow> | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const [selectedItem, setSelectedItem] = useState<ReconciledItem | null>(null);
  const [diagnosticsBySku, setDiagnosticsBySku] = useState<Record<string, AIDiagnostic>>({});
  const [chatsBySku, setChatsBySku] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(aiConfig));
    } catch {
      // Ignorar falha de escrita no localStorage
    }
  }, [aiConfig]);

  const handleExecuteAudit = () => {
    if (!erpData || !physicalData) return;
    setIsProcessing(true);

    window.setTimeout(() => {
      const result = runInventoryAudit(
        erpData.rows,
        physicalData.rows,
        erpData.fileName,
        physicalData.fileName
      );
      setDiagnosticsBySku({});
      setChatsBySku({});
      setSelectedItem(null);
      setAuditResult(result);
      setIsProcessing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1050);
  };

  const handleResetAudit = () => {
    setAuditResult(null);
    setErpData(null);
    setPhysicalData(null);
    setSelectedItem(null);
    setDiagnosticsBySku({});
    setChatsBySku({});
  };

  const handleSaveDiagnostic = useCallback((sku: string, diagnostic: AIDiagnostic) => {
    setDiagnosticsBySku((prev) => ({ ...prev, [sku]: diagnostic }));
  }, []);

  const handleAppendChatMessages = useCallback((sku: string, newMessages: ChatMessage[]) => {
    setChatsBySku((prev) => ({
      ...prev,
      [sku]: [...(prev[sku] || []), ...newMessages],
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Header
        aiConfig={aiConfig}
        auditResult={auditResult}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetAudit={handleResetAudit}
      />

      {!auditResult ? (
        <ImportHub
          erpData={erpData}
          physicalData={physicalData}
          onErpLoaded={setErpData}
          onPhysicalLoaded={setPhysicalData}
          onExecuteAudit={handleExecuteAudit}
        />
      ) : (
        <Dashboard
          audit={auditResult}
          diagnosticsBySku={diagnosticsBySku}
          onSelectItem={setSelectedItem}
        />
      )}

      <ProcessingOverlay isVisible={isProcessing} />

      <AISettingsModal
        isOpen={isSettingsOpen}
        config={aiConfig}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setAiConfig}
      />

      {auditResult && (
        <AICopilotDrawer
          item={selectedItem}
          audit={auditResult}
          aiConfig={aiConfig}
          diagnostic={selectedItem ? diagnosticsBySku[selectedItem.sku] : undefined}
          chatHistory={selectedItem ? chatsBySku[selectedItem.sku] || [] : []}
          onClose={() => setSelectedItem(null)}
          onSaveDiagnostic={handleSaveDiagnostic}
          onAppendChatMessages={handleAppendChatMessages}
        />
      )}
    </div>
  );
}

export default App;

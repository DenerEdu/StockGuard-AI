# 🛡️ StockGuard AI — Auditoria Inteligente de Inventário & Divergências

**StockGuard AI** é uma aplicação web (Micro-SaaS) desenvolvida para automatizar a conciliação entre o **Saldo Contábil (ERP/SAP)** e a **Contagem Física (Galpão/Loja)**, combinando análise financeira de dados com um **Copiloto de IA** para diagnóstico de causa raiz.

🔗 **Acesse a aplicação ao vivo:** [stock-guard-ai-phi.vercel.app](https://stock-guard-ai-phi.vercel.app)

---

## 🎯 Problema Resolvido
No dia a dia de operações, logística e controladoria, cruzar planilhas de ERP com contagens físicas ainda é um processo manual e lento. Além disso, dashboards tradicionais mostram *onde* está a divergência, mas não ajudam o auditor a investigar *por que* ela aconteceu.

O **StockGuard AI** automatiza todo o fluxo: da ingestão das planilhas até a emissão do relatório executivo pronto para assinatura gerencial.

---

## ✨ Principais Funcionalidades

- **Hub de Conciliação (CSV / XLSX):** Importação direta de bases reais do ERP/SAP e da Contagem Física, com download de modelos de layout padronizados.
- **KPIs Executivos Instantâneos:** Cálculo automático de Acuracidade Geral (%), Impacto Financeiro Líquido (R$), Valor Total Auditado e contagem de itens críticos.
- **Visualizações Analíticas:**
  - Gráfico de Pareto com os SKUs de maior impacto financeiro.
  - Distribuição automática pela **Curva ABC** (80% / 15% / 5%).
  - Indicador de Saúde do Inventário.
- **Copiloto Auditor de Causa Raiz (IA):** Painel lateral interativo que analisa o padrão da divergência (incluindo movimentações SAP como `101`, `201`, `311` e `601`) e gera:
  - Hipótese principal da divergência;
  - Classificação de risco contábil;
  - Plano de ação em 3 passos + chat interativo para dúvidas sobre o SKU.
- **Exportação Executiva:** Geração de **Relatório de Auditoria em PDF** (com resumo financeiro, divergências críticas e bloco de assinaturas) e exportação da conciliação tratada em `.CSV`.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Visualização de Dados:** Recharts, Lucide Icons
- **Processamento de Planilhas:** SheetJS (`xlsx`), PapaParse
- **Geração de Documentos:** jsPDF, jsPDF-AutoTable
- **Inteligência Artificial:** Integração com API de LLM (Gemini/OpenAI) + motor analítico de fallback

---

## 🚀 Como executar localmente

```bash
# Clone o repositório
git clone [https://github.com/DenerEdu/StockGuard-AI.git](https://github.com/DenerEdu/StockGuard-AI.git)

# Acesse a pasta do projeto
cd StockGuard-AI

# Instale as dependências
npm install

# Execute em modo de desenvolvimento
npm run dev
```

---

## 👨‍💻 Autor

Desenvolvido por **Dener Eduardo**  
[Portfólio](https://portfolio-dener-eduardo.vercel.app/) • [LinkedIn](https://www.linkedin.com/in/denereduardo) • [Hugging Face](https://huggingface.co/DenerEdu)

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEMO_DATA_DIR = path.join(__dirname, 'demo-data');
const DEMO_OUTPUT_DIR = path.join(ROOT_DIR, 'demo-video');
const RAW_VIDEO_DIR = path.join(DEMO_OUTPUT_DIR, '.tmp-raw');
const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}/`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Aguardar servidor iniciar
    }
    await sleep(250);
  }
  throw new Error(`Servidor preview não respondeu em ${url} dentro de ${timeoutMs}ms.`);
}

function startPreviewServer() {
  const isWin = process.platform === 'win32';
  const child = isWin
    ? spawn(
        'cmd.exe',
        ['/c', 'npx', 'vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
        {
          cwd: ROOT_DIR,
          stdio: 'pipe',
          windowsHide: true,
        }
      )
    : spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
      });

  return child;
}

function stopProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
}

async function smoothScrollTo(page, targetY, durationMs = 1500) {
  await page.evaluate(
    async ({ y, duration }) => {
      await new Promise((resolve) => {
        const startY = window.scrollY;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const clampedY = Math.min(Math.max(0, y), maxScroll);
        const distance = clampedY - startY;
        if (Math.abs(distance) < 2) {
          resolve();
          return;
        }
        const startTime = performance.now();
        const easeInOutCubic = (t) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        function step(now) {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          window.scrollTo(0, startY + distance * easeInOutCubic(progress));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    },
    { y: targetY, duration: durationMs }
  );
}

async function smoothScrollContainer(page, selector, targetTop, durationMs = 1200) {
  await page.evaluate(
    async ({ sel, top, duration }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      await new Promise((resolve) => {
        const startTop = el.scrollTop;
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        const clampedTop = Math.min(Math.max(0, top), maxTop);
        const distance = clampedTop - startTop;
        if (Math.abs(distance) < 2) {
          resolve();
          return;
        }
        const startTime = performance.now();
        const easeInOutCubic = (t) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        function step(now) {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          el.scrollTop = startTop + distance * easeInOutCubic(progress);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    },
    { sel: selector, top: targetTop, duration: durationMs }
  );
}

async function moveToLocator(page, locator, steps = 18) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps });
}

async function moveAndClick(page, locator, pauseBeforeMs = 300) {
  await moveToLocator(page, locator, 18);
  await sleep(pauseBeforeMs);
  await locator.click();
}

function resolveFfmpegExecutable() {
  const systemCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', windowsHide: true });
  if (systemCheck.status === 0) {
    return 'ffmpeg';
  }
  if (ffmpegPath) {
    return ffmpegPath;
  }
  return null;
}

async function main() {
  const distIndex = path.join(ROOT_DIR, 'dist', 'index.html');
  try {
    await fs.access(distIndex);
  } catch {
    console.log('Construindo aplicação (dist/)...');
    const buildRes = spawnSync('npm', ['run', 'build'], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (buildRes.status !== 0) {
      throw new Error('Falha ao construir dist/ antes da gravação.');
    }
  }

  await fs.rm(RAW_VIDEO_DIR, { recursive: true, force: true });
  await fs.mkdir(RAW_VIDEO_DIR, { recursive: true });
  await fs.mkdir(DEMO_OUTPUT_DIR, { recursive: true });

  const erpCsvPath = path.join(DEMO_DATA_DIR, 'base_erp_sap.csv');
  const physicalCsvPath = path.join(DEMO_DATA_DIR, 'contagem_fisica.csv');
  await fs.access(erpCsvPath);
  await fs.access(physicalCsvPath);

  console.log('Iniciando servidor local para gravação 1920x1080...');
  const server = startPreviewServer();
  let browser = null;
  let context = null;
  let recordedWebmPath = null;

  try {
    await waitForServer(BASE_URL);

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      locale: 'pt-BR',
      acceptDownloads: true,
      recordVideo: {
        dir: RAW_VIDEO_DIR,
        size: { width: 1920, height: 1080 },
      },
    });

    const page = await context.newPage();
    const videoHandle = page.video();

    // 1. Tela Inicial limpa (Hub de Conciliação) e pausa inicial (~2.5s)
    console.log('1. Abrindo Hub de Conciliação...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(960, 420);
    await sleep(2500);

    // 2. Upload automático dos dois arquivos CSV reais
    console.log('2. Importando base_erp_sap.csv e contagem_fisica.csv...');
    const erpCardInput = page.locator('#upload-erp-input');
    const erpSection = erpCardInput.locator('..');
    await moveToLocator(page, erpSection, 16);
    await sleep(300);
    await erpCardInput.setInputFiles(erpCsvPath);
    await page.getByText('base_erp_sap.csv').waitFor({ state: 'visible' });
    await sleep(2000);

    const physicalCardInput = page.locator('#upload-physical-input');
    const physicalSection = physicalCardInput.locator('..');
    await moveToLocator(page, physicalSection, 16);
    await sleep(300);
    await physicalCardInput.setInputFiles(physicalCsvPath);
    await page.getByText('contagem_fisica.csv').waitFor({ state: 'visible' });
    await sleep(2100);

    // 3. Clicar em "Executar Auditoria Inteligente" e aguardar Dashboard
    console.log('3. Executando Auditoria Inteligente...');
    const executeBtn = page.getByRole('button', { name: /Executar Auditoria Inteligente/i });
    await moveAndClick(page, executeBtn, 450);

    await page
      .getByRole('heading', { name: /Dashboard Executivo de Auditoria/i })
      .waitFor({ state: 'visible', timeout: 15000 });
    // Aguardar animações de barra e gráficos Recharts estabilizarem + pausa nos 4 KPIs
    await sleep(2300);

    // 4. Rolar lentamente pelos gráficos (Pareto + Curva ABC + Saúde) e depois pela Tabela
    console.log('4. Apresentando KPIs, Gráficos e Tabela...');
    const chartsY = await page.evaluate(() => {
      const el = document.querySelector('section[aria-label="Visualizações Executivas"]');
      return el ? el.getBoundingClientRect().top + window.scrollY - 88 : 340;
    });
    await smoothScrollTo(page, chartsY, 1500);
    await sleep(1600);

    // Passar o mouse sobre a barra principal do Pareto para destacar o tooltip interativo
    const firstParetoBar = page.locator('.recharts-bar-rectangle').first();
    if ((await firstParetoBar.count()) > 0) {
      await moveToLocator(page, firstParetoBar, 16);
      await sleep(1900);
    }

    const tableY = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const tableHeading = headings.find((h) =>
        h.textContent?.includes('Tabela Inteligente de Auditoria')
      );
      return tableHeading ? tableHeading.getBoundingClientRect().top + window.scrollY - 96 : 820;
    });
    await smoothScrollTo(page, tableY, 1600);
    await sleep(2000);

    // 5. Filtrar por "Quebra (Falta)" e abrir "Analisar com IA ✨" do item MAT-1001
    console.log('5. Filtrando Quebra (Falta) e abrindo Copiloto IA do MAT-1001...');
    const quebraFilterBtn = page.getByRole('button', { name: /Quebra \(Falta\)/i });
    await moveAndClick(page, quebraFilterBtn, 400);
    await sleep(2000);

    const mat1001Row = page.locator('tbody tr', { hasText: 'MAT-1001' });
    await mat1001Row.waitFor({ state: 'visible' });
    const analyzeBtn = mat1001Row.getByRole('button', { name: /Analisar com IA/i });
    await moveAndClick(page, analyzeBtn, 450);

    const drawer = page.locator('aside[role="dialog"]');
    await drawer.waitFor({ state: 'visible' });
    await drawer.getByText('1. Hipótese Principal da Divergência').waitFor({ state: 'visible' });

    // 6. Exibir diagnóstico de causa raiz e plano de ação (>= 4 segundos)
    console.log('6. Exibindo diagnóstico de causa raiz e plano de ação...');
    await sleep(3400);
    await smoothScrollContainer(page, 'aside[role="dialog"] .overflow-y-auto', 480, 1200);
    await sleep(3000);

    // 7. Fechar painel lateral e clicar em "Exportar Relatório de Auditoria (PDF)"
    console.log('7. Fechando painel lateral e exportando Relatório PDF...');
    const closeDrawerBtn = page.getByRole('button', { name: 'Fechar Copiloto Auditor IA' });
    await moveAndClick(page, closeDrawerBtn, 350);
    await drawer.waitFor({ state: 'hidden' });
    await sleep(1400);

    await smoothScrollTo(page, 0, 1300);
    await sleep(1000);

    const exportPdfBtn = page.getByRole('button', {
      name: /Exportar Relatório de Auditoria \(PDF\)/i,
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      moveAndClick(page, exportPdfBtn, 450),
    ]);
    await download.saveAs(path.join(RAW_VIDEO_DIR, download.suggestedFilename()));
    await page.getByText(/Relatório PDF SG-.*gerado com sucesso/i).waitFor({ state: 'visible' });
    await sleep(2600);

    // 8. Finalizar gravação e converter para MP4
    console.log('8. Finalizando gravação de vídeo...');
    await page.close();
    await context.close();
    context = null;

    if (videoHandle) {
      recordedWebmPath = await videoHandle.path();
    }
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    stopProcessTree(server);
  }

  if (!recordedWebmPath) {
    throw new Error('Playwright não gerou arquivo de vídeo.');
  }

  const finalMp4Path = path.join(DEMO_OUTPUT_DIR, 'stockguard-ai-demo.mp4');
  const finalWebmPath = path.join(DEMO_OUTPUT_DIR, 'stockguard-ai-demo.webm');
  const ffmpegExec = resolveFfmpegExecutable();

  let finalOutputPath = finalWebmPath;

  if (ffmpegExec) {
    console.log('Convertendo gravação para MP4 (H.264 1920x1080 compatível com LinkedIn)...');
    const conv = spawnSync(
      ffmpegExec,
      [
        '-y',
        '-i',
        recordedWebmPath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'medium',
        '-crf',
        '20',
        '-movflags',
        '+faststart',
        '-an',
        finalMp4Path,
      ],
      { stdio: 'pipe', windowsHide: true }
    );

    if (conv.status === 0) {
      finalOutputPath = finalMp4Path;
      // Remover eventual .webm antigo caso exista
      await fs.rm(finalWebmPath, { force: true });
    } else {
      console.warn('Falha ao converter com ffmpeg; mantendo arquivo .webm.');
      await fs.copyFile(recordedWebmPath, finalWebmPath);
    }
  } else {
    console.log('ffmpeg não disponível; salvando vídeo em .webm.');
    await fs.copyFile(recordedWebmPath, finalWebmPath);
  }

  await fs.rm(RAW_VIDEO_DIR, { recursive: true, force: true });

  const stats = await fs.stat(finalOutputPath);
  console.log(`Vídeo salvo com sucesso em: ${finalOutputPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error('Erro ao gravar vídeo de demonstração:', err);
  process.exit(1);
});

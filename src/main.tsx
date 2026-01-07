import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'UnknownError', message: String(error), stack: undefined as string | undefined };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function renderFatal(error: unknown) {
  const details = getErrorDetails(error);
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  rootEl.innerHTML = `
    <div style="padding:16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h1 style="margin:0 0 12px 0;font-size:18px">PhotoWall 启动失败</h1>
      <div style="opacity:.8;margin-bottom:12px">前端发生致命错误，UI 未能渲染。</div>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#111827;color:#f9fafb;padding:12px;border-radius:8px;overflow:auto">
${details.name}: ${details.message}
${details.stack ?? ''}
      </pre>
    </div>
  `;
}

async function logToBackend(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: unknown) {
  try {
    const { invoke, isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return;
    await invoke('log_frontend', { level, message, context });
  } catch {
    // ignore
  }
}

async function boot() {
  // Don't force theme here; keep it light by default and let the app/theme hook decide.
  document.documentElement.classList.remove('dark');

  window.addEventListener('error', (event) => {
    const details = getErrorDetails(event.error ?? event.message);
    void logToBackend('error', 'window.onerror', details);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const details = getErrorDetails(event.reason);
    void logToBackend('error', 'unhandledrejection', details);
  });

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    const err = new Error('Missing #root element');
    renderFatal(err);
    void logToBackend('error', 'bootstrap failed: missing root', getErrorDetails(err));
    return;
  }

  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <div style={{ padding: 16, fontFamily: 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial' }}>
      <div style={{ fontSize: 14, opacity: 0.85 }}>正在启动…</div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>如果一直卡住，请查看 `src-tauri/logs/frontend.*.log`。</div>
    </div>
  );

  try {
    const maxAttempts = import.meta.env.DEV ? 20 : 1;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { default: App } = await import('./App');
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
        void logToBackend('info', 'frontend boot ok');
        return;
      } catch (error) {
        lastError = error;
        const details = getErrorDetails(error);
        void logToBackend('warn', `import App failed (${attempt}/${maxAttempts})`, details);

        if (attempt < maxAttempts) {
          await sleep(Math.min(1500, 120 * attempt));
        }
      }
    }

    throw lastError;
  } catch (error) {
    renderFatal(error);
    void logToBackend('error', 'frontend boot failed', getErrorDetails(error));
  }
}

void boot();

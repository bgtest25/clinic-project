import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootEl = document.getElementById('root')!;

// A last-resort safety net, not the primary fix — see assert-env.mjs
// (fails the build itself) and deploy-web.yml's smoke-test step (fails CI
// post-deploy) for the real prevention. This exists because of how the
// 2026-08-19/08-21 outages actually failed: amazon-cognito-identity-js's
// constructor throws during module evaluation, before React ever gets to
// mount — so no React error boundary can ever catch it, no matter where one
// is placed in the component tree. Wrapping App's import in a dynamic
// `import()` turns that module-evaluation throw into an ordinary rejected
// promise this can actually catch, so a clinician sees a plain-language
// message instead of a silent blank screen — for this specific failure
// class or any other startup-time exception.
function renderStartupError(err: unknown) {
  console.error('Havenote failed to start:', err);
  rootEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f6f8;color:#0f172a;">
      <div style="max-width:420px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;box-shadow:0 6px 16px rgba(15,23,42,0.08);">
        <h1 style="margin:0 0 8px;font-size:1.25rem;">Havenote couldn't load</h1>
        <p style="margin:0 0 20px;color:#475569;line-height:1.5;">
          Something went wrong starting the app. Try refreshing the page — if this keeps
          happening, contact support.
        </p>
        <button
          type="button"
          onclick="location.reload()"
          style="background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:0.95rem;font-weight:600;cursor:pointer;"
        >Refresh</button>
      </div>
    </div>
  `;
}

async function bootstrap() {
  try {
    const { default: App } = await import('./App.tsx');
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (err) {
    renderStartupError(err);
  }
}

bootstrap();

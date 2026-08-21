// Runs automatically before every `npm run build` (via the `prebuild` npm
// hook — see package.json). Fails the build immediately, with a clear
// message, if a required VITE_* value is missing.
//
// Exists because of two real production outages (2026-08-19 and
// 2026-08-21): Vite bakes import.meta.env.VITE_* into the bundle at build
// time. A missing value doesn't fail the build — it silently becomes
// `undefined`, which only crashes at runtime, in a browser, before React
// even mounts (amazon-cognito-identity-js's constructor throws during
// module evaluation). Nothing in `tsc`, `vite build`, lint, or the unit
// suite catches that. This is the one check that actually can, and it runs
// wherever `build` runs — CI today, whatever replaces CI's deploy path
// tomorrow — so a future pipeline change can't silently drop these again
// the way the 2026-08-19 Vercel-to-CloudFront cutover did.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED = ['VITE_API_URL', 'VITE_COGNITO_USER_POOL_ID', 'VITE_COGNITO_CLIENT_ID'];

// Vite itself loads .env files for the actual build substitution, but this
// script runs as plain Node before that — so mirror the lookup here too,
// purely to support a local `web/.env` during development. CI always sets
// these as real environment variables and never relies on this fallback.
for (const filename of ['.env.local', '.env.production.local', '.env.production', '.env']) {
  const path = resolve(import.meta.dirname, '..', filename);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error('\n✖ Build aborted: missing required build-time env var(s):');
  for (const key of missing) console.error(`    ${key}`);
  console.error(
    '\nThese get baked into the JS bundle by Vite (import.meta.env.*). A missing value ' +
      'silently becomes `undefined`, which crashes Cognito init at runtime with no build-time ' +
      'signal — this is exactly what caused the 2026-08-19 and 2026-08-21 production outages.\n',
  );
  console.error('Set them in the environment before building. See deploy-web.yml for the CI values,');
  console.error('or web/.env.example for local development.\n');
  process.exit(1);
}

console.log('assert-env: all required VITE_* values present, proceeding with build.');

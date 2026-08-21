// Post-deploy smoke test: loads the live site in a real headless browser and
// fails loudly on anything a curl-only check can't see (uncaught JS
// exceptions, a blank #root, failed same-origin asset/API requests).
//
// Exists because of a real incident (2026-08-21): the 2026-08-19 CloudFront
// cutover shipped a build missing Cognito's runtime config, crashing every
// page load for ~2 days. CI's curl-based checks and asset-content checks all
// passed the whole time — none of them actually ran the app. This closes
// that gap.
import { chromium } from 'playwright';

const urls = (process.env.SMOKE_TEST_URLS ?? 'https://havenote.health,https://app.havenote.health')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const MIN_ROOT_HTML_LENGTH = 50;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkUrl(browser, url) {
  const page = await browser.newPage();
  const pageErrors = [];
  const failedRequests = [];

  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message));
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && new URL(res.url()).hostname === new URL(url).hostname) {
      failedRequests.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const rootHTML = await page
    .evaluate(() => document.getElementById('root')?.innerHTML ?? '')
    .catch(() => '');

  await page.close();

  const problems = [];
  if (pageErrors.length > 0) {
    problems.push(...pageErrors.map((e) => `uncaught exception: ${e}`));
  }
  if (failedRequests.length > 0) {
    problems.push(...failedRequests.map((r) => `failed request: ${r}`));
  }
  if (rootHTML.trim().length < MIN_ROOT_HTML_LENGTH) {
    problems.push(`#root rendered almost nothing (${rootHTML.trim().length} chars) — blank screen`);
  }

  return problems;
}

async function checkUrlWithRetries(browser, url) {
  let lastProblems = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastProblems = await checkUrl(browser, url);
    if (lastProblems.length === 0) return [];
    if (attempt < MAX_ATTEMPTS) {
      console.log(`  attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  return lastProblems;
}

const browser = await chromium.launch();
let anyFailed = false;

for (const url of urls) {
  console.log(`Checking ${url}...`);
  const problems = await checkUrlWithRetries(browser, url);
  if (problems.length === 0) {
    console.log(`  OK`);
  } else {
    anyFailed = true;
    console.log(`  FAILED:`);
    for (const p of problems) console.log(`    - ${p}`);
  }
}

await browser.close();

if (anyFailed) {
  console.error('\nSmoke test failed: the deployed site did not load correctly in a real browser.');
  process.exit(1);
}
console.log('\nSmoke test passed on all URLs.');

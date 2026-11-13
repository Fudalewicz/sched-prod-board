// Local check of the four issues against the real incident API; ack is mocked so no real receipt is spent.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const out = [];
for (const [tz, locale] of [['Pacific/Auckland', 'en-NZ'], ['Europe/Berlin', 'de-DE'], ['America/New_York', 'en-US']]) {
  const ctx = await browser.newContext({ timezoneId: tz, locale });
  const page = await ctx.newPage();
  let incidentCalls = 0;
  await page.route('**/incidents?*', async (r) => { incidentCalls++; await new Promise((s) => setTimeout(s, incidentCalls === 1 ? 800 : 0)); r.continue(); });
  await page.route('**/ack?*', (r) => r.fulfill({ json: { id: new URL(r.request().url()).searchParams.get('id'), ackedAt: new Date().toISOString(), receipt: 'MOCK' } }));
  await page.goto(url);
  const loaderAtOpen = await page.getByTestId('loader').isVisible();
  await page.getByTestId('incident-row').first().waitFor();
  const loaderAfter = await page.getByTestId('loader').count();
  const rows = await page.getByTestId('incident-row').evaluateAll((els) => els.map((e) => [e.dataset.id, e.querySelector('time').textContent, e.querySelector('time').getAttribute('datetime')]));
  // ack the second row, then wait through two refreshes: the mark must survive
  const second = page.getByTestId('incident-row').nth(1);
  const id = await second.getAttribute('data-id');
  await second.getByTestId('ack').click();
  await second.getByTestId('acked').waitFor();
  const before = incidentCalls;
  await page.waitForTimeout(4500);
  const survived = await page.locator(`[data-testid="incident-row"][data-id="${id}"] [data-testid="acked"]`).count();
  const sha = [await page.locator('meta[name=build]').getAttribute('content'), await page.getByTestId('build-sha').textContent()];
  out.push({ tz, locale, loaderAtOpen, loaderAfter, rows: rows.slice(0, 2).concat([rows.at(-1)]), n: rows.length, ackedId: id, survived, refreshesIn4_5s: incidentCalls - before, sha });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));

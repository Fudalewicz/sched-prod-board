// Local check of product's decision (step 2): list holds still, "N new" bar, Ack lands on the row a person aimed at,
// empty state, no rows removed. Real incident API; ack is mocked so no real receipt is spent.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4175/';
const browser = await chromium.launch();
const r = {};
{ // empty board
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.route('**/incidents?*', async (rt) => { const res = await rt.fetch(); const b = await res.json(); rt.fulfill({ response: res, json: { ...b, incidents: [] } }); });
  await page.goto(url); await page.waitForTimeout(3000);
  r.emptyShown = await page.getByTestId('empty').isVisible(); r.loaderGone = (await page.getByTestId('loader').count()) === 0;
  await ctx.close();
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
const acks = [];
await page.route('**/ack?*', (rt) => { const id = new URL(rt.request().url()).searchParams.get('id'); acks.push(id); rt.fulfill({ json: { id, ackedAt: new Date().toISOString(), receipt: 'MOCK' } }); });
await page.addInitScript(() => { window.__removed = 0; new MutationObserver((rs) => { for (const x of rs) for (const n of x.removedNodes) if (n.nodeType === 1 && n.matches('[data-testid="incident-row"]')) window.__removed++; }).observe(document, { childList: true, subtree: true }); });
await page.goto(url);
const rows = page.getByTestId('incident-row');
await rows.first().waitFor();
const top0 = await rows.first().getAttribute('data-id');
// aim like a person at the 3rd row while new incidents arrive; click at the remembered spot right after one lands
const target = rows.nth(2); const intended = await target.getAttribute('data-id');
const box = await target.getByTestId('ack').boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
await page.mouse.move(x, y, { steps: 8 });
await page.getByTestId('new-bar').waitFor({ state: 'visible', timeout: 30000 });
const barText1 = await page.getByTestId('new-bar').innerText();
await page.waitForTimeout(150);
await page.mouse.click(x, y); await page.waitForTimeout(500);
r.ack = { intended, got: acks.at(-1) };
r.topStill = (await rows.first().getAttribute('data-id')) === top0;
const rowY = (await page.locator(`[data-id="${intended}"]`).boundingBox()).y; r.rowMoved = Math.abs(rowY + 0 - (box.y - (box.y - rowY))) > 0.5;
await page.waitForTimeout(8000);
r.barText = [barText1, await page.getByTestId('new-bar').innerText()];
r.removed = await page.evaluate(() => window.__removed);
await page.getByTestId('new-bar').click(); await page.waitForTimeout(400);
r.afterBar = { topChanged: (await rows.first().getAttribute('data-id')) !== top0, barHidden: !(await page.getByTestId('new-bar').isVisible()), topHasAck: (await rows.first().getByTestId('ack').count()) > 0, rows: await rows.count() };
r.sha = await page.locator('meta[name=build]').getAttribute('content');
await page.screenshot({ path: 'recordings/step2-check.png' });
await browser.close();
console.log(JSON.stringify(r, null, 1));

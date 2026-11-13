// Records the board in use: open-board, watch-board, one real ack-incident. Writes recordings/<name>.webm and .json.
import { chromium } from 'playwright';
import { writeFileSync, renameSync } from 'node:fs';
const [url, name = 'step1'] = process.argv.slice(2);
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ timezoneId: 'Europe/Warsaw', locale: 'en-GB', viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'recordings/raw', size: { width: 1280, height: 720 } } });
const t0 = Date.now();
const marks = [];
const mark = (flow, extra = {}) => { const m = { flow, at: mmss(Date.now() - t0), ms: Date.now() - t0, ...extra }; marks.push(m); console.log(m); return m; };
// Recording aids only (not part of the board): a visible pointer and a caption with the recording clock.
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:9999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(220,0,80,.55);border:2px solid #fff;pointer-events:none;left:-50px;top:-50px;transition:left .05s,top .05s';
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = 'position:fixed;z-index:9998;right:12px;bottom:12px;padding:6px 10px;border-radius:6px;background:#1d1d1f;color:#fff;font:13px ui-monospace,monospace;pointer-events:none';
    document.body.append(dot, cap);
    addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; });
  });
});
const page = await ctx.newPage();
const acks = [];
page.on('response', async (r) => { if (r.url().includes('/ack?')) acks.push(await r.json().catch(() => null)); });
const caption = (t) => page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) c.textContent = t; }, t).catch(() => {});
await page.goto(url);
mark('open-board', { loaderVisible: await page.getByTestId('loader').isVisible().catch(() => false) });
await page.getByTestId('incident-row').first().waitFor();
await caption('open-board · incidents loaded, loader gone · build ' + (await page.getByTestId('build-sha').textContent()));
mark('open-board-loaded', { rows: await page.getByTestId('incident-row').count() });
await page.mouse.move(640, 400);
// watch-board: wait until at least two new incidents arrive at the top without a reload
await caption('watch-board · waiting for new incidents, no reload');
const first = await page.getByTestId('incident-row').first().getAttribute('data-id');
const newTops = [];
const watchStart = Date.now();
while (newTops.length < 2 && Date.now() - watchStart < 60000) {
  await page.waitForTimeout(500);
  const top = await page.getByTestId('incident-row').first().getAttribute('data-id');
  if (top !== first && !newTops.includes(top)) { newTops.push(top); mark('watch-board', { newTop: top, rows: await page.getByTestId('incident-row').count() }); }
}
// ack-incident, like a person: read the top row, put the pointer on its Ack, and click at that spot.
// The click is already on its way when the next incident lands, so it goes wherever the pointer is (no re-targeting).
const row = page.getByTestId('incident-row').first();
const id = await row.getAttribute('data-id'); // the row I mean
await caption(`ack-incident · aiming at ${id} (top row)`);
const box = await row.getByTestId('ack').boundingBox();
const x = box.x + box.width / 2, y = box.y + box.height / 2;
await page.mouse.move(x, y, { steps: 15 });
mark('ack-aim', { expected: id });
// arm a watcher: when a new row is inserted above, note the time; the person's click lands ~150 ms later
await page.evaluate(() => { window.__inserted = null; new MutationObserver((ms) => { if (!window.__inserted && ms.some((m) => m.addedNodes.length)) window.__inserted = performance.now(); }).observe(document.querySelector('[data-testid="incident-list"]'), { childList: true }); });
await page.waitForFunction(() => window.__inserted !== null, null, { timeout: 60000, polling: 20 });
mark('insert-under-pointer', { newTop: await page.getByTestId('incident-row').first().getAttribute('data-id') });
await page.waitForTimeout(150);
const clickAt = mark('ack-incident-click', { expected: id });
await page.mouse.down(); await page.mouse.up();
await page.waitForResponse((r) => r.url().includes('/ack?'));
await page.waitForTimeout(300);
const got = acks.at(-1)?.id;
const ackedAt = mark('ack-incident', { expected: id, got, ackedRows: await page.getByTestId('acked').count() });
await caption(`ack-incident · meant ${id}, ack went to ${got}`);
await page.mouse.move(640, 600, { steps: 10 });
await page.waitForTimeout(8000);
mark('after-ack', { stillAcked: await page.locator(`[data-id="${id}"] [data-testid="acked"]`).count(), rows: await page.getByTestId('incident-row').count(), position: await page.getByTestId('incident-row').evaluateAll((els, id) => els.findIndex((e) => e.dataset.id === id), id) });
const video = page.video();
await ctx.close();
const raw = await video.path();
renameSync(raw, `recordings/${name}.webm`);
await browser.close();
writeFileSync(`recordings/${name}.json`, JSON.stringify({ url, startedAt: new Date(t0).toISOString(), marks, acks }, null, 2));
console.log('acks', acks.length, 'clickAt', clickAt.at, 'expected', id, 'got', got);

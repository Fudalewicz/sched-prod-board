import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-testid="status"]');

/** One <li> per incident id, kept across refreshes so a refresh never wipes a row or its Ack state. */
const rows = new Map();
/** id -> { ackedAt, receipt } for incidents acked from this board. */
const acked = new Map();

// R5: the viewer's own zone and order (en-GB, de, pl … give dd/mm; en-US keeps mm/dd).
const localTime = new Intl.DateTimeFormat(navigator.languages, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function ackedMark(at) {
  const mark = el('span', 'acked', `acked ${localTime.format(new Date(at))}`);
  mark.dataset.testid = 'acked';
  return mark;
}

function buildRow(i) {
  const li = el('li', `row ${i.severity}`);
  li.dataset.testid = 'incident-row';
  li.dataset.id = i.id;
  li.append(
    el('span', 'id', i.id),
    el('span', 'sev', i.severity),
    el('span', 'what', `${i.service} · ${i.region} · ${i.summary}`),
  );
  const time = el('time', null, localTime.format(new Date(i.openedAt)));
  time.dateTime = i.openedAt; // full UTC value stays in the attribute (R5)
  time.title = i.openedAt;
  li.append(time);

  const done = acked.get(i.id);
  if (done) {
    li.classList.add('is-acked');
    li.append(ackedMark(done.ackedAt));
  } else {
    const button = el('button', 'ack', 'Ack');
    button.type = 'button';
    button.dataset.testid = 'ack';
    button.addEventListener('click', () => onAck(i.id, li, button));
    li.append(button);
  }
  return li;
}

async function onAck(id, li, button) {
  button.disabled = true;
  button.textContent = 'Acking…';
  try {
    const reply = await ack(id); // R2: api.ack sends the latest cursor and logs the receipt
    acked.set(id, reply);
    li.classList.add('is-acked');
    button.replaceWith(ackedMark(reply.ackedAt));
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Ack';
    showStatus(`Ack failed for ${id}. Try again.`);
  }
}

/** R1: newest first; new rows go in at the top, existing rows are kept (not re-created). */
function render(incidents) {
  const sorted = [...incidents].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const seen = new Set();
  let anchor = list.firstChild;
  for (const i of sorted) {
    seen.add(i.id);
    let li = rows.get(i.id);
    if (!li) {
      li = buildRow(i);
      rows.set(i.id, li);
    } else {
      const time = li.querySelector('time');
      if (time.dateTime !== i.openedAt) {
        time.dateTime = i.openedAt;
        time.title = i.openedAt;
        time.textContent = localTime.format(new Date(i.openedAt));
      }
    }
    if (li !== anchor) list.insertBefore(li, anchor); // moves only rows that are out of place
    anchor = li.nextSibling;
  }
  for (const [id, li] of rows) {
    if (!seen.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
}

function showStatus(text) {
  status.textContent = text;
  status.hidden = !text;
}

let loaded = false;
async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    if (!loaded) {
      loaded = true;
      loader.remove(); // R3: gone once incidents are on screen
      board.setAttribute('aria-busy', 'false');
    }
    showStatus('');
  } catch (err) {
    console.error(err);
    showStatus('Could not reach the incident API. Retrying…');
  } finally {
    setTimeout(refresh, REFRESH_MS); // R4: next refresh only after this one finished, so they never overlap
  }
}

refresh();

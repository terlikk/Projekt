'use strict';

// ---------- Storage ----------

const STORE_KEY = 'przypominajka:v1';
const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#fb923c', '#94a3b8'];
const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']; // index 0 = Monday
const CATCH_UP_MS = 15 * 60 * 1000; // don't fire reminders older than this after reopening
const SNOOZE_MIN = 10;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function defaults() {
  return {
    reminders: [
      { id: uid(), name: 'Woda', emoji: '💧', color: '#38bdf8', enabled: true, mode: 'interval',
        interval: 60, start: '08:00', end: '22:00', times: ['09:00'], days: ALL_DAYS,
        goal: 2.5, unit: 'L', step: 0.25, stopAtGoal: true, message: 'Pora na szklankę wody 💧' },
      { id: uid(), name: 'Kreatyna', emoji: '💪', color: '#a78bfa', enabled: true, mode: 'times',
        interval: 60, start: '08:00', end: '22:00', times: ['09:00'], days: ALL_DAYS,
        goal: 1, unit: 'porcja', step: 1, stopAtGoal: true, message: '5 g kreatyny, nie zapomnij!' },
      { id: uid(), name: 'Witamina D', emoji: '☀️', color: '#fbbf24', enabled: true, mode: 'times',
        interval: 60, start: '08:00', end: '22:00', times: ['10:00'], days: ALL_DAYS,
        goal: 1, unit: 'kapsułka', step: 1, stopAtGoal: true, message: 'Witamina D do posiłku' },
    ],
    log: {},        // { 'YYYY-MM-DD': { [id]: amount } }
    lastFired: {},  // { [id]: timestamp of last slot notified }
    snooze: {},     // { [id]: timestamp }
    sound: true,
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(Object.assign(defaults(), JSON.parse(raw)));
  } catch (e) { /* fall through to defaults */ }
  return defaults();
}

// v1 counted taps only; water defaulted to 8 glasses. Now each tap adds `step` units.
function migrate(s) {
  for (const r of s.reminders) {
    if (r.step) continue;
    r.step = 1;
    if (r.unit === 'szklanka' && r.name === 'Woda') {
      r.unit = 'L';
      r.step = 0.25;
      r.goal = 2.5;
      for (const day of Object.values(s.log)) if (day[r.id]) day[r.id] = round(day[r.id] * 0.25);
    }
  }
  return s;
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
}

// Function declarations (hoisted): migrate() runs during the initial load().
function round(n) { return Math.round(n * 1000) / 1000; }
function fmt(n) { return round(n).toLocaleString('pl-PL', { maximumFractionDigits: 3 }); }
function stepOf(r) { return Number(r.step) > 0 ? Number(r.step) : 1; }

function uid() { return Math.random().toString(36).slice(2, 10); }

// ---------- Time helpers ----------

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const weekday = (d) => (d.getDay() + 6) % 7; // Monday = 0

function atMinutes(day, minutes) {
  const d = new Date(day);
  d.setHours(0, minutes, 0, 0);
  return d;
}

// All reminder slots (Date objects) for a given day.
function slotsFor(r, day) {
  if (!r.enabled || !r.days.includes(weekday(day))) return [];
  if (r.mode === 'times') {
    return [...r.times].sort().map((t) => atMinutes(day, toMin(t)));
  }
  const out = [];
  const step = Math.max(5, Number(r.interval) || 60);
  for (let m = toMin(r.start); m <= toMin(r.end); m += step) out.push(atMinutes(day, m));
  return out;
}

function countToday(r) { return (state.log[dateKey()] || {})[r.id] || 0; }
function goalReached(r) { return r.goal && countToday(r) >= r.goal; }

function nextSlot(r, now = new Date()) {
  if (state.snooze[r.id] && state.snooze[r.id] > now.getTime()) return new Date(state.snooze[r.id]);
  for (let i = 0; i < 8; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    if (i === 0 && r.stopAtGoal && goalReached(r)) continue;
    const s = slotsFor(r, day).find((d) => d > now);
    if (s) return s;
  }
  return null;
}

function describeNext(d) {
  if (!d) return 'brak zaplanowanych';
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (dateKey(d) === dateKey(today)) return `następne o ${hhmm(d)}`;
  if (dateKey(d) === dateKey(tomorrow)) return `jutro o ${hhmm(d)}`;
  return `${d.toLocaleDateString('pl-PL', { weekday: 'long' })} o ${hhmm(d)}`;
}

function describeSchedule(r) {
  const days = r.days.length === 7 ? 'codziennie' : r.days.map((i) => DAY_LABELS[i]).join(', ');
  if (r.mode === 'times') return `${[...r.times].sort().join(', ')} · ${days}`;
  return `co ${r.interval} min, ${r.start}–${r.end} · ${days}`;
}

// ---------- Notifications ----------

let swReg = null;

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message', (e) => handleAction(e.data.type, e.data.id));
  } catch (e) { console.warn('SW registration failed', e); }
}

function notifSupported() { return 'Notification' in window; }

async function notify(r, body) {
  if (state.sound && document.visibilityState === 'visible') beep();
  if (document.visibilityState === 'visible') toast(`${r.emoji} ${body || r.message || r.name}`);
  if (!notifSupported() || Notification.permission !== 'granted') return;

  const title = `${r.emoji} ${r.name}`;
  const opts = {
    body: body || r.message || 'Przypomnienie',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: `rem-${r.id}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { id: r.id },
    actions: [
      { action: 'done', title: '✓ Zrobione' },
      { action: 'snooze', title: `⏰ Za ${SNOOZE_MIN} min` },
    ],
  };
  try {
    const reg = swReg || (await navigator.serviceWorker?.getRegistration());
    if (reg) return reg.showNotification(title, opts);
    // Without a service worker, actions aren't allowed.
    delete opts.actions;
    new Notification(title, opts);
  } catch (e) { console.warn('notify failed', e); }
}

function tick() {
  const now = Date.now();
  let changed = false;

  for (const r of state.reminders) {
    if (!r.enabled) continue;

    const snoozeAt = state.snooze[r.id];
    if (snoozeAt && snoozeAt <= now) {
      delete state.snooze[r.id];
      changed = true;
      if (!(r.stopAtGoal && goalReached(r))) notify(r);
      continue;
    }
    if (snoozeAt) continue;

    const due = slotsFor(r, new Date())
      .map((d) => d.getTime())
      .filter((t) => t <= now && t > (state.lastFired[r.id] || 0));
    if (!due.length) continue;

    const latest = due[due.length - 1];
    state.lastFired[r.id] = latest;
    changed = true;
    if (now - latest > CATCH_UP_MS) continue; // stale, app was closed
    if (r.stopAtGoal && goalReached(r)) continue;
    notify(r);
  }

  if (changed) save();
  render();
}

let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.4);
  } catch (e) { /* audio not available */ }
}

// ---------- Actions ----------

function find(id) { return state.reminders.find((r) => r.id === id); }

// sign: +1 adds one step (e.g. 0,25 L), -1 undoes one.
function logDone(id, sign = 1) {
  const r = find(id);
  if (!r) return;
  const key = dateKey();
  state.log[key] = state.log[key] || {};
  const before = state.log[key][id] || 0;
  state.log[key][id] = Math.max(0, round(before + sign * stepOf(r)));
  delete state.snooze[id];
  save();
  render();
  if (sign > 0 && r.goal && before < r.goal && state.log[key][id] >= r.goal) toast(`🎉 Cel „${r.name}” osiągnięty!`);
}

function snooze(id) {
  state.snooze[id] = Date.now() + SNOOZE_MIN * 60 * 1000;
  save();
  render();
  toast(`Przypomnę za ${SNOOZE_MIN} min`);
}

function handleAction(type, id) {
  if (type === 'done') logDone(id);
  else if (type === 'snooze') snooze(id);
}

// ---------- Rendering ----------

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render() {
  $('#today-label').textContent = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  const showBanner = notifSupported() && Notification.permission === 'default';
  $('#notif-banner').hidden = !showBanner;

  // Summary ring
  const withGoal = state.reminders.filter((r) => r.enabled && r.goal && slotsFor(r, new Date()).length);
  const pct = withGoal.length
    ? Math.round(withGoal.reduce((a, r) => a + Math.min(1, countToday(r) / r.goal), 0) / withGoal.length * 100)
    : 0;
  const doneCount = withGoal.filter(goalReached).length;
  $('#summary').innerHTML = `
    <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div>
      <h2>${pct === 100 ? 'Wszystko zrobione 🎉' : 'Dzisiejszy postęp'}</h2>
      <p>${doneCount} z ${withGoal.length} celów osiągniętych</p>
    </div>`;

  // Cards
  if (!state.reminders.length) {
    $('#list').innerHTML = `<div class="empty">Brak przypomnień.<br>Dodaj pierwsze przyciskiem ＋</div>`;
    return;
  }
  $('#list').innerHTML = state.reminders.map((r) => {
    const count = countToday(r);
    const pctR = r.goal ? Math.min(100, count / r.goal * 100) : 0;
    const complete = r.goal && count >= r.goal;
    const unit = esc(r.unit || '');
    const progress = r.goal ? `${fmt(count)} / ${fmt(r.goal)} ${unit}` : (unit ? `${fmt(count)} ${unit} dziś` : `${fmt(count)}× dziś`);
    const next = r.enabled ? describeNext(nextSlot(r)) : 'wyłączone';
    const snoozed = state.snooze[r.id] ? ' · drzemka' : '';
    return `
      <article class="card ${r.enabled ? '' : 'off'}" style="--c:${esc(r.color)}">
        <div class="card-main">
          <div class="card-emoji">${esc(r.emoji)}</div>
          <div class="card-body" data-edit="${r.id}">
            <h3>${esc(r.name)}</h3>
            <p>${progress}</p>
          </div>
          <button class="done-btn ${complete ? 'complete' : ''}" data-done="${r.id}" aria-label="Zrobione">
            ${complete ? '✓' : `＋${fmt(stepOf(r))}`}
          </button>
        </div>
        ${r.goal ? `<div class="bar"><i style="width:${pctR}%"></i></div>` : ''}
        <div class="card-foot">
          <span>${next}${snoozed}</span>
          <span>
            ${count ? `<button data-undo="${r.id}">cofnij</button> · ` : ''}
            <button data-toggle="${r.id}">${r.enabled ? 'wyłącz' : 'włącz'}</button>
          </span>
        </div>
      </article>`;
  }).join('');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Edit dialog ----------

const editDialog = $('#edit-dialog');
const form = $('#edit-form');
let editing = null; // draft reminder

function openEditor(r) {
  editing = r
    ? JSON.parse(JSON.stringify(r))
    : { id: uid(), name: '', emoji: '⏰', color: COLORS[state.reminders.length % COLORS.length], enabled: true,
        mode: 'times', interval: 60, start: '08:00', end: '22:00', times: ['09:00'], days: [...ALL_DAYS],
        goal: 1, unit: '', step: 1, stopAtGoal: true, message: '' };
  const isNew = !r;

  $('#edit-title').textContent = isNew ? 'Nowe przypomnienie' : 'Edytuj przypomnienie';
  $('#delete-btn').hidden = isNew;
  form.elements.emoji.value = editing.emoji;
  form.elements.name.value = editing.name;
  form.elements.interval.value = editing.interval;
  form.elements.start.value = editing.start;
  form.elements.end.value = editing.end;
  form.elements.goal.value = editing.goal || '';
  form.elements.unit.value = editing.unit || '';
  form.elements.step.value = stepOf(editing);
  form.elements.stopAtGoal.checked = !!editing.stopAtGoal;
  form.elements.message.value = editing.message || '';
  form.querySelector(`input[name=mode][value=${editing.mode}]`).checked = true;

  renderSwatches();
  renderTimes();
  renderDays();
  syncMode();
  editDialog.showModal();
}

function renderSwatches() {
  $('#swatches').innerHTML = COLORS.map((c) =>
    `<button type="button" class="swatch ${c === editing.color ? 'active' : ''}" style="background:${c}" data-color="${c}" aria-label="Kolor ${c}"></button>`
  ).join('');
}

function renderTimes() {
  $('#times').innerHTML = editing.times.map((t, i) => `
    <span class="time-chip">
      <input type="time" value="${t}" data-time="${i}" required>
      ${editing.times.length > 1 ? `<button type="button" data-remove-time="${i}" aria-label="Usuń">✕</button>` : ''}
    </span>`).join('');
}

function renderDays() {
  $('#days').innerHTML = DAY_LABELS.map((l, i) =>
    `<button type="button" class="day ${editing.days.includes(i) ? 'active' : ''}" data-day="${i}">${l}</button>`
  ).join('');
}

function syncMode() {
  const mode = form.querySelector('input[name=mode]:checked').value;
  form.querySelector('.mode-interval').hidden = mode !== 'interval';
  form.querySelector('.mode-times').hidden = mode !== 'times';
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'mode') syncMode();
  if (e.target.dataset.time !== undefined) editing.times[+e.target.dataset.time] = e.target.value;
});

form.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.color) { editing.color = t.dataset.color; renderSwatches(); }
  if (t.dataset.day !== undefined) {
    const d = +t.dataset.day;
    editing.days = editing.days.includes(d) ? editing.days.filter((x) => x !== d) : [...editing.days, d].sort();
    renderDays();
  }
  if (t.dataset.removeTime !== undefined) { editing.times.splice(+t.dataset.removeTime, 1); renderTimes(); }
  if (t.id === 'add-time') {
    const last = editing.times[editing.times.length - 1] || '08:00';
    editing.times.push(`${pad((Math.floor(toMin(last) / 60) + 3) % 24)}:${last.slice(3)}`);
    renderTimes();
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!editing.days.length) { toast('Wybierz przynajmniej jeden dzień'); return; }
  const mode = form.querySelector('input[name=mode]:checked').value;
  if (mode === 'interval' && toMin(form.elements.start.value) > toMin(form.elements.end.value)) { toast('„Od” musi być przed „Do”'); return; }

  Object.assign(editing, {
    emoji: form.elements.emoji.value.trim() || '⏰',
    name: form.elements.name.value.trim(),
    mode,
    interval: Math.max(5, Number(form.elements.interval.value) || 60),
    start: form.elements.start.value || '08:00',
    end: form.elements.end.value || '22:00',
    goal: Number(String(form.elements.goal.value).replace(',', '.')) || 0,
    step: Number(String(form.elements.step.value).replace(',', '.')) || 1,
    unit: form.elements.unit.value.trim(),
    stopAtGoal: form.elements.stopAtGoal.checked,
    message: form.elements.message.value.trim(),
    times: [...new Set(editing.times.filter(Boolean))],
  });
  if (!editing.times.length) editing.times = ['09:00'];

  const i = state.reminders.findIndex((r) => r.id === editing.id);
  if (i >= 0) state.reminders[i] = editing;
  else state.reminders.push(editing);
  // Don't fire everything that already passed today for a freshly edited reminder.
  state.lastFired[editing.id] = Date.now();
  save();
  editDialog.close();
  render();
});

$('#delete-btn').addEventListener('click', () => {
  if (!confirm(`Usunąć „${editing.name}”?`)) return;
  state.reminders = state.reminders.filter((r) => r.id !== editing.id);
  delete state.lastFired[editing.id];
  delete state.snooze[editing.id];
  save();
  editDialog.close();
  render();
});

// ---------- Settings ----------

const settingsDialog = $('#settings-dialog');

function renderSettings() {
  const p = notifSupported() ? Notification.permission : 'unsupported';
  $('#notif-status').textContent = {
    granted: '✅ Powiadomienia włączone. Przypomnienia działają, gdy apka jest otwarta lub w tle.',
    denied: '⛔ Powiadomienia zablokowane. Odblokuj je w ustawieniach przeglądarki dla tej strony.',
    default: 'Powiadomienia jeszcze nie są włączone.',
    unsupported: 'Ta przeglądarka nie obsługuje powiadomień. Na iPhonie dodaj apkę do ekranu głównego (Udostępnij → Do ekranu początkowego).',
  }[p];
  $('#sound-toggle').checked = !!state.sound;
}

$('#settings-btn').addEventListener('click', () => { renderSettings(); settingsDialog.showModal(); });

$('#test-notif').addEventListener('click', async () => {
  await askPermission();
  notify({ id: 'test', name: 'Test', emoji: '🔔', message: 'Tak będą wyglądać przypomnienia' });
});

$('#sound-toggle').addEventListener('change', (e) => { state.sound = e.target.checked; save(); });

$('#export-json').addEventListener('click', () => {
  download('przypominajka-backup.json', JSON.stringify(state, null, 2), 'application/json');
});

$('#import-json').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.reminders)) throw new Error('bad file');
    state = Object.assign(defaults(), data);
    save();
    render();
    toast('Zaimportowano ✓');
  } catch (err) { toast('Nieprawidłowy plik'); }
  e.target.value = '';
});

$('#reset-today').addEventListener('click', () => {
  if (!confirm('Wyzerować dzisiejszy postęp?')) return;
  delete state.log[dateKey()];
  save();
  render();
});

$('#export-ics').addEventListener('click', () => download('przypominajka.ics', buildICS(), 'text/calendar'));

// Recurring weekly calendar events with an alarm at event time.
function buildICS() {
  const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ymd = dateKey(now).replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Przypominajka//PL', 'CALSCALE:GREGORIAN'];

  for (const r of state.reminders.filter((x) => x.enabled && x.days.length)) {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    // Times for any enabled day — same for every day.
    const times = r.mode === 'times'
      ? [...r.times].sort()
      : slotsFor({ ...r, days: ALL_DAYS }, base).map(hhmm);
    const byday = r.days.map((d) => BYDAY[d]).join(',');
    for (const t of times) {
      const hms = t.replace(':', '') + '00';
      const text = `${r.emoji} ${r.name}`.replace(/[,;\\]/g, ' ');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${r.id}-${hms}@przypominajka`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${ymd}T${hms}`,
        'DURATION:PT5M',
        `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
        `SUMMARY:${text}`,
        `DESCRIPTION:${(r.message || '').replace(/[,;\\]/g, ' ')}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text}`, 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Global events ----------

async function askPermission() {
  if (!notifSupported() || Notification.permission !== 'default') return;
  await Notification.requestPermission();
  render();
  renderSettings();
}

$('#notif-enable').addEventListener('click', askPermission);
$('#add-btn').addEventListener('click', () => openEditor(null));

$('#list').addEventListener('click', (e) => {
  const el = e.target.closest('[data-done],[data-edit],[data-undo],[data-toggle]');
  if (!el) return;
  const { done, edit, undo, toggle } = el.dataset;
  if (done) logDone(done);
  if (undo) logDone(undo, -1);
  if (edit) openEditor(find(edit));
  if (toggle) {
    const r = find(toggle);
    r.enabled = !r.enabled;
    state.lastFired[r.id] = Date.now();
    save();
    render();
  }
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

// Actions coming from notification click when the app was closed (?done=id / ?snooze=id).
(function handleUrlAction() {
  const params = new URLSearchParams(location.search);
  for (const type of ['done', 'snooze']) {
    if (params.get(type)) handleAction(type, params.get(type));
  }
  if (location.search) history.replaceState(null, '', location.pathname);
})();

// Old logs aren't needed forever; keep the last 60 days.
(function pruneLog() {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const ck = dateKey(cutoff);
  for (const k of Object.keys(state.log)) if (k < ck) delete state.log[k];
  save();
})();

// First run: don't fire everything from earlier today.
for (const r of state.reminders) if (!state.lastFired[r.id]) state.lastFired[r.id] = Date.now();
save();

registerSW();
render();
tick();
setInterval(tick, 20 * 1000);

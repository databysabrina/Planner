// Estado do app, gravação e o "motor" que junta eventos, estudos e prazos por dia.
import { db } from './db.js';
import { todayISO, addDays, parseISO } from './ui.js';

const PREFS_KEY = 'planner-ui';
const DEFAULTS = {
  tab: 'trabalho', noteFilter: 'todas', noteType: 'lembrete', lastBackup: 0, histQ: '',
  hojeView: 'dia', agView: 'mes', agFilter: 'tudo', estSub: 'grade'
};
function readPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; } }

export const S = {
  tasks: [], notes: [], events: [], projects: [],
  ui: Object.assign({}, DEFAULTS, readPrefs(), { histQ: '' }),
  agCursor: todayISO(), // data de referência da Agenda (não é salva)
  agListDays: 45
};

export function savePrefs() {
  const { histQ, ...keep } = S.ui;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(keep)); } catch (e) { /* ignora */ }
}

let renderFn = () => {};
// Avisado a cada alteração local (a sincronização usa isso para saber o que enviar).
let changeHook = () => {};
export const setChangeHook = (f) => { changeHook = f; };
export const notifyChange = (store, id, deleted = false) => { try { changeHook(store, id, deleted); } catch (e) { /* ignora */ } };
export const setRender = (f) => { renderFn = f; };
export const rerender = () => renderFn();

export async function loadAll() {
  [S.tasks, S.notes, S.events, S.projects] = await Promise.all(['tasks', 'notes', 'events', 'projects'].map((s) => db.all(s)));
}
export async function saveItem(store, obj) {
  obj.updatedAt = Date.now();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  await db.put(store, obj);
  const i = S[store].findIndex((x) => x.id === obj.id);
  if (i >= 0) S[store][i] = obj; else S[store].push(obj);
  notifyChange(store, obj.id, false);
  return obj;
}
export async function removeItem(store, id) {
  await db.del(store, id);
  S[store] = S[store].filter((x) => x.id !== id);
  notifyChange(store, id, true);
}

export const COLORS = { pessoal: 'var(--pink)', trabalho: 'var(--blue)', estudos: 'var(--lilac)', prazo: 'var(--orange)' };
export const CAT_LABEL = { pessoal: 'Pessoal', trabalho: 'Trabalho', estudos: 'Estudos', prazo: 'Prazo' };
export const PALETTE = ['#FF5FA2', '#8FD8E8', '#B48CFF', '#FFA24C', '#FFE45C', '#FFC9A3', '#7EE0A8', '#FF8A7A'];

export const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const rangeLabel = (o) => o.start ? (o.end ? `${o.start} – ${o.end}` : o.start) : (o.kind === 'task' ? 'prazo' : 'dia inteiro');

// Tudo o que acontece entre duas datas (inclusive), já ordenado.
export function occurrences(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = parseISO(d).getDay();
    for (const e of S.events) {
      const hit = e.repeat === 'weekly'
        ? d >= e.date && (!e.until || d <= e.until) && parseISO(e.date).getDay() === wd && !(e.exdates || []).includes(d)
        : e.date === d;
      if (hit) out.push({ kind: 'event', id: e.id, date: d, start: e.start || '', end: e.end || '', title: e.title, cat: e.cat, color: COLORS[e.cat], place: e.place || '', repeat: e.repeat });
    }
    for (const p of S.projects) {
      for (const s of p.subjects || []) {
        for (const sl of s.slots || []) {
          if (sl.weekday === wd) out.push({ kind: 'study', id: p.id, date: d, start: sl.start, end: sl.end, title: s.name, sub: p.name, cat: 'estudos', color: COLORS.estudos, dot: s.color });
        }
      }
    }
    for (const t of S.tasks) {
      if (t.status !== 'final' && t.due === d) out.push({ kind: 'task', id: t.id, date: d, start: '', end: '', title: t.title, cat: 'prazo', color: COLORS.prazo, taskCat: t.cat });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || ((toMin(a.start) ?? -1) - (toMin(b.start) ?? -1)));
  return out;
}

export const matchesFilter = (o, f) => f === 'tudo' || o.cat === f;

// Segunda-feira da semana de uma data.
export function weekStartMon(iso) {
  const wd = parseISO(iso).getDay();
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

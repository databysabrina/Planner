// Preferências de notificação (ficam no celular e são copiadas para a nuvem).
import { notifyChange } from './core.js';

const KEY = 'planner-notif';
export const NOTIF_DEFAULTS = {
  updatedAt: 0,
  tzOffset: new Date().getTimezoneOffset(),
  event: { on: true, offsets: [60], vibe: 'dupla', sticky: false },
  task: { on: true, time: '08:00', eve: true, vibe: 'curta', sticky: true },
  study: { on: true, offsets: [10], vibe: 'longa', sticky: false },
  digest: { on: true, time: '07:00' },
  quiet: { on: true, start: '22:30', end: '06:30' }
};

function merge(stored) {
  const d = JSON.parse(JSON.stringify(NOTIF_DEFAULTS));
  if (!stored || typeof stored !== 'object') return d;
  for (const k of Object.keys(d)) {
    if (stored[k] === undefined) continue;
    d[k] = typeof d[k] === 'object' ? { ...d[k], ...stored[k] } : stored[k];
  }
  return d;
}

export function getNotifPrefs() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) { stored = null; }
  return merge(stored);
}

export function setNotifPrefs(p) {
  p.updatedAt = Date.now();
  p.tzOffset = new Date().getTimezoneOffset();
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignora */ }
  notifyChange('settings', 'notif', false);
}

export function setNotifPrefsFromRemote(data) {
  try { localStorage.setItem(KEY, JSON.stringify(merge(data))); } catch (e) { /* ignora */ }
}

export const OFFSET_CHOICES = [[0, 'Na hora'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [1440, '1 dia']];
export const VIBE_CHOICES = [['curta', 'Vibração curta'], ['dupla', 'Vibração dupla'], ['tripla', 'Vibração tripla'], ['longa', 'Vibração longa'], ['silenciosa', 'Silenciosa (sem som nem vibração)']];

// Pequenas ferramentas de interface usadas pelo app inteiro.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- Datas ----------
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WDL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MON = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => String(n).padStart(2, '0');

export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const daysFromToday = (iso) => Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000);

export function dueLabel(iso) {
  if (!iso) return '';
  const n = daysFromToday(iso);
  const d = parseISO(iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `atrasada · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (n < 7) return `${WD[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}
export const isLate = (iso) => !!iso && daysFromToday(iso) < 0;

export function longToday() {
  const d = new Date();
  return { weekday: WDL[d.getDay()], text: `${d.getDate()} de ${MON[d.getMonth()]}` };
}
export function stamp(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function shortDate(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())} ${MON[d.getMonth()].slice(0, 3)}`;
}

// ---------- Links ----------
export function safeUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : '';
  } catch (e) { return ''; }
}

// ---------- Ícones ----------
const I = (d, size = 20, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  back: I('<path d="M15 5l-7 7 7 7"/>', 20, 2.5),
  check: I('<path d="M5 12l5 5 9-10"/>', 14, 3.5),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  link: I('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>', 18),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>', 22),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22),
  pin: (on) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>`,
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', 18),
  plus: I('<path d="M12 5v14M5 12h14"/>', 18, 2.5),
  star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', 18)
};

export const winBar = (label, color = 'var(--blue)', extra = '') =>
  `<div class="win-bar" style="--c:${color}"><span>[C:\\${esc(label)}\\]</span>${extra}</div>`;

// ---------- Folhas (sheets), diálogos e avisos ----------
// Cada folha aberta cria uma entrada no histórico: assim o botão "voltar" do Android fecha a folha
// em vez de sair da tela.
const root = () => document.getElementById('overlay-root');
let stack = [];
let pendingBack = Promise.resolve();
let suppressPop = false;
let resolveBack = null;

export function openSheet(html, { center = false, onClose } = {}) {
  if (stack.length === 0 && !(history.state && history.state.sheet)) history.pushState({ sheet: true }, '');
  const wrap = document.createElement('div');
  wrap.className = 'overlay' + (center ? ' center' : '');
  wrap.innerHTML = `<button class="backdrop" type="button" aria-label="Fechar" data-close></button>${html}`;
  root().appendChild(wrap);
  const entry = { el: wrap, onClose };
  stack.push(entry);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet(entry)));
  fillDrafts(wrap);
  const first = wrap.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  return wrap;
}
export function closeSheet(entry, fromPop = false) {
  const e = entry || stack[stack.length - 1];
  if (!e || !stack.includes(e)) return;
  stack = stack.filter((x) => x !== e);
  e.el.remove();
  if (!fromPop && stack.length === 0) {
    // Espera um instante: se outra folha abrir em seguida, ela reaproveita a mesma entrada do histórico.
    pendingBack = new Promise((r) => {
      setTimeout(() => {
        if (stack.length || !(history.state && history.state.sheet)) { r(); return; }
        suppressPop = true;
        resolveBack = r;
        history.back();
        setTimeout(() => { if (suppressPop) { suppressPop = false; r(); } }, 700);
      }, 0);
    });
  }
  if (e.onClose) e.onClose();
}
export const closeAll = () => { while (stack.length) closeSheet(stack[stack.length - 1], true); };
export const hasSheet = () => stack.length > 0;

window.addEventListener('popstate', () => {
  if (suppressPop) { suppressPop = false; if (resolveBack) resolveBack(); return; }
  if (stack.length) {
    closeSheet(stack[stack.length - 1], true);
    if (stack.length) history.pushState({ sheet: true }, '');
  }
});

// Navega para outra tela depois que o histórico das folhas fechadas se acomodou.
export async function go(hash) {
  await pendingBack;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

// ---------- Rascunhos: o que você digita não se perde ----------
const DRAFTS_KEY = 'planner-drafts';
let drafts = {};
try { drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY)) || {}; } catch (e) { drafts = {}; }
let draftTimer;
const persistDrafts = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) { /* ignora */ } }, 250); };
export function setDraft(key, value) { if (value && value.trim()) drafts[key] = value; else delete drafts[key]; persistDrafts(); }
export function clearDraft(key) { delete drafts[key]; persistDrafts(); }
export function fillDrafts(scope) {
  scope.querySelectorAll('[data-draft]').forEach((i) => {
    const v = drafts[i.dataset.draft];
    if (v != null && !i.value) i.value = v;
  });
}
document.addEventListener('input', (e) => {
  const i = e.target.closest && e.target.closest('[data-draft]');
  if (i) setDraft(i.dataset.draft, i.value);
});

export function confirmBox(message, { ok = 'Confirmar', danger = true } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const el = openSheet(`<div class="sheet" role="dialog" aria-label="Confirmação"><div class="grip"></div>
      <p style="margin:0;font-size:16px;font-weight:700;line-height:1.4">${esc(message)}</p>
      <div class="grid2"><button class="btn ghost" type="button" data-no>Cancelar</button>
      <button class="btn ${danger ? '' : ''}" style="--c:${danger ? 'var(--pink)' : 'var(--blue)'}" type="button" data-yes>${esc(ok)}</button></div></div>`,
    { onClose: () => { if (!answered) resolve(false); } });
    el.querySelector('[data-no]').onclick = () => { answered = true; closeSheet(); resolve(false); };
    el.querySelector('[data-yes]').onclick = () => { answered = true; closeSheet(); resolve(true); };
  });
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Imagens: reduz antes de guardar ----------
export async function compressImage(file, max = 1600, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/jpeg', quality));
}

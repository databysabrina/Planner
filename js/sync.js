// Sincronização com o Supabase: login, envio das alterações e recebimento do que mudou em outros aparelhos.
// O app continua funcionando sem internet: as alterações ficam numa fila e são enviadas quando der.
import { CONFIG } from './config.js';
import { db } from './db.js';
import { S, rerender, setChangeHook } from './core.js';
import { getNotifPrefs, setNotifPrefsFromRemote } from './notif.js';

const OUT_KEY = 'planner-outbox';
const PULL_KEY = 'planner-lastpull';
const DATA_STORES = ['tasks', 'notes', 'events', 'projects'];

let client = null;
let session = null;
let syncing = false;
let again = false;
let timer = null;
const status = { state: 'off', last: 0, error: '' };
const listeners = new Set();
let outbox = {};
try { outbox = JSON.parse(localStorage.getItem(OUT_KEY)) || {}; } catch (e) { outbox = {}; }

const saveOutbox = () => { try { localStorage.setItem(OUT_KEY, JSON.stringify(outbox)); } catch (e) { /* ignora */ } };
const emit = () => listeners.forEach((f) => { try { f(getStatus()); } catch (e) { /* ignora */ } });
export const onStatus = (f) => listeners.add(f);
export const isConfigured = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
export const isLoggedIn = () => !!session;
export function getStatus() {
  return { ...status, pending: Object.keys(outbox).length, email: session?.user?.email || '', configured: isConfigured(), ready: !!client };
}

export function markDirty(store, id, deleted = false) {
  outbox[`${store}|${id}`] = { store, id, deleted, t: Date.now() };
  saveOutbox();
  schedule(1500);
}
setChangeHook(markDirty);

function schedule(ms = 1500) {
  if (!session) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}

function loadLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './js/vendor/supabase.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('lib'));
    document.head.appendChild(s);
  });
}

export async function initSync() {
  if (!isConfigured()) return;
  try { await loadLib(); } catch (e) { status.state = 'error'; status.error = 'Sem conexão para carregar a sincronização.'; emit(); return; }
  client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'planner-auth' }
  });
  const { data } = await client.auth.getSession();
  session = data.session;
  client.auth.onAuthStateChange((_event, s) => { session = s; emit(); });
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => syncNow(), 120000);
  status.state = session ? 'idle' : 'off';
  emit();
  if (session) { syncNow(); refreshPushSubscription(); }
}

// ---------- Conta ----------
const friendly = (e) => {
  const m = String(e?.message || e || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already been registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return 'A criação de contas está desativada no Supabase.';
  if (/at least 6|Password should/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Veja o passo a passo (desativar "Confirm email").';
  if (/invalid.*email|Unable to validate email/i.test(m)) return 'Esse e-mail não parece válido.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com a internet.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  return m || 'Algo deu errado.';
};

export async function signIn(email, password) {
  if (!client) throw new Error('A sincronização ainda não carregou. Verifique a internet.');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error));
  session = data.session;
  await afterLogin();
}

export async function signUp(email, password) {
  if (!client) throw new Error('A sincronização ainda não carregou. Verifique a internet.');
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(friendly(error));
  if (!data.session) throw new Error('Conta criada, mas o Supabase pediu confirmação por e-mail. Desative "Confirm email" (veja o passo a passo) e toque em Entrar.');
  session = data.session;
  await afterLogin();
}

async function afterLogin() {
  queueAll();
  localStorage.removeItem(PULL_KEY);
  emit();
  await syncNow();
  refreshPushSubscription();
}

export async function signOut() {
  if (!client) return;
  await client.auth.signOut();
  session = null;
  localStorage.removeItem(PULL_KEY);
  status.state = 'off';
  emit();
}

export function queueAll() {
  const t = Date.now();
  for (const store of DATA_STORES) for (const x of S[store]) outbox[`${store}|${x.id}`] = { store, id: x.id, deleted: false, t };
  if (getNotifPrefs().updatedAt) outbox['settings|notif'] = { store: 'settings', id: 'notif', deleted: false, t };
  db.all('images').then((imgs) => {
    imgs.forEach((im) => { outbox[`images|${im.id}`] = { store: 'images', id: im.id, deleted: false, t }; });
    saveOutbox();
    schedule(500);
  });
  saveOutbox();
}

// ---------- Sincronizar ----------
export async function syncNow() {
  if (!client || !session) return;
  if (!navigator.onLine) { status.state = 'offline'; emit(); return; }
  if (syncing) { again = true; return; }
  syncing = true;
  status.state = 'syncing';
  emit();
  try {
    const changed = await pull();
    await push();
    status.state = 'ok';
    status.last = Date.now();
    status.error = '';
    if (changed) rerender();
  } catch (e) {
    status.state = 'error';
    status.error = friendly(e);
  } finally {
    syncing = false;
    emit();
    if (again) { again = false; schedule(300); }
  }
}

const imgPath = (id) => `${session.user.id}/${id}.jpg`;

async function push() {
  const entries = Object.entries(outbox);
  if (!entries.length) return;
  const uid = session.user.id;
  const rows = [];
  const done = [];
  for (const [key, e] of entries) {
    const base = { user_id: uid, store: e.store, id: e.id };
    if (e.store === 'images') {
      const rec = e.deleted ? null : await db.get('images', e.id);
      if (!rec) {
        await client.storage.from('imagens').remove([imgPath(e.id)]).catch(() => {});
        rows.push({ ...base, data: null, updated_at: e.t, deleted: true });
      } else {
        const { error } = await client.storage.from('imagens').upload(imgPath(e.id), rec.blob, { upsert: true, contentType: rec.blob.type || 'image/jpeg' });
        if (error) throw error;
        const { blob, ...meta } = rec;
        rows.push({ ...base, data: meta, updated_at: rec.createdAt || e.t, deleted: false });
      }
    } else if (e.store === 'settings') {
      const p = getNotifPrefs();
      if (p.updatedAt) rows.push({ ...base, data: p, updated_at: p.updatedAt, deleted: false });
    } else if (DATA_STORES.includes(e.store)) {
      const local = S[e.store].find((x) => x.id === e.id);
      if (e.deleted || !local) rows.push({ ...base, data: null, updated_at: e.t, deleted: true });
      else rows.push({ ...base, data: local, updated_at: local.updatedAt || e.t, deleted: false });
    }
    done.push([key, e.t]);
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await client.from('items').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,store,id' });
    if (error) throw error;
  }
  for (const [key, t] of done) if (outbox[key] && outbox[key].t === t) delete outbox[key];
  saveOutbox();
}

async function pull() {
  const last = localStorage.getItem(PULL_KEY);
  let cursor = last ? new Date(Date.parse(last) - 120000).toISOString() : '1970-01-01T00:00:00Z';
  let first = true;
  let maxTs = last || '';
  let changed = false;
  for (let page = 0; page < 100; page++) {
    let q = client.from('items').select('store,id,data,updated_at,deleted,server_ts').order('server_ts', { ascending: true }).limit(500);
    q = first ? q.gte('server_ts', cursor) : q.gt('server_ts', cursor);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data) if (await applyRow(row)) changed = true;
    if (data.length) {
      cursor = data[data.length - 1].server_ts;
      if (!maxTs || Date.parse(cursor) > Date.parse(maxTs)) maxTs = cursor;
    }
    if (data.length < 500) break;
    first = false;
  }
  if (maxTs) localStorage.setItem(PULL_KEY, maxTs);
  saveOutbox();
  return changed;
}

async function applyRow(row) {
  const key = `${row.store}|${row.id}`;
  const pending = outbox[key];
  const remoteTs = Number(row.updated_at) || 0;

  if (row.store === 'settings') {
    if (row.id !== 'notif' || !row.data) return false;
    if (remoteTs <= (getNotifPrefs().updatedAt || 0)) return false;
    setNotifPrefsFromRemote(row.data);
    delete outbox[key];
    return true;
  }

  if (row.store === 'images') {
    const local = await db.get('images', row.id);
    if (row.deleted) {
      if (!local || (pending && !pending.deleted && pending.t > remoteTs)) return false;
      await db.del('images', row.id);
      delete outbox[key];
      return true;
    }
    if (local && local.blob) return false;
    const { data: blob, error } = await client.storage.from('imagens').download(imgPath(row.id));
    if (error || !blob) return false;
    await db.put('images', { ...row.data, blob });
    return true;
  }

  if (!DATA_STORES.includes(row.store)) return false;
  const local = S[row.store].find((x) => x.id === row.id);
  const localTs = local ? (local.updatedAt || 0) : (pending ? pending.t : 0);
  if (remoteTs <= localTs) return false; // o que está no celular é mais novo
  if (row.deleted) {
    delete outbox[key];
    if (!local) return false;
    await db.del(row.store, row.id);
    S[row.store] = S[row.store].filter((x) => x.id !== row.id);
    return true;
  }
  if (!row.data) return false;
  await db.put(row.store, row.data);
  const i = S[row.store].findIndex((x) => x.id === row.id);
  if (i >= 0) S[row.store][i] = row.data; else S[row.store].push(row.data);
  delete outbox[key];
  return true;
}

// ---------- Notificações push ----------
const b64ToU8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
export const pushSupported = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export async function pushState() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = !!(reg && await reg.pushManager.getSubscription());
  } catch (e) { /* ignora */ }
  return { supported: true, permission: Notification.permission, subscribed };
}

async function saveSubscription(sub) {
  const j = sub.toJSON();
  const { error } = await client.from('push_subscriptions').upsert(
    { endpoint: j.endpoint, user_id: session.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador não aceita notificações. Use o app instalado pelo Chrome.');
  if (!session) throw new Error('Entre na sua conta primeiro.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações do Planner nas configurações do Android (Apps → Planner → Notificações).');
  const prefs = getNotifPrefs();
  if (!prefs.updatedAt) { const { setNotifPrefs } = await import('./notif.js'); setNotifPrefs(prefs); }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CONFIG.vapidPublicKey) });
  await saveSubscription(sub);
  await syncNow();
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (!sub) return;
  if (client && session) await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

async function refreshPushSubscription() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted' || !session) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await saveSubscription(sub);
  } catch (e) { /* tenta de novo na próxima abertura */ }
}

export async function testPush() {
  if (!client || !session) throw new Error('Entre na sua conta primeiro.');
  await syncNow();
  const { data, error } = await client.functions.invoke('lembretes', { body: { test: true } });
  if (error) {
    let status = 0, detail = '';
    try {
      status = error.context.status;
      const txt = await error.context.text();
      try { const j = JSON.parse(txt); detail = j.error || j.msg || j.message || txt; } catch (e) { detail = txt; }
    } catch (e) { detail = String(error.message || ''); }
    let hint = '';
    if (status === 401) hint = 'A verificação de JWT da função ainda está ligada ou o login expirou. Confira a Parte 2, passo 5, e tente "Sair da conta" e entrar de novo.';
    else if (status === 404) hint = 'Não encontrei a função "lembretes". Confira se o nome está exatamente assim (Parte 2).';
    else if (status === 500 || status === 546) hint = 'A função deu erro. Confira os 3 segredos (Parte 3) e veja Edge Functions → lembretes → Logs.';
    else if (!status) hint = 'Não consegui falar com a função. Confira a internet e a Parte 2.';
    const err = new Error(`${status ? 'Erro ' + status + ': ' : ''}${detail || 'sem detalhes'}${hint ? ' — ' + hint : ''}`);
    throw err;
  }
  return data || {};
}

export async function testLocalNotification() {
  if (!pushSupported()) throw new Error('Este navegador não aceita notificações.');
  if (Notification.permission !== 'granted') throw new Error('As notificações não estão permitidas neste aparelho.');
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Teste local do Planner', {
    body: 'Se você está vendo isto, o aparelho está pronto para receber notificações.',
    icon: './icons/icon-192.png', badge: './icons/badge-96.png', vibrate: [150, 100, 150], tag: 'teste-local', renotify: true,
    data: { url: './#/config' }
  });
}

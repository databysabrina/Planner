import { db, askPersistence, storageInfo, exportBackup, importBackup } from './db.js';
import { esc, uid, icon, todayISO, safeUrl, openSheet, closeSheet, closeAll, hasSheet, confirmBox, toast, compressImage, stamp } from './ui.js';
import { viewHoje, viewTarefas, viewTarefa, viewNotas, viewSoon, viewConfig, CAT, NOTE_TYPES } from './views.js';

// ---------------- Estado ----------------
const PREFS_KEY = 'planner-ui';
const S = {
  tasks: [],
  notes: [],
  ui: Object.assign({ tab: 'trabalho', noteFilter: 'todas', noteType: 'lembrete', lastBackup: 0, histQ: '' }, readPrefs())
};
function readPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; } }
function savePrefs() {
  const { histQ, ...keep } = S.ui;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(keep)); } catch (e) { /* ignora */ }
}

const view = document.getElementById('view');
const fab = document.getElementById('fab');
const findTask = (id) => S.tasks.find((t) => t.id === id);
const findNote = (id) => S.notes.find((n) => n.id === id);

async function saveTask(t) {
  t.updatedAt = Date.now();
  await db.put('tasks', t);
  const i = S.tasks.findIndex((x) => x.id === t.id);
  if (i >= 0) S.tasks[i] = t; else S.tasks.push(t);
}
async function saveNote(n) {
  n.updatedAt = Date.now();
  await db.put('notes', n);
  const i = S.notes.findIndex((x) => x.id === n.id);
  if (i >= 0) S.notes[i] = n; else S.notes.push(n);
}
function newTask(fields) {
  const now = Date.now();
  return { id: uid(), title: '', cat: 'trabalho', status: 'afazer', due: '', top: false, desc: '', links: [], subs: [], comments: [], imageIds: [], closing: null, createdAt: now, updatedAt: now, finishedAt: 0, ...fields };
}

// ---------------- Rotas ----------------
function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'hoje';
  const [path, qs] = raw.split('?');
  const parts = path.split('/');
  return { name: parts[0], id: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(qs || ''), key: path };
}
let lastKey = '';
let navigatedInApp = false;

const imgUrls = new Map();
async function fillImages() {
  for (const img of view.querySelectorAll('img[data-img]')) {
    const id = img.dataset.img;
    if (!imgUrls.has(id)) {
      const rec = await db.get('images', id);
      if (rec && rec.blob) imgUrls.set(id, URL.createObjectURL(rec.blob));
    }
    if (imgUrls.has(id)) img.src = imgUrls.get(id);
  }
}

async function render() {
  const r = route();
  const same = r.key === lastKey;
  const scroll = view.scrollTop;
  let html = '';
  let tab = r.name;

  switch (r.name) {
    case 'hoje': {
      html = viewHoje(S);
      const stale = !S.ui.lastBackup || Date.now() - S.ui.lastBackup > 14 * 86400000;
      if (stale && (S.tasks.length + S.notes.length) >= 5) {
        html = `<a class="win" href="#/config" style="display:block;border-color:var(--yellow)"><div class="win-body" style="flex-direction:row;align-items:center;gap:10px;color:var(--text)"><span class="tag" style="--c:var(--yellow)">backup</span><span style="font-size:13px;font-weight:700;flex:1 1 auto;min-width:0">Faz um tempo que você não salva uma cópia dos dados. Toque aqui.</span></div></a>` + html;
      }
      break;
    }
    case 'tarefas':
      if (r.q.get('tab')) { S.ui.tab = r.q.get('tab'); savePrefs(); }
      html = viewTarefas(S);
      break;
    case 'tarefa':
      html = viewTarefa(S, findTask(r.id));
      tab = 'tarefas';
      break;
    case 'notas':
      html = viewNotas(S);
      break;
    case 'agenda':
      html = viewSoon('Agenda', 'C:\\AGENDA\\', 'Fase 2', 'var(--blue)', 'O calendário no estilo do Google Agenda, com eventos Pessoais e de Trabalho, chega na próxima fase.');
      break;
    case 'estudos':
      html = viewSoon('Estudos', 'C:\\ESTUDOS\\', 'Fase 3', 'var(--lilac)', 'Projetos de estudo com disciplinas, grade semanal colorida e links importantes chegam na Fase 3.');
      break;
    case 'config':
      html = viewConfig(S, await storageInfo());
      tab = 'hoje';
      break;
    default:
      location.replace('#/hoje');
      return;
  }

  view.innerHTML = html;
  lastKey = r.key;
  view.scrollTop = same ? scroll : 0;
  document.querySelectorAll('#tabbar a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fab.hidden = r.name === 'tarefa' || r.name === 'config';
  bindViewInputs(r);
  fillImages();

  if (r.name === 'tarefas' && r.q.get('nova')) {
    history.replaceState(null, '', '#/tarefas');
    taskForm();
  }
}

// Campos que salvam ao digitar/sair (não são cliques).
function bindViewInputs(r) {
  const desc = view.querySelector('#task-desc');
  if (desc) {
    desc.addEventListener('change', async () => {
      const t = findTask(r.id);
      if (!t || t.desc === desc.value) return;
      t.desc = desc.value;
      await saveTask(t);
      toast('Descrição salva');
    });
  }
  const q = view.querySelector('#hist-q');
  if (q) {
    q.addEventListener('input', () => {
      S.ui.histQ = q.value;
      const pos = q.selectionStart;
      render().then(() => { const n = view.querySelector('#hist-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    });
  }
  const imgIn = view.querySelector('#img-input');
  if (imgIn) {
    imgIn.addEventListener('change', async () => {
      const t = findTask(r.id);
      if (!t || !imgIn.files.length) return;
      toast('Guardando imagem…');
      for (const file of imgIn.files) {
        try {
          const blob = await compressImage(file);
          const rec = { id: uid(), taskId: t.id, blob, name: file.name, createdAt: Date.now() };
          await db.put('images', rec);
          t.imageIds.push(rec.id);
        } catch (e) { toast('Não consegui ler uma das imagens'); }
      }
      await saveTask(t);
      render();
      toast('Imagem adicionada');
    });
  }
  const imp = view.querySelector('#import-input');
  if (imp) {
    imp.addEventListener('change', async () => {
      const file = imp.files[0];
      if (!file) return;
      const ok = await confirmBox('Restaurar este backup vai substituir TODAS as tarefas e notas atuais deste celular. Continuar?', { ok: 'Restaurar' });
      if (!ok) { imp.value = ''; return; }
      try {
        await importBackup(JSON.parse(await file.text()));
        await loadAll();
        toast('Backup restaurado');
        location.hash = '#/hoje';
      } catch (e) {
        toast(e.message || 'Arquivo inválido');
      }
      imp.value = '';
    });
  }
}

// ---------------- Folhas (formulários) ----------------
function taskForm(t) {
  const editing = !!t;
  const d = t || { title: '', cat: S.ui.tab === 'pessoal' ? 'pessoal' : 'trabalho', due: '', desc: '', top: false };
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="${editing ? 'Editar tarefa' : 'Nova tarefa'}"><div class="grip"></div>
    <h2 class="h2" style="font-size:24px;font-weight:800">${editing ? 'Editar tarefa' : 'Nova tarefa'}</h2>
    <label class="field">Título<input class="input" name="title" required maxlength="200" value="${esc(d.title)}" placeholder="Ex.: Corrigir provas do 1º ano" autofocus autocomplete="off"></label>
    <div class="field">Categoria<div class="seg" role="group" aria-label="Categoria">${Object.entries(CAT).map(([k, v]) => `<button type="button" style="--c:${v.color}" aria-pressed="${d.cat === k}" data-cat="${k}">${v.label}</button>`).join('')}</div></div>
    <label class="field">Prazo (opcional)<input class="input" type="date" name="due" value="${esc(d.due)}"></label>
    ${editing ? '' : '<label class="field">Descrição (opcional)<textarea class="textarea" name="desc" rows="3" placeholder="Detalhes…"></textarea></label>'}
    <label class="check" style="min-height:40px"><input type="checkbox" name="top" ${d.top ? 'checked' : ''} style="width:20px;height:20px;accent-color:#FFE45C"><span class="check-text">Prioridade do dia (aparece no topo da aba Hoje)</span></label>
    <button class="btn block" type="submit" style="--c:var(--orange)">${editing ? 'Salvar alterações' : 'Criar tarefa'}</button>
  </form>`);
  let cat = d.cat;
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    el.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get('title') || '').trim();
    if (!title) return;
    if (editing) {
      Object.assign(t, { title, cat, due: f.get('due') || '', top: !!f.get('top') });
      await saveTask(t);
      closeSheet();
      render();
      toast('Tarefa atualizada');
    } else {
      const nt = newTask({ title, cat, due: f.get('due') || '', desc: String(f.get('desc') || ''), top: !!f.get('top') });
      await saveTask(nt);
      S.ui.tab = cat; savePrefs();
      closeSheet();
      location.hash = '#/tarefa/' + nt.id;
      toast('Tarefa criada');
    }
  });
}

function closingModal(t, { edit = false } = {}) {
  const c = t.closing || { onde: '', para: '', obs: '' };
  const el = openSheet(`<form class="dialog" role="dialog" aria-label="Notas de encerramento">
    <div class="dialog-bar"><span>[C:\\ENCERRAMENTO\\]</span><button type="button" data-close aria-label="Cancelar" style="background:none;border:0;color:inherit;font:inherit;min-width:32px;min-height:32px">×</button></div>
    <div class="dialog-body">
      <h2 class="h2" style="font-weight:800;line-height:1.15">${edit ? 'Notas de encerramento' : 'Antes de finalizar, registre:'}</h2>
      <p class="sub" style="margin:0">${esc(t.title)}</p>
      <label class="field req">Onde salvei<input class="input" name="onde" value="${esc(c.onde)}" placeholder="Ex.: Drive › Turmas › 1º A" autocomplete="off"></label>
      <label class="field req">Para quem enviei<input class="input" name="para" value="${esc(c.para)}" placeholder="Ex.: coordenação, por e-mail" autocomplete="off"></label>
      <label class="field req">Observações finais<textarea class="textarea" name="obs" rows="3" placeholder="O que vale lembrar depois?">${esc(c.obs)}</textarea></label>
      <p class="sub" id="close-hint" style="margin:0;font-size:12px"></p>
      <div class="grid2"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit" id="close-ok">${edit ? 'Salvar' : 'Concluir'}</button></div>
    </div>
  </form>`, { center: true });
  const form = el.querySelector('form');
  const ok = el.querySelector('#close-ok');
  const hint = el.querySelector('#close-hint');
  const check = () => {
    const f = new FormData(form);
    const filled = ['onde', 'para', 'obs'].some((k) => String(f.get(k) || '').trim());
    ok.disabled = !filled;
    hint.textContent = filled ? (edit ? '' : 'Pronto! A tarefa vai para o Histórico com estas notas.') : 'Preencha pelo menos um campo para continuar.';
  };
  form.addEventListener('input', check);
  check();
  setTimeout(() => form.querySelector('input').focus(), 80);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ok.disabled) return;
    const f = new FormData(form);
    t.closing = { onde: String(f.get('onde')).trim(), para: String(f.get('para')).trim(), obs: String(f.get('obs')).trim() };
    if (!edit) { t.status = 'final'; t.finishedAt = Date.now(); t.top = false; }
    await saveTask(t);
    closeSheet();
    if (edit) { render(); toast('Notas atualizadas'); return; }
    S.ui.tab = 'historico'; savePrefs();
    if (route().name === 'tarefa') location.hash = '#/tarefas'; else render();
    toast('Tarefa finalizada e guardada no Histórico');
  });
}

function linkForm(t) {
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="Adicionar link"><div class="grip"></div>
    <h2 class="h2" style="font-weight:800">Adicionar link</h2>
    <label class="field">Endereço (URL)<input class="input" name="url" type="text" inputmode="url" autocapitalize="off" spellcheck="false" required placeholder="https://drive.google.com/…" autofocus autocomplete="off"></label>
    <label class="field">Nome (opcional)<input class="input" name="label" placeholder="Ex.: Planilha de notas" autocomplete="off"></label>
    <button class="btn block" type="submit" style="--c:var(--yellow)">Adicionar</button>
  </form>`);
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const url = safeUrl(f.get('url'));
    if (!url) { toast('Esse endereço não parece um link válido'); return; }
    t.links.push({ id: uid(), url, label: String(f.get('label') || '').trim() });
    await saveTask(t);
    closeSheet();
    render();
  });
}

function imageViewer(t, id) {
  const el = openSheet(`<div class="viewer" role="dialog" aria-label="Imagem"><img src="${imgUrls.get(id) || ''}" alt="Imagem anexada">
    <div class="grid2" style="width:100%"><button class="btn danger" type="button" data-del>Excluir imagem</button><button class="btn" type="button" style="--c:var(--blue)" data-close>Fechar</button></div></div>`, { center: true });
  el.querySelector('[data-del]').addEventListener('click', async () => {
    closeSheet();
    if (!(await confirmBox('Excluir esta imagem?', { ok: 'Excluir' }))) return;
    t.imageIds = t.imageIds.filter((x) => x !== id);
    await db.del('images', id);
    if (imgUrls.has(id)) { URL.revokeObjectURL(imgUrls.get(id)); imgUrls.delete(id); }
    await saveTask(t);
    render();
  });
}

function noteSheet(n) {
  let type = n.type;
  let pinned = !!n.pinned;
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="Editar nota"><div class="grip"></div>
    <div class="row" style="justify-content:space-between"><h2 class="h2" style="font-weight:800">Nota</h2><span class="sub" style="margin:0;font-size:12px">${esc(stamp(n.updatedAt))}</span></div>
    <div class="composer-types" role="group" aria-label="Tipo">${Object.entries(NOTE_TYPES).map(([k, v]) => `<button type="button" class="fchip" style="--c:${v.c}" aria-pressed="${type === k}" data-type="${k}">${v.label}</button>`).join('')}</div>
    <label class="field"><span class="sr-only">Texto</span><textarea class="textarea" name="text" rows="4" required>${esc(n.text)}</textarea></label>
    <button type="button" class="btn ghost" data-pin aria-pressed="${pinned}">${icon.pin(pinned)}<span>${pinned ? 'Fixada na aba Hoje' : 'Fixar na aba Hoje'}</span></button>
    <button class="btn block" type="submit" style="--c:var(--yellow)">Salvar</button>
    <div class="grid2"><button class="btn ghost sm" type="button" data-to-task="pessoal">Virar tarefa pessoal</button><button class="btn ghost sm" type="button" data-to-task="trabalho">Virar tarefa de trabalho</button></div>
    <button class="btn danger sm" type="button" data-del>Excluir nota</button>
  </form>`);
  el.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    type = b.dataset.type;
    el.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  const pinBtn = el.querySelector('[data-pin]');
  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    pinBtn.setAttribute('aria-pressed', pinned);
    pinBtn.innerHTML = `${icon.pin(pinned)}<span>${pinned ? 'Fixada na aba Hoje' : 'Fixar na aba Hoje'}</span>`;
  });
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = String(new FormData(form).get('text') || '').trim();
    if (!text) return;
    Object.assign(n, { text, type, pinned });
    await saveNote(n);
    closeSheet();
    render();
  });
  el.querySelectorAll('[data-to-task]').forEach((b) => b.addEventListener('click', async () => {
    const text = String(new FormData(form).get('text') || '').trim() || n.text;
    const [first, ...rest] = text.split('\n');
    const t = newTask({ title: first.slice(0, 200), desc: rest.join('\n').trim(), cat: b.dataset.toTask });
    await saveTask(t);
    closeSheet();
    const del = await confirmBox('Tarefa criada! Quer apagar a nota original?', { ok: 'Apagar nota', danger: false });
    if (del) { await db.del('notes', n.id); S.notes = S.notes.filter((x) => x.id !== n.id); }
    location.hash = '#/tarefa/' + t.id;
  }));
  el.querySelector('[data-del]').addEventListener('click', async () => {
    closeSheet();
    if (!(await confirmBox('Excluir esta nota?', { ok: 'Excluir' }))) return;
    await db.del('notes', n.id);
    S.notes = S.notes.filter((x) => x.id !== n.id);
    render();
  });
}

function quickAdd() {
  const el = openSheet(`<div class="sheet" role="dialog" aria-label="Adicionar"><div class="grip"></div>
    <h2 class="h2" style="font-size:24px;font-weight:800">Adicionar…</h2>
    <div class="quick-grid">
      <button class="quick" type="button" style="--c:var(--orange)" data-q="task">Tarefa<span>com prazo e checklist</span></button>
      <button class="quick" type="button" style="--c:var(--yellow)" data-q="note">Nota<span>lembrete ou prioridade</span></button>
      <button class="quick" type="button" style="--c:var(--blue)" disabled>Evento<span>chega na Fase 2</span></button>
      <button class="quick" type="button" style="--c:var(--lilac)" disabled>Sessão de estudo<span>chega na Fase 3</span></button>
    </div></div>`);
  el.querySelector('[data-q="task"]').addEventListener('click', () => { closeSheet(); taskForm(); });
  el.querySelector('[data-q="note"]').addEventListener('click', () => {
    closeSheet();
    if (route().name !== 'notas') location.hash = '#/notas';
    setTimeout(() => { const i = view.querySelector('[data-form="add-note"] input[name="text"]'); if (i) i.focus(); }, 120);
  });
}

// ---------------- Cliques ----------------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const r = route();
  const t = r.name === 'tarefa' ? findTask(r.id) : null;

  switch (act) {
    case 'quick-add':
      if (r.name === 'tarefas') taskForm(); else quickAdd();
      break;
    case 'new-task': taskForm(); break;
    case 'open-task': location.hash = '#/tarefa/' + el.dataset.id; break;
    case 'go': location.hash = el.dataset.v; break;
    case 'back':
      if (navigatedInApp && history.length > 1) history.back();
      else location.hash = t && t.status === 'final' ? '#/tarefas?tab=historico' : '#/tarefas';
      break;
    case 'tab':
      S.ui.tab = el.dataset.v; savePrefs();
      if (location.hash !== '#/tarefas') history.replaceState(null, '', '#/tarefas');
      render();
      break;
    case 'finish-task': { const ft = findTask(el.dataset.id); if (ft) closingModal(ft); break; }
    case 'status':
      if (!t) break;
      if (el.dataset.v === 'final') { closingModal(t); break; }
      t.status = el.dataset.v; await saveTask(t); render();
      break;
    case 'toggle-top': if (t) { t.top = !t.top; await saveTask(t); render(); toast(t.top ? 'Vai aparecer no topo da aba Hoje' : 'Removida das prioridades'); } break;
    case 'toggle-sub': if (t) { const s = t.subs.find((x) => x.id === el.dataset.id); if (s) { s.done = !s.done; await saveTask(t); render(); } } break;
    case 'del-sub': if (t) { t.subs = t.subs.filter((x) => x.id !== el.dataset.id); await saveTask(t); render(); } break;
    case 'add-link': if (t) linkForm(t); break;
    case 'del-link':
      if (t && await confirmBox('Remover este link?', { ok: 'Remover' })) { t.links = t.links.filter((x) => x.id !== el.dataset.id); await saveTask(t); render(); }
      break;
    case 'view-img': if (t) imageViewer(t, el.dataset.id); break;
    case 'del-comment':
      if (t && await confirmBox('Remover este comentário?', { ok: 'Remover' })) { t.comments = t.comments.filter((x) => x.id !== el.dataset.id); await saveTask(t); render(); }
      break;
    case 'edit-task': if (t) taskForm(t); break;
    case 'delete-task':
      if (t && await confirmBox(`Excluir a tarefa "${t.title}"? Isso não pode ser desfeito.`, { ok: 'Excluir' })) {
        for (const id of t.imageIds) await db.del('images', id);
        await db.del('tasks', t.id);
        S.tasks = S.tasks.filter((x) => x.id !== t.id);
        location.hash = '#/tarefas';
        toast('Tarefa excluída');
      }
      break;
    case 'reopen': if (t) { t.status = 'andamento'; t.finishedAt = 0; await saveTask(t); render(); toast('Tarefa reaberta (as notas de encerramento foram mantidas)'); } break;
    case 'edit-closing': if (t) closingModal(t, { edit: true }); break;
    case 'note-type': S.ui.noteType = el.dataset.v; savePrefs(); render(); break;
    case 'note-filter': S.ui.noteFilter = el.dataset.v; savePrefs(); render(); break;
    case 'open-note': { const n = findNote(el.dataset.id); if (n) noteSheet(n); break; }
    case 'export': {
      try {
        const data = await exportBackup();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `planner-backup-${todayISO()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        S.ui.lastBackup = Date.now(); savePrefs();
        render();
        toast('Backup baixado. Guarde o arquivo no Drive!');
      } catch (err) { toast('Não consegui gerar o backup'); }
      break;
    }
  }
});

// ---------------- Formulários da página ----------------
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const text = String(new FormData(form).get('text') || '').trim();
  if (!text) return;
  const r = route();
  const t = r.name === 'tarefa' ? findTask(r.id) : null;
  switch (form.dataset.form) {
    case 'add-sub': if (t) { t.subs.push({ id: uid(), text, done: false }); await saveTask(t); } break;
    case 'add-comment': if (t) { t.comments.push({ id: uid(), text, at: Date.now() }); await saveTask(t); } break;
    case 'add-note': {
      const now = Date.now();
      await saveNote({ id: uid(), type: S.ui.noteType, text, pinned: false, createdAt: now, updatedAt: now });
      toast('Nota salva');
      break;
    }
  }
  await render();
  const again = view.querySelector(`[data-form="${form.dataset.form}"] input[name="text"]`);
  if (again) again.focus();
});

window.addEventListener('hashchange', () => {
  navigatedInApp = true;
  if (hasSheet()) closeAll();
  render();
});

// ---------------- Início ----------------
async function loadAll() {
  [S.tasks, S.notes] = await Promise.all([db.all('tasks'), db.all('notes')]);
}

(async function start() {
  try {
    await loadAll();
  } catch (e) {
    view.innerHTML = '<div class="empty">Não consegui abrir o armazenamento deste navegador. Tente abrir pelo Chrome, fora da aba anônima.</div>';
    return;
  }
  render();
  askPersistence();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();

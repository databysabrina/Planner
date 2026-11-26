// Cronogramas de estudo: projetos, disciplinas, grade semanal e links.
import { esc, uid, icon, winBar, todayISO, addDays, parseISO, daysFromToday, safeUrl, openSheet, closeSheet, confirmBox, toast, go, clearDraft } from './ui.js';
import { S, savePrefs, saveItem, removeItem, occurrences, rerender, PALETTE, toMin } from './core.js';

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const LINK_TYPES = { pasta: ['PASTA', 'var(--yellow)'], pdf: ['PDF', 'var(--pink)'], aula: ['AULA', 'var(--blue)'], site: ['SITE', 'var(--lilac)'], outro: ['LINK', 'var(--peach)'] };
const folderName = (name) => 'C:\\' + (name || 'PROJETO').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 22) + '\\';
const autoAbbr = (name) => (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/)[0]?.slice(0, 4).toUpperCase() || '';

function weeklyMinutes(p) {
  return (p.subjects || []).reduce((a, s) => a + (s.slots || []).reduce((b, sl) => b + Math.max(0, toMin(sl.end) - toMin(sl.start)), 0), 0);
}
const fmtHours = (m) => !m ? '0h' : (m % 60 ? (m / 60).toFixed(1).replace('.', ',') : m / 60) + 'h';

function nextSession(p) {
  const today = todayISO();
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const o = occurrences(today, addDays(today, 7)).find((x) => x.kind === 'study' && x.id === p.id && (x.date > today || x.start >= nowHM));
  if (!o) return '';
  const n = daysFromToday(o.date);
  return `${n === 0 ? 'hoje' : n === 1 ? 'amanhã' : WD[parseISO(o.date).getDay()]} ${o.start} · ${o.title}`;
}
function countdown(p) {
  if (!p.examDate) return '';
  const n = daysFromToday(p.examDate);
  if (n > 1) return `prova/meta em ${n} dias`;
  if (n === 1) return 'prova/meta amanhã';
  if (n === 0) return 'prova/meta hoje!';
  return `data passou (${parseISO(p.examDate).toLocaleDateString('pt-BR')})`;
}

// ---------------- Telas ----------------
export function viewEstudos() {
  const list = [...S.projects].sort((a, b) => a.createdAt - b.createdAt);
  return `<div class="head"><div><div class="path">C:\\ESTUDOS\\</div><h1 class="h1">Projetos</h1></div>
    <button class="btn sm" type="button" style="--c:var(--lilac);--s:var(--yellow)" data-act="proj-new">+ Projeto</button></div>
  ${list.length ? list.map((p) => {
    const mins = weeklyMinutes(p), next = nextSession(p), cd = countdown(p);
    return `<button type="button" class="folder" data-act="go" data-v="#/projeto/${p.id}" style="--c:${p.color}">
      <span class="folder-tab">${esc(folderName(p.name))}</span>
      <span class="folder-body">
        <span class="folder-title">${esc(p.name)}</span>
        <span class="meta"><span>${(p.subjects || []).length} disciplina${(p.subjects || []).length === 1 ? '' : 's'}</span><span>${fmtHours(mins)} por semana</span>${cd ? `<span style="color:var(--yellow)">${esc(cd)}</span>` : ''}</span>
        ${next ? `<span style="font-size:13px;font-weight:800;color:${p.color}">próxima: ${esc(next)}</span>` : ''}
      </span></button>`;
  }).join('') : `<div class="empty">Crie um projeto para cada objetivo, por exemplo <b>Concurso TAE do IF</b> ou <b>Escrita Criativa</b>.<br>Dentro dele você cadastra as disciplinas e os horários, e a grade semanal se monta sozinha.</div>`}`;
}

export function viewProjeto(p) {
  if (!p) return `<button class="back" type="button" data-act="go" data-v="#/estudos">${icon.back}Projetos</button><div class="empty">Este projeto não existe mais.</div>`;
  const sub = S.ui.estSub;
  const tabs = [['visao', 'Visão geral'], ['disciplinas', 'Disciplinas'], ['grade', 'Grade'], ['links', 'Links']];
  const cd = countdown(p);
  let body = '';
  if (sub === 'visao') body = visao(p);
  else if (sub === 'disciplinas') body = disciplinas(p);
  else if (sub === 'links') body = links(p);
  else body = grade(p);
  return `<div class="row" style="justify-content:space-between">
    <button class="back" type="button" data-act="go" data-v="#/estudos">${icon.back}Projetos</button>
    <div class="row" style="gap:2px"><button class="icon-btn" type="button" data-act="proj-edit" aria-label="Editar projeto">${icon.edit}</button><button class="icon-btn" type="button" data-act="proj-del" aria-label="Excluir projeto">${icon.trash}</button></div></div>
  <div><div class="path" style="color:${p.color}">${esc(folderName(p.name))}</div><h1 class="h1" style="font-size:30px;line-height:1.1;overflow-wrap:anywhere">${esc(p.name)}</h1></div>
  <div class="row" style="gap:8px;flex-wrap:wrap">${cd ? `<span class="pill" style="background:var(--yellow);color:var(--ink)">${esc(cd)}</span>` : ''}<span class="pill">${fmtHours(weeklyMinutes(p))} por semana</span></div>
  <div class="chips" role="group" aria-label="Seções do projeto">${tabs.map(([id, l]) => `<button type="button" class="fchip" style="--c:${p.color}" aria-pressed="${sub === id}" data-act="est-sub" data-v="${id}">${l}</button>`).join('')}</div>
  ${body}`;
}

function visao(p) {
  return `<section class="win">${winBar('OBJETIVO', p.color)}
    <div class="win-body">${p.goal ? `<p class="desc">${esc(p.goal)}</p>` : '<p class="sub" style="margin:0">Sem descrição. Toque no lápis lá em cima para escrever o objetivo.</p>'}
    ${p.examDate ? `<p class="sub" style="margin:0">Data da prova/meta: <b style="color:var(--text)">${esc(parseISO(p.examDate).toLocaleDateString('pt-BR'))}</b></p>` : ''}</div>
  </section>
  <section class="win">${winBar('RESUMO_SEMANAL', 'var(--peach)')}
    <div class="win-body">${(p.subjects || []).length ? p.subjects.map((s) => {
      const m = (s.slots || []).reduce((a, sl) => a + Math.max(0, toMin(sl.end) - toMin(sl.start)), 0);
      return `<div class="row" style="justify-content:space-between"><span class="row" style="gap:8px;min-width:0"><span class="abbr" style="background:${s.color}">${esc(s.abbr)}</span><span style="font-weight:700;overflow-wrap:anywhere">${esc(s.name)}</span></span><span class="due" style="color:var(--peach)">${fmtHours(m)}</span></div>`;
    }).join('') : '<p class="sub" style="margin:0">Nenhuma disciplina ainda.</p>'}</div>
  </section>`;
}

function disciplinas(p) {
  return `<div class="list">${(p.subjects || []).map((s) => `
    <button type="button" class="card" data-act="subj-edit" data-id="${s.id}" style="flex-direction:row;align-items:center;gap:12px">
      <span class="abbr lg" style="background:${s.color}">${esc(s.abbr)}</span>
      <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:800;overflow-wrap:anywhere">${esc(s.name)}</span>
      <span style="font-size:12px;color:var(--muted)">${(s.slots || []).length ? s.slots.map((sl) => `${WD[sl.weekday]} ${sl.start}–${sl.end}`).join(' · ') : 'sem horário definido'}</span></span>
    </button>`).join('')}
    <button class="dashed" type="button" data-act="subj-new">+ Disciplina e horários</button></div>`;
}

function grade(p) {
  const slots = (p.subjects || []).flatMap((s) => (s.slots || []).map((sl) => ({ ...sl, s })));
  if (!slots.length) return `<div class="empty">A grade aparece aqui quando você cadastrar disciplinas com dias e horários.<br><button class="link-btn" type="button" data-act="subj-new">+ Cadastrar disciplina</button></div>`;
  const days = [1, 2, 3, 4, 5, 6];
  if (slots.some((x) => x.weekday === 0)) days.push(0);
  const hours = [...new Set(slots.map((x) => Math.floor(toMin(x.start) / 60)))].sort((a, b) => a - b);
  let rows = '';
  for (const h of hours) {
    const cells = days.map((d) => {
      const here = slots.filter((x) => x.weekday === d && Math.floor(toMin(x.start) / 60) === h);
      if (!here.length) return '<span class="gcell"></span>';
      const f = here[0];
      return `<span class="gcell on" style="background:${f.s.color}" title="${esc(f.s.name)} ${esc(f.start)}–${esc(f.end)}">${esc(f.s.abbr)}${here.length > 1 ? `<small>+${here.length - 1}</small>` : ''}</span>`;
    }).join('');
    rows += `<div class="grow" style="--n:${days.length}"><span class="gtime">${h}h</span>${cells}</div>`;
  }
  return `<section class="win">${winBar('GRADE_SEMANAL', 'var(--yellow)')}
    <div class="win-body" style="gap:4px;padding:10px">
      <div class="grow ghead" style="--n:${days.length}"><span></span>${days.map((d) => `<span>${WD[d].toUpperCase()}</span>`).join('')}</div>
      ${rows}
    </div>
    <div class="legend" style="padding:0 12px 12px">${p.subjects.filter((s) => (s.slots || []).length).map((s) => `<span style="--c:${s.color}">${esc(s.abbr)} = ${esc(s.name)}</span>`).join('')}</div>
  </section>`;
}

function links(p) {
  return `<div class="list">${(p.links || []).map((l) => {
    const [lab, col] = LINK_TYPES[l.type] || LINK_TYPES.outro;
    return `<div class="card" style="flex-direction:row;align-items:center;gap:10px;padding:8px 8px 8px 12px">
      <span class="ltype" style="background:${col}">${lab}</span>
      <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" style="flex:1;min-width:0;font-weight:800;color:var(--text);overflow-wrap:anywhere;min-height:40px;display:flex;align-items:center">${esc(l.label || l.url)}</a>
      <button class="icon-btn" type="button" data-act="plink-del" data-id="${l.id}" aria-label="Remover link">${icon.trash}</button></div>`;
  }).join('')}
  <button class="dashed" type="button" data-act="plink-add">+ Link importante</button></div>`;
}

// ---------------- Formulários ----------------
const paletteHtml = (current) => `<div class="palette" role="radiogroup" aria-label="Cor">${PALETTE.map((c) => `<label class="swatch" style="background:${c}"><input type="radio" name="color" value="${c}" ${c === current ? 'checked' : ''} class="sr-only"><span class="sr-only">${c}</span></label>`).join('')}</div>`;

export function projectForm(p) {
  const editing = !!p;
  const d = p || { name: '', color: PALETTE[(S.projects.length + 2) % PALETTE.length], goal: '', examDate: '' };
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="${editing ? 'Editar projeto' : 'Novo projeto'}"><div class="grip"></div>
    <h2 class="h2" style="font-size:24px;font-weight:800">${editing ? 'Editar projeto' : 'Novo projeto de estudo'}</h2>
    <label class="field">Nome<input class="input" name="name" required maxlength="80" value="${esc(d.name)}" placeholder="Ex.: Concurso TAE do IF" autocomplete="off" ${editing ? '' : 'data-draft="proj:new:name" autofocus'}></label>
    <div class="field">Cor${paletteHtml(d.color)}</div>
    <label class="field">Objetivo (opcional)<textarea class="textarea" name="goal" rows="3" placeholder="O que você quer alcançar com este projeto?" ${editing ? '' : 'data-draft="proj:new:goal"'}>${esc(d.goal)}</textarea></label>
    <label class="field">Data da prova ou meta (opcional)<input class="input" type="date" name="examDate" value="${esc(d.examDate)}"></label>
    <button class="btn block" type="submit" style="--c:var(--lilac);--s:var(--yellow)">${editing ? 'Salvar' : 'Criar projeto'}</button>
  </form>`);
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name') || '').trim();
    if (!name) return;
    const data = { name, color: String(f.get('color') || d.color), goal: String(f.get('goal') || '').trim(), examDate: String(f.get('examDate') || '') };
    if (editing) { Object.assign(p, data); await saveItem('projects', p); closeSheet(); rerender(); toast('Projeto atualizado'); return; }
    const np = await saveItem('projects', { id: uid(), subjects: [], links: [], ...data });
    clearDraft('proj:new:name'); clearDraft('proj:new:goal');
    S.ui.estSub = 'disciplinas'; savePrefs();
    closeSheet();
    go('#/projeto/' + np.id);
    toast('Projeto criado. Agora cadastre as disciplinas.');
  });
}

const slotRow = (sl) => `<div class="slot" data-slot>
  <label><span class="sr-only">Dia</span><select class="input" name="wd">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<option value="${w}" ${sl.weekday === w ? 'selected' : ''}>${WDL[w]}</option>`).join('')}</select></label>
  <label><span class="sr-only">Início</span><input class="input" type="time" name="st" value="${esc(sl.start)}"></label>
  <label><span class="sr-only">Fim</span><input class="input" type="time" name="en" value="${esc(sl.end)}"></label>
  <button class="icon-btn" type="button" data-rm aria-label="Remover horário">${icon.trash}</button></div>`;

function subjectForm(p, s) {
  const editing = !!s;
  const used = (p.subjects || []).map((x) => x.color);
  const d = s || { name: '', abbr: '', color: PALETTE.find((c) => !used.includes(c)) || PALETTE[0], slots: [{ weekday: 1, start: '19:00', end: '20:00' }] };
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="${editing ? 'Editar disciplina' : 'Nova disciplina'}" novalidate><div class="grip"></div>
    <h2 class="h2" style="font-size:24px;font-weight:800">${editing ? 'Editar disciplina' : 'Nova disciplina'}</h2>
    <div class="row" style="align-items:flex-end">
      <label class="field" style="flex:1">Nome<input class="input" name="name" maxlength="60" value="${esc(d.name)}" placeholder="Ex.: Língua Portuguesa" autocomplete="off" ${editing ? '' : 'autofocus'}></label>
      <label class="field" style="width:92px">Sigla<input class="input" name="abbr" maxlength="5" value="${esc(d.abbr)}" placeholder="PORT" autocomplete="off" style="text-transform:uppercase"></label>
    </div>
    <div class="field">Cor na grade${paletteHtml(d.color)}</div>
    <div class="field">Dias e horários de estudo<div class="slots">${d.slots.map(slotRow).join('')}</div>
      <button class="dashed" type="button" data-add-slot style="margin-top:4px">+ Outro horário</button></div>
    <p class="sub" id="sj-err" style="margin:0;color:var(--pink);font-weight:800" hidden></p>
    <button class="btn block" type="submit" style="--c:var(--lilac);--s:var(--yellow)">${editing ? 'Salvar' : 'Adicionar disciplina'}</button>
    ${editing ? '<button class="btn danger sm" type="button" data-del>Excluir disciplina</button>' : ''}
  </form>`);
  const form = el.querySelector('form');
  const nameIn = form.querySelector('[name=name]'), abbrIn = form.querySelector('[name=abbr]');
  let abbrTouched = editing;
  abbrIn.addEventListener('input', () => { abbrTouched = true; });
  nameIn.addEventListener('input', () => { if (!abbrTouched) abbrIn.value = autoAbbr(nameIn.value); });
  const box = form.querySelector('.slots');
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('[data-slot]').remove(); });
  form.querySelector('[data-add-slot]').addEventListener('click', () => {
    const last = [...box.querySelectorAll('[data-slot]')].pop();
    const base = last ? { weekday: (Number(last.querySelector('[name=wd]').value) % 6) + 1, start: last.querySelector('[name=st]').value, end: last.querySelector('[name=en]').value } : { weekday: 1, start: '19:00', end: '20:00' };
    box.insertAdjacentHTML('beforeend', slotRow(base));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('#sj-err');
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    const name = nameIn.value.trim();
    if (!name) return fail('Dê um nome à disciplina.');
    const slots = [];
    for (const row of box.querySelectorAll('[data-slot]')) {
      const st = row.querySelector('[name=st]').value, en = row.querySelector('[name=en]').value;
      if (!st || !en) return fail('Preencha início e fim de todos os horários (ou remova o horário).');
      if (toMin(en) <= toMin(st)) return fail('Em cada horário, o fim precisa ser depois do início.');
      slots.push({ id: uid(), weekday: Number(row.querySelector('[name=wd]').value), start: st, end: en });
    }
    slots.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || toMin(a.start) - toMin(b.start));
    const data = { name, abbr: (abbrIn.value.trim() || autoAbbr(name)).toUpperCase().slice(0, 5), color: String(new FormData(form).get('color') || d.color), slots };
    if (editing) Object.assign(s, data); else p.subjects = [...(p.subjects || []), { id: uid(), ...data }];
    await saveItem('projects', p);
    closeSheet();
    rerender();
    toast(editing ? 'Disciplina atualizada' : 'Disciplina adicionada');
  });
  const del = form.querySelector('[data-del]');
  if (del) del.addEventListener('click', async () => {
    closeSheet();
    if (!(await confirmBox(`Excluir a disciplina "${s.name}" e os horários dela?`, { ok: 'Excluir' }))) return;
    p.subjects = p.subjects.filter((x) => x.id !== s.id);
    await saveItem('projects', p);
    rerender();
  });
}

function projectLinkForm(p) {
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="Adicionar link"><div class="grip"></div>
    <h2 class="h2" style="font-weight:800">Link importante</h2>
    <label class="field">Endereço (URL)<input class="input" name="url" type="text" inputmode="url" autocapitalize="off" spellcheck="false" required placeholder="https://drive.google.com/…" autofocus autocomplete="off" data-draft="plink:${p.id}:url"></label>
    <label class="field">Nome<input class="input" name="label" placeholder="Ex.: Edital completo" autocomplete="off" data-draft="plink:${p.id}:label"></label>
    <div class="field">Tipo<div class="chips wrap">${Object.entries(LINK_TYPES).map(([k, [l, c]], i) => `<label class="fchip" style="--c:${c};display:inline-flex;align-items:center;cursor:pointer"><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''} class="sr-only">${l}</label>`).join('')}</div></div>
    <button class="btn block" type="submit" style="--c:var(--yellow)">Adicionar</button>
  </form>`);
  const syncChips = () => el.querySelectorAll('input[name=type]').forEach((r) => r.parentElement.setAttribute('aria-pressed', r.checked));
  el.addEventListener('change', syncChips); syncChips();
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const url = safeUrl(f.get('url'));
    if (!url) { toast('Esse endereço não parece um link válido'); return; }
    p.links = [...(p.links || []), { id: uid(), url, label: String(f.get('label') || '').trim(), type: String(f.get('type') || 'outro') }];
    await saveItem('projects', p);
    clearDraft(`plink:${p.id}:url`); clearDraft(`plink:${p.id}:label`);
    closeSheet();
    rerender();
  });
}

// ---------------- Ações ----------------
const cur = (r) => (r.name === 'projeto' ? S.projects.find((x) => x.id === r.id) : null);
export const estudosActions = {
  'proj-new': () => projectForm(),
  'est-sub': (el) => { S.ui.estSub = el.dataset.v; savePrefs(); rerender(); },
  'proj-edit': (el, r) => { const p = cur(r); if (p) projectForm(p); },
  'proj-del': async (el, r) => {
    const p = cur(r);
    if (p && await confirmBox(`Excluir o projeto "${p.name}" com todas as disciplinas, horários e links?`, { ok: 'Excluir' })) { await removeItem('projects', p.id); go('#/estudos'); toast('Projeto excluído'); }
  },
  'subj-new': (el, r) => { const p = cur(r); if (p) subjectForm(p); },
  'subj-edit': (el, r) => { const p = cur(r); const s = p && p.subjects.find((x) => x.id === el.dataset.id); if (s) subjectForm(p, s); },
  'plink-add': (el, r) => { const p = cur(r); if (p) projectLinkForm(p); },
  'plink-del': async (el, r) => {
    const p = cur(r);
    if (p && await confirmBox('Remover este link?', { ok: 'Remover' })) { p.links = p.links.filter((x) => x.id !== el.dataset.id); await saveItem('projects', p); rerender(); }
  }
};
export const fabForEstudos = (r) => { const p = cur(r); if (p) subjectForm(p); else projectForm(); };

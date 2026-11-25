// Agenda no estilo Google Agenda: Mês, Semana e Programação.
import { esc, uid, icon, todayISO, addDays, parseISO, openSheet, closeSheet, confirmBox, toast, go, clearDraft } from './ui.js';
import { S, savePrefs, saveItem, removeItem, occurrences, matchesFilter, rerender, COLORS, CAT_LABEL, rangeLabel, toMin } from './core.js';

const MON = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WD3 = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sundayOf = (d) => addDays(d, -parseISO(d).getDay());
export const longDate = (d) => { const x = parseISO(d); return `${WDL[x.getDay()]}, ${x.getDate()} de ${MON[x.getMonth()]}`; };

const FILTERS = [['tudo', 'Tudo', 'var(--text)', 'var(--yellow)'], ['pessoal', 'Pessoal', 'var(--pink)'], ['trabalho', 'Trabalho', 'var(--blue)'], ['estudos', 'Estudos', 'var(--lilac)'], ['prazo', 'Prazos', 'var(--orange)']];
const HOUR = 44, H0 = 6, H1 = 23;

export function viewAgenda() {
  const v = S.ui.agView, f = S.ui.agFilter, cur = S.agCursor;
  const c = parseISO(cur);
  let title = '';
  if (v === 'mes') title = `${cap(MON[c.getMonth()])}${c.getFullYear() !== new Date().getFullYear() ? ' ' + c.getFullYear() : ''}`;
  else if (v === 'semana') { const s0 = parseISO(sundayOf(cur)), s6 = parseISO(addDays(sundayOf(cur), 6)); title = `${s0.getDate()}${s0.getMonth() !== s6.getMonth() ? ' ' + MON[s0.getMonth()].slice(0, 3) : ''} – ${s6.getDate()} ${MON[s6.getMonth()].slice(0, 3)}`; }
  else title = 'Programação';

  const header = `<div class="ag-head">
    <div><div class="path">C:\\AGENDA\\${c.getFullYear()}\\</div><div class="ag-title">${esc(title)}</div></div>
    <div class="row" style="gap:2px">
      ${v !== 'lista' ? `<button class="icon-btn" type="button" data-act="ag-prev" aria-label="Anterior">${icon.back}</button>
      <button class="icon-btn" type="button" data-act="ag-next" aria-label="Próximo" style="transform:scaleX(-1)">${icon.back}</button>` : ''}
      <button class="btn ghost sm" type="button" data-act="ag-today" style="border-color:var(--yellow);color:var(--yellow)">Hoje</button>
    </div></div>
    <div class="seg" role="group" aria-label="Visão da agenda" style="--c:var(--blue)">${[['mes', 'Mês'], ['semana', 'Semana'], ['lista', 'Programação']].map(([id, l]) => `<button type="button" aria-pressed="${v === id}" data-act="ag-view" data-v="${id}">${l}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Filtrar">${FILTERS.map(([id, l, col, dot]) => `<button type="button" class="fchip sm" style="--c:${col}" aria-pressed="${f === id}" data-act="ag-filter" data-v="${id}"><span class="dot" style="background:${dot || col}"></span>${l}</button>`).join('')}</div>`;

  if (v === 'semana') return header + weekView(cur, f);
  if (v === 'lista') return header + listView(f);
  return header + monthView(cur, f);
}

function monthView(cur, f) {
  const c = parseISO(cur);
  const first = iso(new Date(c.getFullYear(), c.getMonth(), 1));
  const dim = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
  const start = sundayOf(first);
  const weeks = Math.ceil((parseISO(first).getDay() + dim) / 7);
  const end = addDays(start, weeks * 7 - 1);
  const occ = occurrences(start, end).filter((o) => matchesFilter(o, f));
  const today = todayISO();
  let rows = '';
  for (let w = 0; w < weeks; w++) {
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      const dd = parseISO(d);
      const items = occ.filter((o) => o.date === d);
      const out = dd.getMonth() !== c.getMonth();
      cells += `<button type="button" class="mcell ${out ? 'out' : ''}" data-act="ag-day" data-date="${d}" aria-label="${esc(longDate(d))}, ${items.length} ${items.length === 1 ? 'item' : 'itens'}">
        <span class="mnum ${d === today ? 'today' : ''}">${dd.getDate()}</span>
        ${items.slice(0, 3).map((o) => `<span class="mchip" style="background:${o.color}">${esc(o.title)}</span>`).join('')}
        ${items.length > 3 ? `<span class="mmore">+${items.length - 3}</span>` : ''}
      </button>`;
    }
    rows += `<div class="mrow">${cells}</div>`;
  }
  return `<div class="month"><div class="mhead">${WD3.map((x) => `<span>${x}</span>`).join('')}</div>${rows}</div>`;
}

function weekView(cur, f) {
  const s0 = sundayOf(cur);
  const days = [...Array(7)].map((_, i) => addDays(s0, i));
  const occ = occurrences(days[0], days[6]).filter((o) => matchesFilter(o, f));
  const today = todayISO();
  const allDay = days.map((d) => occ.filter((o) => o.date === d && !o.start));
  const hasAllDay = allDay.some((x) => x.length);
  const cols = days.map((d) => {
    const items = occ.filter((o) => o.date === d && o.start);
    // distribui lado a lado só os eventos que se sobrepõem entre si
    const placed = [];
    let cluster = [], lanes = [], clusterEnd = -1;
    const flush = () => { cluster.forEach((x) => { x.n = Math.max(1, lanes.length); }); cluster = []; lanes = []; };
    items.forEach((o) => {
      const s = toMin(o.start), e = Math.max(toMin(o.end || '') ?? s + 60, s + 30);
      if (s >= clusterEnd) { flush(); clusterEnd = -1; }
      let lane = lanes.findIndex((endAt) => endAt <= s);
      if (lane < 0) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
      const x = { o, s, e, lane, n: 1 };
      cluster.push(x); placed.push(x);
      clusterEnd = Math.max(clusterEnd, e);
    });
    flush();
    return `<div class="wkcol ${d === today ? 'is-today' : ''}">${placed.map(({ o, s, e, lane, n }) => {
      const top = Math.max(0, (s - H0 * 60) / 60 * HOUR), h = Math.max(20, (e - s) / 60 * HOUR - 2);
      return `<button type="button" class="wkev" style="top:${top}px;height:${h}px;left:calc(${lane / n * 100}% + 1px);width:calc(${100 / n}% - 2px);background:${o.color}" data-act="open-occ" data-kind="${o.kind}" data-id="${esc(o.id)}" data-date="${o.date}">${esc(o.title)}</button>`;
    }).join('')}</div>`;
  }).join('');
  const hours = [];
  for (let h = H0; h <= H1; h++) hours.push(`<span style="top:${(h - H0) * HOUR}px">${h}h</span>`);
  return `<div class="wk">
    <div class="wk-head"><span></span>${days.map((d) => `<button type="button" class="wk-day" data-act="ag-day" data-date="${d}"><span>${WD3[parseISO(d).getDay()]}</span><b class="${d === today ? 'today' : ''}">${parseISO(d).getDate()}</b></button>`).join('')}</div>
    ${hasAllDay ? `<div class="wk-allday"><span>dia</span>${allDay.map((list) => `<div>${list.map((o) => `<button type="button" class="wk-chip" style="background:${o.color}" data-act="open-occ" data-kind="${o.kind}" data-id="${esc(o.id)}" data-date="${o.date}">${esc(o.title)}</button>`).join('')}</div>`).join('')}</div>` : ''}
    <div class="wk-scroll" id="wk-scroll"><div class="wk-grid" style="height:${(H1 - H0 + 1) * HOUR}px;--hour:${HOUR}px"><div class="wk-hours">${hours.join('')}</div>${cols}</div></div>
  </div>`;
}

function listView(f) {
  const today = todayISO();
  const to = addDays(today, S.agListDays);
  const occ = occurrences(today, to).filter((o) => matchesFilter(o, f));
  const dates = [...new Set(occ.map((o) => o.date))];
  let lastMonth = -1;
  const groups = dates.map((d) => {
    const x = parseISO(d);
    const monthHead = x.getMonth() !== lastMonth ? `<div class="lmonth">${cap(MON[x.getMonth()])} ${x.getFullYear()}</div>` : '';
    lastMonth = x.getMonth();
    return `${monthHead}<div class="lday"><button type="button" class="ldate ${d === today ? 'today' : ''}" data-act="ag-day" data-date="${d}"><span>${WD3[x.getDay()]}</span><b>${x.getDate()}</b></button>
      <div class="levs">${occ.filter((o) => o.date === d).map((o) => `<button type="button" class="lev" style="background:${o.color}" data-act="open-occ" data-kind="${o.kind}" data-id="${esc(o.id)}" data-date="${o.date}"><b>${esc(o.title)}</b><span>${esc(rangeLabel(o))}${o.kind === 'study' ? ' · ' + esc(o.sub) : ''}${o.place ? ' · ' + esc(o.place) : ''}</span></button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="list" style="gap:4px">${groups || '<div class="empty">Nada marcado nos próximos dias.</div>'}
    <button class="dashed" type="button" data-act="ag-more" style="margin-top:12px">Mostrar mais dias</button></div>`;
}

// Depois de desenhar a semana, rola para perto das 7h.
export function afterAgendaRender(view) {
  const sc = view.querySelector('#wk-scroll');
  if (sc && !sc.dataset.done) { sc.scrollTop = (7 - H0) * HOUR; sc.dataset.done = '1'; }
}

// ---------------- Folhas ----------------
export function daySheet(d) {
  const items = occurrences(d, d);
  const el = openSheet(`<div class="sheet" role="dialog" aria-label="${esc(longDate(d))}"><div class="grip"></div>
    <div class="row" style="justify-content:space-between"><h2 class="h2" style="font-weight:800">${esc(longDate(d))}</h2>
    <button class="btn sm" type="button" style="--c:var(--blue)" data-new>+ Evento</button></div>
    ${items.length ? items.map((o) => `<button type="button" class="dayitem" data-kind="${o.kind}" data-id="${esc(o.id)}">
      <span class="row" style="justify-content:space-between;gap:8px"><span class="due" style="color:var(--peach)">${esc(rangeLabel(o))}</span><span class="tag" style="--c:${o.color}">${esc(CAT_LABEL[o.cat])}</span></span>
      <b>${esc(o.title)}</b>${o.kind === 'study' ? `<span class="sub" style="margin:0">${esc(o.sub)}</span>` : ''}${o.place ? `<span class="sub" style="margin:0">${esc(o.place)}</span>` : ''}</button>`).join('')
    : '<div class="empty">Nada marcado neste dia.</div>'}
  </div>`);
  el.querySelector('[data-new]').addEventListener('click', () => { closeSheet(); eventForm(null, d); });
  el.querySelectorAll('.dayitem').forEach((b) => b.addEventListener('click', () => { closeSheet(); openOcc(b.dataset.kind, b.dataset.id, d); }));
}

export function openOcc(kind, id, date) {
  if (kind === 'task') return go('#/tarefa/' + id);
  if (kind === 'study') return go('#/projeto/' + id);
  const e = S.events.find((x) => x.id === id);
  if (e) eventSheet(e, date);
}

function eventSheet(e, date) {
  const mapUrl = e.place ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.place) : '';
  const el = openSheet(`<div class="sheet" role="dialog" aria-label="Evento"><div class="grip"></div>
    <div class="row" style="justify-content:space-between;gap:8px"><span class="tag" style="--c:${COLORS[e.cat]}">${esc(CAT_LABEL[e.cat])}</span>
      <div class="row" style="gap:2px"><button class="icon-btn" type="button" data-edit aria-label="Editar evento">${icon.edit}</button><button class="icon-btn" type="button" data-del aria-label="Excluir evento">${icon.trash}</button></div></div>
    <h2 class="h1" style="font-size:26px;margin:0;overflow-wrap:anywhere">${esc(e.title)}</h2>
    <div class="kv-lines">
      <div><b>${esc(longDate(date || e.date))}</b></div>
      <div class="due" style="color:var(--peach)">${esc(rangeLabel({ start: e.start, end: e.end, kind: 'event' }))}</div>
      ${e.repeat === 'weekly' ? `<div class="sub" style="margin:0">Repete toda ${esc(WDL[parseISO(e.date).getDay()].toLowerCase())}${e.until ? ' até ' + parseISO(e.until).toLocaleDateString('pt-BR') : ''}</div>` : ''}
      ${e.place ? `<a href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" class="row" style="font-weight:800;gap:6px;min-height:40px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${esc(e.place)}</a>` : ''}
      ${e.desc ? `<p class="desc">${esc(e.desc)}</p>` : ''}
    </div>
  </div>`);
  el.querySelector('[data-edit]').addEventListener('click', () => { closeSheet(); eventForm(e); });
  el.querySelector('[data-del]').addEventListener('click', async () => {
    closeSheet();
    if (e.repeat === 'weekly') {
      const d2 = date || e.date;
      const s2 = openSheet(`<div class="sheet" role="dialog" aria-label="Excluir evento"><div class="grip"></div>
        <p style="margin:0;font-weight:800;font-size:16px">Excluir "${esc(e.title)}"</p>
        <button class="btn ghost block" type="button" data-one>Só no dia ${esc(parseISO(d2).toLocaleDateString('pt-BR'))}</button>
        <button class="btn block" type="button" data-all>Todas as repetições</button></div>`);
      s2.querySelector('[data-one]').addEventListener('click', async () => { closeSheet(); e.exdates = [...(e.exdates || []), d2]; await saveItem('events', e); rerender(); toast('Excluído só neste dia'); });
      s2.querySelector('[data-all]').addEventListener('click', async () => { closeSheet(); await removeItem('events', e.id); rerender(); toast('Evento excluído'); });
      return;
    }
    if (await confirmBox(`Excluir o evento "${e.title}"?`, { ok: 'Excluir' })) { await removeItem('events', e.id); rerender(); toast('Evento excluído'); }
  });
}

export function eventForm(e, date) {
  const editing = !!e;
  const d = e || { title: '', cat: 'trabalho', date: date || S.agCursor || todayISO(), start: '', end: '', place: '', desc: '', repeat: 'none', until: '' };
  const dr = editing ? '' : 'ev:new:';
  const el = openSheet(`<form class="sheet" role="dialog" aria-label="${editing ? 'Editar evento' : 'Novo evento'}" novalidate><div class="grip"></div>
    <h2 class="h2" style="font-size:24px;font-weight:800">${editing ? 'Editar evento' : 'Novo evento'}</h2>
    <label class="field">Título<input class="input" name="title" maxlength="200" value="${esc(d.title)}" placeholder="Ex.: Conselho de classe" autocomplete="off" ${editing ? '' : `data-draft="${dr}title" autofocus`}></label>
    <div class="field">Categoria<div class="seg" role="group" aria-label="Categoria">${['trabalho', 'pessoal'].map((k) => `<button type="button" style="--c:${COLORS[k]}" aria-pressed="${d.cat === k}" data-cat="${k}">${CAT_LABEL[k]}</button>`).join('')}</div></div>
    <label class="field">Data<input class="input" type="date" name="date" value="${esc(d.date)}" required></label>
    <div class="grid2"><label class="field">Início<input class="input" type="time" name="start" value="${esc(d.start)}"></label><label class="field">Fim<input class="input" type="time" name="end" value="${esc(d.end)}"></label></div>
    <p class="sub" style="margin:-4px 0 0;font-size:12px">Sem horário = evento de dia inteiro.</p>
    <label class="check" style="min-height:40px"><input type="checkbox" name="weekly" ${d.repeat === 'weekly' ? 'checked' : ''} style="width:20px;height:20px;accent-color:#8FD8E8"><span class="check-text">Repetir toda semana (ex.: aulas)</span></label>
    <label class="field" data-until ${d.repeat === 'weekly' ? '' : 'hidden'}>Repetir até (opcional)<input class="input" type="date" name="until" value="${esc(d.until || '')}"></label>
    <label class="field">Endereço (opcional)<input class="input" name="place" value="${esc(d.place)}" placeholder="Rua, número, bairro ou sala" autocomplete="off" ${editing ? '' : `data-draft="${dr}place"`}></label>
    <label class="field">Descrição (opcional)<textarea class="textarea" name="desc" rows="3" placeholder="Pauta, o que levar…" ${editing ? '' : `data-draft="${dr}desc"`}>${esc(d.desc)}</textarea></label>
    <p class="sub" id="ev-err" style="margin:0;color:var(--pink);font-weight:800" hidden></p>
    <button class="btn block" type="submit" style="--c:var(--blue);--s:var(--pink)">${editing ? 'Salvar alterações' : 'Salvar evento'}</button>
  </form>`);
  let cat = d.cat;
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; el.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  const weekly = el.querySelector('[name=weekly]');
  weekly.addEventListener('change', () => { el.querySelector('[data-until]').hidden = !weekly.checked; });
  el.querySelector('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const err = el.querySelector('#ev-err');
    const title = String(f.get('title') || '').trim();
    const dt = String(f.get('date') || '');
    const start = String(f.get('start') || ''), end = String(f.get('end') || '');
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    if (!title) return fail('Dê um título ao evento.');
    if (!dt) return fail('Escolha a data.');
    if (end && !start) return fail('Preencha o horário de início.');
    if (start && end && toMin(end) <= toMin(start)) return fail('O fim precisa ser depois do início.');
    const data = { title, cat, date: dt, start, end, place: String(f.get('place') || '').trim(), desc: String(f.get('desc') || '').trim(), repeat: f.get('weekly') ? 'weekly' : 'none', until: f.get('weekly') ? String(f.get('until') || '') : '' };
    if (editing) { if (e.date !== dt || e.repeat !== data.repeat) e.exdates = []; Object.assign(e, data); await saveItem('events', e); }
    else { await saveItem('events', { id: uid(), exdates: [], ...data }); ['title', 'place', 'desc'].forEach((k) => clearDraft(dr + k)); }
    S.agCursor = dt;
    closeSheet();
    rerender();
    toast(editing ? 'Evento atualizado' : 'Evento salvo');
  });
}

// ---------------- Ações ----------------
export const agendaActions = {
  'ag-view': (el) => { S.ui.agView = el.dataset.v; savePrefs(); rerender(); },
  'ag-filter': (el) => { S.ui.agFilter = el.dataset.v; savePrefs(); rerender(); },
  'ag-today': () => { S.agCursor = todayISO(); rerender(); },
  'ag-prev': () => { shift(-1); },
  'ag-next': () => { shift(1); },
  'ag-more': () => { S.agListDays += 60; rerender(); },
  'ag-day': (el) => daySheet(el.dataset.date),
  'open-occ': (el) => openOcc(el.dataset.kind, el.dataset.id, el.dataset.date)
};
function shift(n) {
  if (S.ui.agView === 'semana') S.agCursor = addDays(S.agCursor, 7 * n);
  else { const c = parseISO(S.agCursor); S.agCursor = iso(new Date(c.getFullYear(), c.getMonth() + n, 1)); }
  rerender();
}

// Cada função devolve o HTML de uma tela.
import { esc, icon, winBar, dueLabel, isLate, longToday, stamp, shortDate, daysFromToday, todayISO } from './ui.js';

export const CAT = {
  trabalho: { label: 'Trabalho', color: 'var(--blue)' },
  pessoal: { label: 'Pessoal', color: 'var(--pink)' }
};
export const STATUS = {
  afazer: { label: 'A fazer', color: 'var(--peach)' },
  andamento: { label: 'Em andamento', color: 'var(--blue)' },
  final: { label: 'Finalizada', color: 'var(--lilac)' }
};
export const NOTE_TYPES = {
  prioridade: { label: 'Prioridade', short: 'PRIORIDADE', c: 'var(--orange)', bg: 'var(--orange)', fg: 'var(--ink)', b: 'var(--orange)', hand: false },
  lembrete: { label: 'Para não esquecer', short: 'NÃO ESQUECER', c: 'var(--yellow)', bg: 'var(--yellow)', fg: 'var(--ink)', b: 'var(--yellow)', hand: true },
  anotacao: { label: 'Anotação', short: 'ANOTAÇÃO', c: 'var(--blue)', bg: 'var(--surface)', fg: 'var(--text)', b: 'var(--line)', hand: false }
};

const head = (path, title, sub = '', right = '') => `
  <div class="head"><div><div class="path">${esc(path)}</div><h1 class="h1">${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>${right}</div>`;

const dueHtml = (t) => t.due ? `<span class="due ${isLate(t.due) ? 'late' : ''}">${esc(dueLabel(t.due))}</span>` : '<span class="due" style="color:var(--faint)">sem prazo</span>';
const subCount = (t) => `${t.subs.filter((s) => s.done).length}/${t.subs.length}`;

export function taskCard(t) {
  const st = STATUS[t.status];
  return `<button class="card" type="button" data-act="open-task" data-id="${t.id}">
    <span class="card-top"><span class="row" style="gap:6px"><span class="tag" style="--c:${st.color}">${st.label}</span>${t.top ? `<span style="color:var(--yellow);display:flex" title="Prioridade do dia">${icon.star}</span>` : ''}</span>${t.status === 'final' ? '' : dueHtml(t)}</span>
    <span class="card-title">${esc(t.title)}</span>
    <span class="meta">${t.subs.length ? `<span>Checklist ${subCount(t)}</span>` : ''}${t.links.length ? `<span>${t.links.length} link${t.links.length > 1 ? 's' : ''}</span>` : ''}${t.imageIds.length ? `<span>${t.imageIds.length} imagem${t.imageIds.length > 1 ? 'ns' : ''}</span>` : ''}${t.comments.length ? `<span>${t.comments.length} comentário${t.comments.length > 1 ? 's' : ''}</span>` : ''}</span>
  </button>`;
}

const sortOpen = (a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || b.updatedAt - a.updatedAt;

// ---------------- HOJE ----------------
export function viewHoje(S) {
  const { weekday, text } = longToday();
  const open = S.tasks.filter((t) => t.status !== 'final');
  const tops = open.filter((t) => t.top).sort(sortOpen);
  const limit = 7;
  const prazos = open.filter((t) => t.due && daysFromToday(t.due) <= limit).sort(sortOpen);
  const andamento = open.filter((t) => t.status === 'andamento').length;
  const weekAgo = Date.now() - 7 * 86400000;
  const doneWeek = S.tasks.filter((t) => t.status === 'final' && t.finishedAt >= weekAgo).length;
  const pinned = S.notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const lateCount = prazos.filter((t) => isLate(t.due)).length;
  const sticker = lateCount ? `${lateCount} atrasada${lateCount > 1 ? 's' : ''}` : `${prazos.filter((t) => t.due === todayISO()).length} para hoje`;

  return `
  ${head(`C:\\HOJE\\${weekday}`, 'Meu dia', text, `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px"><a class="icon-btn" href="#/config" aria-label="Configurações e backup">${icon.gear}</a><span class="sticker">${esc(sticker)}</span></div>`)}

  <section class="win">${winBar('PRIORIDADES', 'var(--pink)')}
    <div class="win-body tight">
      ${tops.length ? tops.map((t) => `<div class="item-row">
          <button class="check" type="button" data-act="finish-task" data-id="${t.id}" aria-label="Finalizar: ${esc(t.title)}" style="flex:0 0 auto;width:auto;padding-right:4px"><span class="box"></span></button>
          <button class="check" type="button" data-act="open-task" data-id="${t.id}"><span class="check-text">${esc(t.title)}</span>${t.due ? dueHtml(t) : ''}</button>
        </div>`).join('')
      : `<p class="sub" style="margin:8px 0">Nenhuma prioridade marcada. Abra uma tarefa e toque em <b style="color:var(--yellow)">★ Prioridade do dia</b>.</p>`}
    </div>
  </section>

  <section class="win">${winBar('PRAZOS_7_DIAS', 'var(--orange)')}
    <div class="win-body">
      ${prazos.length ? prazos.map(taskCard).join('') : '<p class="sub" style="margin:0">Nada vencendo nos próximos 7 dias.</p>'}
    </div>
  </section>

  <div class="stat-grid">
    <a class="stat" href="#/tarefas" style="--c:var(--blue)"><b>${andamento}</b><span>em andamento</span></a>
    <a class="stat" href="#/tarefas" style="--c:var(--peach)"><b>${open.length - andamento}</b><span>a fazer</span></a>
    <a class="stat" href="#/tarefas?tab=historico" style="--c:var(--lilac)"><b>${doneWeek}</b><span>finalizadas na semana</span></a>
  </div>

  ${pinned.length ? `<section class="list"><h2 class="h2">Fixadas</h2>${pinned.map((n) => `<button class="postit ${NOTE_TYPES[n.type].hand ? 'hand' : ''}" type="button" data-act="open-note" data-id="${n.id}" style="border:0;text-align:left;${n.type !== 'lembrete' ? `background:${NOTE_TYPES[n.type].bg};color:${NOTE_TYPES[n.type].fg};${n.type === 'anotacao' ? 'border:1.5px solid var(--line);' : ''}` : ''}"><div class="note-head" style="font-family:var(--mono)">${NOTE_TYPES[n.type].short}</div><div class="note-text">${esc(n.text)}</div></button>`).join('')}</section>` : ''}
  `;
}

// ---------------- TAREFAS (lista) ----------------
export function viewTarefas(S) {
  const tab = S.ui.tab;
  const tabs = [['pessoal', 'Pessoal', 'var(--pink)'], ['trabalho', 'Trabalho', 'var(--blue)'], ['historico', 'Histórico', 'var(--lilac)']];
  const seg = `<div class="seg" role="group" aria-label="Filtro de tarefas">${tabs.map(([id, l, c]) => `<button type="button" style="--c:${c}" aria-pressed="${tab === id}" data-act="tab" data-v="${id}">${l}</button>`).join('')}</div>`;

  if (tab === 'historico') {
    const q = (S.ui.histQ || '').trim().toLowerCase();
    const list = S.tasks.filter((t) => t.status === 'final')
      .filter((t) => !q || [t.title, t.desc, t.closing?.onde, t.closing?.para, t.closing?.obs].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.finishedAt - a.finishedAt);
    return `${head('C:\\TAREFAS\\HISTORICO\\', 'Histórico')}${seg}
      <label class="field"><span class="sr-only">Buscar no histórico</span><input class="input" type="search" id="hist-q" placeholder="Buscar por título, pasta, pessoa…" value="${esc(S.ui.histQ || '')}"></label>
      <div class="list">${list.length ? list.map((t) => `
        <article class="win">
          <div class="win-bar" style="--c:var(--muted);font-size:16px"><span>${CAT[t.cat].label.toUpperCase()}</span><span>finalizada ${esc(shortDate(t.finishedAt))}</span></div>
          <div class="win-body">
            <button type="button" data-act="open-task" data-id="${t.id}" style="background:none;border:0;padding:0;text-align:left;color:var(--text)" class="card-title"><span style="text-decoration:line-through;text-decoration-color:var(--pink)">${esc(t.title)}</span></button>
            <dl class="kv" style="margin:0"><dt>Onde salvei</dt><dd>${esc(t.closing?.onde || '—')}</dd><dt>Enviei para</dt><dd>${esc(t.closing?.para || '—')}</dd><dt>Observações</dt><dd>${esc(t.closing?.obs || '—')}</dd></dl>
          </div>
        </article>`).join('') : `<div class="empty">${q ? 'Nada encontrado com essa busca.' : 'Quando você finalizar tarefas, elas aparecem aqui com as notas de encerramento.'}</div>`}</div>`;
  }

  const open = S.tasks.filter((t) => t.cat === tab && t.status !== 'final').sort(sortOpen);
  const andamento = open.filter((t) => t.status === 'andamento');
  const afazer = open.filter((t) => t.status === 'afazer');
  return `${head('C:\\TAREFAS\\', 'Afazeres', '', `<button class="btn sm" type="button" style="--c:var(--orange)" data-act="new-task">+ Tarefa</button>`)}${seg}
    ${open.length ? '' : `<div class="empty">Nenhuma tarefa ${tab === 'pessoal' ? 'pessoal' : 'de trabalho'} aberta.<br>Toque em <b>+ Tarefa</b> para criar.</div>`}
    ${andamento.length ? `<div class="group-title">em andamento (${andamento.length})</div><div class="list">${andamento.map(taskCard).join('')}</div>` : ''}
    ${afazer.length ? `<div class="group-title">a fazer (${afazer.length})</div><div class="list">${afazer.map(taskCard).join('')}</div>` : ''}`;
}

// ---------------- TAREFA (detalhe) ----------------
export function viewTarefa(S, t) {
  if (!t) return `<button class="back" type="button" data-act="go" data-v="#/tarefas">${icon.back}Tarefas</button><div class="empty">Esta tarefa não existe mais.</div>`;
  const cat = CAT[t.cat];
  const final = t.status === 'final';
  return `
  <div class="row" style="justify-content:space-between">
    <button class="back" type="button" data-act="back">${icon.back}${final ? 'Histórico' : 'Tarefas'}</button>
    <div class="row" style="gap:2px">
      <button class="icon-btn" type="button" data-act="edit-task" aria-label="Editar tarefa">${icon.edit}</button>
      <button class="icon-btn" type="button" data-act="delete-task" aria-label="Excluir tarefa">${icon.trash}</button>
    </div>
  </div>
  <div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag" style="--c:${cat.color}">${cat.label}</span>${final ? '' : (t.due ? `<span class="due ${isLate(t.due) ? 'late' : ''}">prazo: ${esc(dueLabel(t.due))}</span>` : '<span class="due" style="color:var(--faint)">sem prazo</span>')}</div>
  <h1 class="h1" style="font-size:28px;line-height:1.15;margin:0;overflow-wrap:anywhere">${esc(t.title)}</h1>

  ${final ? `
  <section class="win" style="border-color:var(--lilac)">${winBar('ENCERRAMENTO', 'var(--lilac)', `<span style="color:var(--muted);font-size:16px">${esc(stamp(t.finishedAt))}</span>`)}
    <div class="win-body"><dl class="kv" style="margin:0"><dt>Onde salvei</dt><dd>${esc(t.closing?.onde || '—')}</dd><dt>Enviei para</dt><dd>${esc(t.closing?.para || '—')}</dd><dt>Observações</dt><dd>${esc(t.closing?.obs || '—')}</dd></dl>
    <div class="grid2"><button class="btn ghost sm" type="button" data-act="edit-closing">Editar notas</button><button class="btn sm" type="button" style="--c:var(--blue)" data-act="reopen">Reabrir tarefa</button></div></div>
  </section>` : `
  <div class="seg" role="group" aria-label="Status">${['afazer', 'andamento', 'final'].map((k) => `<button type="button" style="--c:${STATUS[k].color}" aria-pressed="${t.status === k}" data-act="status" data-v="${k}">${STATUS[k].label}</button>`).join('')}</div>
  <button class="btn ${t.top ? '' : 'ghost'} sm" type="button" style="--c:var(--yellow);align-self:flex-start" aria-pressed="${!!t.top}" data-act="toggle-top">${icon.star}${t.top ? 'Prioridade do dia' : 'Marcar como prioridade do dia'}</button>`}

  <section class="win">${winBar('DESCRICAO', 'var(--blue)')}
    <div class="win-body"><label class="field"><span class="sr-only">Descrição</span><textarea class="textarea" id="task-desc" rows="4" placeholder="Detalhes da tarefa…">${esc(t.desc)}</textarea></label></div>
  </section>

  <section class="win">${winBar('CHECKLIST', 'var(--pink)', `<span>${subCount(t)}</span>`)}
    <div class="win-body tight">
      ${t.subs.map((s) => `<div class="item-row ${s.done ? 'done' : ''}">
        <button class="check" type="button" data-act="toggle-sub" data-id="${s.id}" aria-pressed="${s.done}"><span class="box">${s.done ? icon.check : ''}</span><span class="check-text">${esc(s.text)}</span></button>
        <button class="icon-btn" type="button" data-act="del-sub" data-id="${s.id}" aria-label="Remover item">${icon.trash}</button></div>`).join('')}
      <form class="row" data-form="add-sub" style="padding:8px 0 6px"><label style="flex:1"><span class="sr-only">Novo item do checklist</span><input class="input" name="text" placeholder="Novo item…" autocomplete="off"></label><button class="btn sm" type="submit" style="--c:var(--pink)" aria-label="Adicionar item">${icon.plus}</button></form>
    </div>
  </section>

  <section class="win">${winBar('LINKS', 'var(--yellow)')}
    <div class="win-body tight">
      ${t.links.map((l) => `<div class="link-row"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon.link}<span>${esc(l.label || l.url)}</span></a><button class="icon-btn" type="button" data-act="del-link" data-id="${l.id}" aria-label="Remover link">${icon.trash}</button></div>`).join('')}
      <div style="padding:8px 0 6px"><button class="dashed" type="button" data-act="add-link">+ Adicionar link</button></div>
    </div>
  </section>

  <section class="win">${winBar('IMAGENS', 'var(--lilac)')}
    <div class="win-body"><div class="thumbs">
      ${t.imageIds.map((id) => `<button class="thumb" type="button" data-act="view-img" data-id="${id}" aria-label="Ver imagem"><img data-img="${id}" alt=""></button>`).join('')}
      <label class="thumb-add">${icon.image}Adicionar<input type="file" id="img-input" accept="image/*" multiple class="sr-only"></label>
    </div></div>
  </section>

  <section class="win">${winBar('COMENTARIOS', 'var(--peach)')}
    <div class="win-body">
      ${t.comments.map((c) => `<div class="comment"><div class="row" style="justify-content:space-between;align-items:flex-start"><span class="comment-text">${esc(c.text)}</span><button class="icon-btn" type="button" data-act="del-comment" data-id="${c.id}" aria-label="Remover comentário">${icon.trash}</button></div><span class="comment-date">${esc(stamp(c.at))}</span></div>`).join('')}
      <form class="row" data-form="add-comment"><label style="flex:1"><span class="sr-only">Novo comentário</span><input class="input" name="text" placeholder="Escreva um comentário…" autocomplete="off"></label><button class="btn sm" type="submit" style="--c:var(--peach)" aria-label="Adicionar comentário">${icon.plus}</button></form>
    </div>
  </section>
  <p class="sub" style="text-align:center;font-size:12px">Criada em ${esc(stamp(t.createdAt))}</p>`;
}

// ---------------- NOTAS ----------------
export function viewNotas(S) {
  const f = S.ui.noteFilter;
  const filters = [['todas', 'Todas', 'var(--text)'], ['fixadas', 'Fixadas', 'var(--pink)'], ['prioridade', 'Prioridades', 'var(--orange)'], ['lembrete', 'Não esquecer', 'var(--yellow)'], ['anotacao', 'Anotações', 'var(--blue)']];
  const list = S.notes.filter((n) => f === 'todas' || (f === 'fixadas' ? n.pinned : n.type === f))
    .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  return `${head('C:\\NOTAS\\', 'Anotações')}
  <section class="win">${winBar('NOVA_NOTA', 'var(--yellow)')}
    <form class="win-body" data-form="add-note">
      <div class="composer-types" role="group" aria-label="Tipo da nota">${Object.entries(NOTE_TYPES).map(([k, v]) => `<button type="button" class="fchip" style="--c:${v.c}" aria-pressed="${S.ui.noteType === k}" data-act="note-type" data-v="${k}">${v.label}</button>`).join('')}</div>
      <div class="row"><label style="flex:1"><span class="sr-only">Texto da nota</span><input class="input" name="text" placeholder="O que você não quer esquecer?" autocomplete="off"></label><button class="btn" type="submit" style="--c:var(--yellow);min-width:48px;padding:0 12px" aria-label="Adicionar nota">${icon.plus}</button></div>
    </form>
  </section>
  <div class="chips" role="group" aria-label="Filtrar notas">${filters.map(([id, l, c]) => `<button type="button" class="fchip" style="--c:${c}" aria-pressed="${f === id}" data-act="note-filter" data-v="${id}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="notes-grid">${list.map((n, i) => {
    const ty = NOTE_TYPES[n.type];
    const rot = ['-1.2deg', '.8deg', '0deg', '1.2deg', '-.6deg', '.5deg'][i % 6];
    return `<button type="button" class="note ${ty.hand ? 'hand' : ''}" data-act="open-note" data-id="${n.id}" style="--nb:${ty.b};--nbg:${ty.bg};--nfg:${ty.fg};transform:rotate(${rot})"><span class="note-head"><span>${ty.short}</span>${n.pinned ? icon.pin(true) : ''}</span><span class="note-text">${esc(n.text)}</span></button>`;
  }).join('')}</div>` : `<div class="empty">${f === 'todas' ? 'Nenhuma nota ainda. Escreva acima e toque em +.' : 'Nenhuma nota neste filtro.'}</div>`}
  <p class="sub" style="text-align:center;font-size:12px">Toque numa nota para editar, fixar na aba Hoje ou transformar em tarefa.</p>`;
}

// ---------------- EM BREVE ----------------
export function viewSoon(name, path, phase, color, text) {
  return `${head(path, name)}
  <section class="win">${winBar('EM_CONSTRUCAO', color)}
    <div class="soon"><span class="sticker" style="background:${color}">${esc(phase)}</span><p>${text}</p></div>
  </section>`;
}

// ---------------- CONFIGURAÇÕES ----------------
export function viewConfig(S, info) {
  const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  return `<button class="back" type="button" data-act="go" data-v="#/hoje">${icon.back}Hoje</button>
  ${head('C:\\CONFIG\\', 'Ajustes')}
  <section class="win">${winBar('BACKUP', 'var(--yellow)')}
    <div class="win-body">
      <p class="sub" style="margin:0;line-height:1.5">Seus dados ficam guardados só neste celular. Faça um backup de vez em quando e guarde o arquivo no Google Drive ou mande para o seu e-mail.</p>
      <p class="sub" style="margin:0">Último backup: <b style="color:var(--text)">${S.ui.lastBackup ? esc(stamp(S.ui.lastBackup)) : 'nunca'}</b></p>
      <button class="btn block" type="button" style="--c:var(--yellow)" data-act="export">Baixar backup agora</button>
      <label class="btn ghost block" style="cursor:pointer">Restaurar de um backup<input type="file" id="import-input" accept="application/json,.json" class="sr-only"></label>
    </div>
  </section>
  <section class="win">${winBar('ARMAZENAMENTO', 'var(--blue)')}
    <div class="win-body"><dl class="kv" style="margin:0">
      <dt>Proteção</dt><dd>${info.persisted ? '<span style="color:var(--blue)">ativa: o Android não apaga os dados sozinho</span>' : 'pendente: instale o app na tela inicial'}</dd>
      <dt>Em uso</dt><dd>${mb(info.usage || 0)}</dd>
      <dt>Tarefas</dt><dd>${S.tasks.length} (${S.tasks.filter((t) => t.status === 'final').length} finalizadas)</dd>
      <dt>Notas</dt><dd>${S.notes.length}</dd>
    </dl></div>
  </section>
  <p class="sub" style="text-align:center;font-size:12px">Planner · versão 1.0 (Fase 1)</p>`;
}

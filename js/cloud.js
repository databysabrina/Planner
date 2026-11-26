// Telas de "Conta e nuvem" e "Notificações", dentro de Ajustes.
import { esc, winBar, toast, confirmBox } from './ui.js';
import { rerender } from './core.js';
import { getStatus, isConfigured, isLoggedIn, signIn, signUp, signOut, syncNow, pushState, enablePush, disablePush, testPush, testLocalNotification } from './sync.js';

let testMsg = { text: '', ok: true };
import { getNotifPrefs, setNotifPrefs, OFFSET_CHOICES, VIBE_CHOICES } from './notif.js';

const hm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function statusLine(st) {
  if (st.state === 'syncing') return '<span style="color:var(--blue)">Sincronizando…</span>';
  if (st.state === 'error') return `<span style="color:var(--pink)">Erro: ${esc(st.error)}</span>`;
  if (st.state === 'offline') return `<span style="color:var(--orange)">Sem internet. ${st.pending} alteração(ões) esperando para enviar.</span>`;
  if (st.last) return `<span style="color:var(--blue)">Sincronizado às ${hm(st.last)}</span>${st.pending ? ` · ${st.pending} pendente(s)` : ''}`;
  return st.pending ? `${st.pending} alteração(ões) para enviar` : 'Aguardando primeira sincronização';
}

export async function viewCloud() {
  if (!isConfigured()) return '';
  const st = getStatus();
  if (!isLoggedIn()) {
    return `<section class="win">${winBar('CONTA_E_NUVEM', 'var(--blue)')}
      <form class="win-body" id="login-form" autocomplete="on">
        <p class="sub" style="margin:0;line-height:1.5">Entre para guardar tudo na nuvem, usar em outros aparelhos e receber notificações. Seus dados deste celular são enviados automaticamente.</p>
        ${!st.ready ? `<p class="sub" style="margin:0;color:var(--orange)">${st.error ? esc(st.error) : 'Carregando…'}</p>` : ''}
        <label class="field">E-mail<input class="input" type="email" name="email" autocomplete="username" required data-draft="login:email" inputmode="email"></label>
        <label class="field">Senha<input class="input" type="password" name="password" autocomplete="current-password" required minlength="6"></label>
        <p class="sub" id="login-err" style="margin:0;color:var(--pink);font-weight:800" hidden></p>
        <div class="grid2"><button class="btn ghost" type="submit" value="signup">Criar conta</button><button class="btn" type="submit" value="signin" style="--c:var(--blue);--s:var(--pink)">Entrar</button></div>
      </form>
    </section>`;
  }
  const ps = await pushState();
  const p = getNotifPrefs();
  const on = ps.permission === 'granted' && ps.subscribed;
  const chips = (k) => `<div class="chips wrap" role="group" aria-label="Avisar antes">${OFFSET_CHOICES.map(([v, l]) => `<button type="button" class="fchip sm" style="--c:var(--peach)" aria-pressed="${(p[k].offsets || []).includes(v)}" data-act="pref-offset" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const vibe = (k) => `<label class="field">Estilo<select class="input" data-pref="${k}.vibe">${VIBE_CHOICES.map(([v, l]) => `<option value="${v}" ${p[k].vibe === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="check" style="min-height:36px;font-size:14px"><input type="checkbox" data-pref="${k}.sticky" ${p[k].sticky ? 'checked' : ''} style="width:20px;height:20px;accent-color:#FFE45C"><span class="check-text">Ficar na tela até eu tocar</span></label>`;
  const toggle = (path, label, checked) => `<label class="switch-row"><span>${label}</span><input type="checkbox" role="switch" data-pref="${path}" ${checked ? 'checked' : ''}></label>`;

  return `<section class="win">${winBar('CONTA_E_NUVEM', 'var(--blue)')}
    <div class="win-body">
      <p style="margin:0;font-weight:800;overflow-wrap:anywhere">${esc(st.email)}</p>
      <p class="sub" style="margin:0" id="sync-line">${statusLine(st)}</p>
      <div class="grid2"><button class="btn ghost sm" type="button" data-act="sync-now">Sincronizar agora</button><button class="btn danger sm" type="button" data-act="sign-out">Sair da conta</button></div>
    </div>
  </section>

  <section class="win">${winBar('NOTIFICACOES', 'var(--pink)')}
    <div class="win-body">
      ${!ps.supported ? '<p class="sub" style="margin:0;color:var(--orange)">Este navegador não aceita notificações. Abra pelo ícone do app instalado (Chrome no Android).</p>' : `
      <p style="margin:0;font-weight:800">${on ? '<span style="color:var(--blue)">Ativadas neste celular</span>' : ps.permission === 'denied' ? '<span style="color:var(--pink)">Bloqueadas no Android</span>' : 'Desativadas neste celular'}</p>
      ${ps.permission === 'denied' ? '<p class="sub" style="margin:0;line-height:1.45">Para liberar: Configurações do Android → Apps → Planner (ou Chrome) → Notificações → Permitir.</p>' : ''}
      <div class="grid2">${on ? '<button class="btn sm" type="button" style="--c:var(--pink)" data-act="push-test">Enviar teste</button><button class="btn ghost sm" type="button" data-act="push-local">Testar só neste aparelho</button><button class="btn ghost sm" type="button" data-act="push-off" style="grid-column:1/-1">Desativar notificações</button>' : `<button class="btn sm" type="button" style="--c:var(--pink);grid-column:1/-1" data-act="push-on">${ps.permission === 'granted' ? 'Reativar notificações' : 'Ativar notificações'}</button>`}</div>
      ${testMsg.text ? `<p class="test-msg ${testMsg.ok ? 'ok' : 'bad'}" role="status">${esc(testMsg.text)}</p>` : ''}`}
    </div>
  </section>

  <section class="win">${winBar('LEMBRETES', 'var(--peach)')}
    <div class="win-body prefs">
      <div class="pref-block" style="--c:var(--blue)">${toggle('event.on', '<b>Eventos</b>', p.event.on)}
        ${p.event.on ? `<div class="field">Avisar antes (pode escolher vários)${chips('event')}</div>${vibe('event')}` : ''}</div>
      <div class="pref-block" style="--c:var(--lilac)">${toggle('study.on', '<b>Horários de estudo</b>', p.study.on)}
        ${p.study.on ? `<div class="field">Avisar antes${chips('study')}</div>${vibe('study')}` : ''}</div>
      <div class="pref-block" style="--c:var(--orange)">${toggle('task.on', '<b>Prazos de tarefas</b>', p.task.on)}
        ${p.task.on ? `<label class="field">Horário do aviso no dia do prazo<input class="input" type="time" data-pref="task.time" value="${esc(p.task.time)}"></label>
        <label class="check" style="min-height:36px;font-size:14px"><input type="checkbox" data-pref="task.eve" ${p.task.eve ? 'checked' : ''} style="width:20px;height:20px;accent-color:#FFE45C"><span class="check-text">Avisar também na véspera, às 20h</span></label>${vibe('task')}` : ''}</div>
      <div class="pref-block" style="--c:var(--yellow)">${toggle('digest.on', '<b>Resumo do dia</b>', p.digest.on)}
        ${p.digest.on ? `<label class="field">Horário do resumo<input class="input" type="time" data-pref="digest.time" value="${esc(p.digest.time)}"></label>` : ''}</div>
      <div class="pref-block" style="--c:var(--peach)">${toggle('quiet.on', '<b>Horário de silêncio</b>', p.quiet.on)}
        ${p.quiet.on ? `<div class="grid2"><label class="field">Das<input class="input" type="time" data-pref="quiet.start" value="${esc(p.quiet.start)}"></label><label class="field">Até<input class="input" type="time" data-pref="quiet.end" value="${esc(p.quiet.end)}"></label></div>
        <p class="sub" style="margin:0;font-size:12px">Nesse período nenhum lembrete é enviado (o resumo do dia continua).</p>` : ''}</div>
      <p class="sub" style="margin:0;font-size:12px;line-height:1.45">Os avisos chegam com até 5 minutos de diferença. O <b>som</b> é escolhido pelo Android: segure uma notificação do Planner → Configurações → Som.</p>
    </div>
  </section>`;
}

export function bindCloud(view) {
  const form = view.querySelector('#login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = e.submitter ? e.submitter.value : 'signin';
      const f = new FormData(form);
      const email = String(f.get('email') || '').trim(), password = String(f.get('password') || '');
      const err = form.querySelector('#login-err');
      err.hidden = true;
      if (!email || password.length < 6) { err.textContent = 'Preencha o e-mail e uma senha com pelo menos 6 caracteres.'; err.hidden = false; return; }
      form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        if (mode === 'signup') await signUp(email, password); else await signIn(email, password);
        toast('Conectado! Enviando seus dados para a nuvem…');
        rerender();
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
        form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      }
    });
  }
  view.querySelectorAll('[data-pref]').forEach((el) => el.addEventListener('change', () => {
    const p = getNotifPrefs();
    const [k, field] = el.dataset.pref.split('.');
    p[k][field] = el.type === 'checkbox' ? el.checked : el.value;
    setNotifPrefs(p);
    if (el.type === 'checkbox' && field === 'on') rerender();
    toast('Preferência salva');
  }));
}

export const cloudActions = {
  'sync-now': async () => { await syncNow(); rerender(); },
  'sign-out': async () => {
    if (!(await confirmBox('Sair da conta? Seus dados continuam neste celular, mas param de sincronizar e as notificações deixam de chegar.', { ok: 'Sair' }))) return;
    try { await disablePush(); } catch (e) { /* ignora */ }
    await signOut();
    rerender();
  },
  'push-on': async () => {
    try { await enablePush(); testMsg = { text: 'Notificações ativadas. Agora toque em "Enviar teste".', ok: true }; } catch (e) { testMsg = { text: e.message, ok: false }; }
    rerender();
  },
  'push-off': async () => { try { await disablePush(); toast('Notificações desativadas neste celular'); } catch (e) { toast('Não consegui desativar'); } rerender(); },
  'push-test': async (el) => {
    el.disabled = true;
    testMsg = { text: 'Enviando pelo Supabase…', ok: true }; rerender();
    try {
      const r = await testPush();
      testMsg = r.sent
        ? { text: `O Supabase enviou para ${r.sent} aparelho(s) às ${hm(Date.now())}. Deve chegar em até 1 minuto. Se não aparecer nada, toque em "Testar só neste aparelho".`, ok: true }
        : { text: 'O Supabase recebeu o pedido, mas o envio para o aparelho falhou. Abra no Supabase: Edge Functions → lembretes → Logs, e me mande um print.', ok: false };
    } catch (e) { testMsg = { text: e.message, ok: false }; }
    rerender();
  },
  'push-local': async () => {
    try {
      await testLocalNotification();
      testMsg = { text: 'Mostrei uma notificação gerada pelo próprio aparelho. Se ela apareceu, o aparelho está ok, e o problema está no envio pelo Supabase. Se NÃO apareceu, o Android está bloqueando: veja Configurações → Apps → Planner/Chrome → Notificações.', ok: true };
    } catch (e) { testMsg = { text: e.message, ok: false }; }
    rerender();
  },
  'pref-offset': (el) => {
    const p = getNotifPrefs();
    const k = el.dataset.k, v = Number(el.dataset.v);
    const set = new Set(p[k].offsets || []);
    if (set.has(v)) set.delete(v); else set.add(v);
    p[k].offsets = [...set].sort((a, b) => a - b);
    setNotifPrefs(p);
    rerender();
  }
};

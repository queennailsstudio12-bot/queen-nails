// Panel · Agenda: día, semana, lista por confirmar, recordatorios y acciones de cada cita.
window.PN_Agenda = (() => {
  const { $, D, sb, modal, closeModal, ask, toast, run, opt, proOpts, badge, telShow, waLink, num } = PN;
  const { esc, money, h12, fechaLarga, fechaCorta, hoy, addDays, toMin, fromMin, dur } = QN;
  const A = { date: hoy(), mode: 'dia' };
  const CITA_COLS = 'id,token,fecha,hora,dur_min,profesional_id,cliente_id,cliente,telefono,estado,origen,nota,nota_interna,precio_estimado,recordatorio_enviado,grupo_id,creada';
  let clientesCache = null;

  const hhmm = t => String(t).slice(0, 5);
  const lunes = f => { const d = new Date(f + 'T12:00:00Z').getUTCDay(); return addDays(f, -((d + 6) % 7)); };
  const firstName = n => String(n || '').split(/[\s(]/)[0];

  async function citasRango(a, b, estados) {
    let q = sb.from('citas').select(CITA_COLS).gte('fecha', a).lte('fecha', b);
    if (estados) q = q.in('estado', estados);
    const citas = await QN.q(q.order('fecha').order('hora'));
    if (citas.length) {
      const items = await QN.q(sb.from('cita_servicios').select('cita_id,nombre,orden').in('cita_id', citas.map(c => c.id)).order('orden'));
      for (const c of citas) c.servicios = items.filter(i => i.cita_id === c.id).map(i => i.nombre).join(' + ');
    }
    return citas;
  }
  async function citaById(id) {
    const [c] = await QN.q(sb.from('citas').select(CITA_COLS).eq('id', id));
    if (!c) throw new Error('La cita ya no existe.');
    const items = await QN.q(sb.from('cita_servicios').select('servicio_id,nombre,precio,dur_min,orden').eq('cita_id', id).order('orden'));
    c.items = items; c.servicios = items.map(i => i.nombre).join(' + ');
    return c;
  }

  async function updatePendBadge() {
    try {
      const rows = await QN.q(sb.from('citas').select('id').eq('estado', 'pendiente').gte('fecha', hoy()));
      const b = $('#badge-pend'); b.hidden = !rows.length; b.textContent = rows.length;
      return rows.length;
    } catch { return 0; }
  }

  // ---------- Vista principal ----------
  async function show(v) {
    const pend = await updatePendBadge();
    const label = A.mode === 'semana' ? `Semana del ${fechaCorta(lunes(A.date))}` : A.mode === 'lista' ? 'Próximas citas' : fechaLarga(A.date);
    v.innerHTML = `<div class="toolbar">
        <div class="seg">${[['dia', 'Día'], ['semana', 'Semana'], ['lista', 'Por confirmar' + (pend ? ` (${pend})` : '')]].map(([k, l]) => `<button type="button" data-mode="${k}" class="${A.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${A.mode !== 'lista' ? `<div class="datebar">
          <button type="button" class="icon-btn" data-nav="-1" aria-label="Anterior">‹</button>
          <label class="date-label"><span>${esc(label)}</span><input type="date" id="ag-date" value="${A.date}" aria-label="Elegir fecha"></label>
          <button type="button" class="icon-btn" data-nav="1" aria-label="Siguiente">›</button>
          ${A.date !== hoy() ? '<button type="button" class="chip" data-today>Hoy</button>' : ''}
        </div>` : ''}
      </div>
      <div id="ag-body" class="pad"><p class="muted">Cargando…</p></div>
      <button type="button" class="fab" id="ag-new" aria-label="Nueva cita">＋</button>`;
    v.querySelector('.toolbar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { A.mode = b.dataset.mode; PN.go('agenda'); }
      else if (b.dataset.nav) { A.date = addDays(A.date, (A.mode === 'semana' ? 7 : 1) * +b.dataset.nav); PN.go('agenda'); }
      else if (b.dataset.today !== undefined) { A.date = hoy(); PN.go('agenda'); }
    });
    $('#ag-date')?.addEventListener('change', e => { if (e.target.value) { A.date = e.target.value; PN.go('agenda'); } });
    $('#ag-new').addEventListener('click', () => nuevaCita({ fecha: A.mode === 'lista' ? hoy() : A.date }));
    const body = $('#ag-body');
    body.addEventListener('click', onBodyClick);
    if (A.mode === 'dia') await renderDia(body);
    else if (A.mode === 'semana') await renderSemana(body);
    else await renderLista(body);
  }

  function citaCard(c, opts = {}) {
    const fin = fromMin(toMin(hhmm(c.hora)) + c.dur_min);
    return `<article class="cita st-${c.estado}" data-cita="${c.id}" tabindex="0" role="button">
      <div class="c-time"><b>${h12(hhmm(c.hora))}</b><small>${h12(fin)}</small></div>
      <div class="c-main"><b>${esc(c.cliente)}</b><span>${esc(c.servicios || '')}</span>
        <small>${badge(c.estado)}${c.origen === 'online' ? ' <span title="Reservó en línea">🌐</span>' : ''}${c.nota ? ' <span title="Tiene nota">📝</span>' : ''}${c.recordatorio_enviado ? ' <span title="Recordatorio enviado">🔔</span>' : ''}${PN.multiPro() ? ' · ' + esc(PN.pro(c.profesional_id)?.nombre || '') : ''}${opts.fecha ? ' · ' + esc(fechaCorta(c.fecha)) : ''}</small></div>
      <div class="c-side">${c.precio_estimado > 0 ? money(c.precio_estimado) : ''}</div>
    </article>`;
  }

  async function renderDia(body) {
    const f = A.date;
    const [citas, bloqueos] = await Promise.all([
      citasRango(f, f),
      QN.q(sb.from('bloqueos').select('*').lte('desde', f).gte('hasta', f))
    ]);
    const act = citas.filter(c => ['pendiente', 'confirmada', 'atendida'].includes(c.estado));
    const otras = citas.filter(c => !act.includes(c));
    const h = D.horarios.find(x => x.dia === new Date(f + 'T12:00:00Z').getUTCDay());
    let html = '';
    for (const b of bloqueos) html += `<div class="block-note" data-bloq="${b.id}">🌙 <b>${esc(b.motivo || 'Descanso')}</b> · ${b.hora_ini ? h12(hhmm(b.hora_ini)) + ' – ' + h12(hhmm(b.hora_fin)) : 'todo el día'}${b.profesional_id ? ' · ' + esc(PN.pro(b.profesional_id)?.nombre || '') : ''}</div>`;
    if (!h || !h.activo) html += '<p class="muted">El estudio no abre este día según el horario.</p>';

    // Línea del día: citas y huecos libres (solo si hay una profesional)
    const items = act.map(c => ({ t: toMin(hhmm(c.hora)), html: citaCard(c) }));
    if (h && h.activo && !PN.multiPro() && !bloqueos.some(b => !b.hora_ini)) {
      const busy = act.map(c => [toMin(hhmm(c.hora)), toMin(hhmm(c.hora)) + c.dur_min])
        .concat(bloqueos.filter(b => b.hora_ini).map(b => [toMin(hhmm(b.hora_ini)), toMin(hhmm(b.hora_fin))]))
        .concat(h.descanso_ini ? [[toMin(hhmm(h.descanso_ini)), toMin(hhmm(h.descanso_fin))]] : [])
        .sort((a, b) => a[0] - b[0]);
      let t = toMin(hhmm(h.abre));
      const end = toMin(hhmm(h.cierra));
      const nowMin = f === hoy() ? (() => { const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })); return n.getHours() * 60 + n.getMinutes(); })() : -1;
      for (const [a, b] of [...busy, [end, end]]) {
        const from = Math.max(t, nowMin > t ? Math.ceil(nowMin / 30) * 30 : t);
        if (a - from >= 30) items.push({ t: from, html: `<button type="button" class="free" data-free="${fromMin(from)}">Libre ${h12(fromMin(from))} – ${h12(fromMin(a))} <span>＋ Agendar</span></button>` });
        t = Math.max(t, b);
      }
    }
    items.sort((a, b) => a.t - b.t);
    const total = act.reduce((a, c) => a + Number(c.precio_estimado || 0), 0);
    html += `<p class="day-sum">${act.length ? `<b>${act.length}</b> cita${act.length > 1 ? 's' : ''}${total ? ' · ' + money(total) + ' estimado' : ''}` : 'Sin citas este día.'}</p>`;
    html += items.map(i => i.html).join('');
    if (otras.length) html += `<details class="others"><summary>Canceladas / no asistió (${otras.length})</summary>${otras.map(c => citaCard(c)).join('')}</details>`;
    if (f === hoy()) html += await recordatoriosHtml();
    html += `<div class="row-btns mt"><button type="button" class="btn ghost" data-bloqueo>🌙 Marcar descanso este día</button></div>`;
    body.innerHTML = html;
  }

  async function recordatoriosHtml() {
    const m = addDays(hoy(), 1);
    const citas = (await citasRango(m, m, ['pendiente', 'confirmada']));
    if (!citas.length) return '';
    const falta = citas.filter(c => !c.recordatorio_enviado).length;
    return `<section class="card mt"><h3>🔔 Citas de mañana <small class="muted">${falta ? falta + ' sin recordar' : 'todas recordadas ✓'}</small></h3>
      ${citas.map(c => `<div class="rem-row"><div><b>${h12(hhmm(c.hora))}</b> ${esc(c.cliente)}<br><small class="muted">${esc(c.servicios)} · ${badge(c.estado)}</small></div>
        ${waLink(c.telefono, '') ? `<a class="btn sm ${c.recordatorio_enviado ? 'ghost' : 'wa'}" target="_blank" rel="noopener" data-remind="${c.id}" href="${esc(waLink(c.telefono, msgRecordatorio(c)))}">${c.recordatorio_enviado ? 'Reenviar' : 'Recordar'}</a>` : '<small class="muted">Sin celular</small>'}</div>`).join('')}
    </section>`;
  }

  async function renderSemana(body) {
    const a = lunes(A.date), b = addDays(a, 6);
    const citas = (await citasRango(a, b)).filter(c => c.estado !== 'cancelada');
    let html = '';
    for (let i = 0; i < 7; i++) {
      const f = addDays(a, i), list = citas.filter(c => c.fecha === f);
      html += `<section class="week-day${f === hoy() ? ' today' : ''}"><h3><button type="button" class="link" data-goday="${f}">${esc(fechaLarga(f))}</button><small class="muted">${list.length ? list.length + ' cita' + (list.length > 1 ? 's' : '') : 'libre'}</small></h3>${list.map(c => citaCard(c)).join('')}</section>`;
    }
    body.innerHTML = html;
  }

  async function renderLista(body) {
    const citas = await citasRango(hoy(), addDays(hoy(), 180), ['pendiente']);
    const prox = await citasRango(hoy(), addDays(hoy(), 14), ['confirmada']);
    body.innerHTML = `<h3 class="sec-title">Por confirmar (${citas.length})</h3>
      ${citas.length ? citas.map(c => citaCard(c, { fecha: true })).join('') : '<p class="muted">No hay citas pendientes de confirmar. ✨</p>'}
      ${citas.length ? '<p class="muted small">Toca una cita para confirmarla y avisarle por WhatsApp.</p>' : ''}
      <h3 class="sec-title mt">Confirmadas · próximos 14 días (${prox.length})</h3>
      ${prox.map(c => citaCard(c, { fecha: true })).join('') || '<p class="muted">Sin citas confirmadas.</p>'}`;
  }

  async function onBodyClick(e) {
    const rem = e.target.closest('[data-remind]');
    if (rem) { PN.safe(QN.q(sb.from('citas').update({ recordatorio_enviado: true }).eq('id', rem.dataset.remind)).then(() => { rem.classList.replace('wa', 'ghost'); rem.textContent = 'Reenviar'; })); return; }
    const card = e.target.closest('[data-cita]');
    if (card) return openCita(card.dataset.cita);
    const free = e.target.closest('[data-free]');
    if (free) return nuevaCita({ fecha: A.date, hora: free.dataset.free });
    const gd = e.target.closest('[data-goday]');
    if (gd) { A.date = gd.dataset.goday; A.mode = 'dia'; return PN.go('agenda'); }
    if (e.target.closest('[data-bloqueo]')) return window.PN_Ajustes.editBloqueo({ desde: A.date, hasta: A.date }, () => PN.go('agenda'));
    const bl = e.target.closest('[data-bloq]');
    if (bl) { const [b] = await QN.q(sb.from('bloqueos').select('*').eq('id', bl.dataset.bloq)); if (b) window.PN_Ajustes.editBloqueo(b, () => PN.go('agenda')); }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-cita]')) e.target.click(); });

  // ---------- Mensajes de WhatsApp ----------
  const dir = () => D.cfg.direccion ? `\n📍 ${D.cfg.direccion}` : '';
  const msgConfirmada = c => `Hola ${firstName(c.cliente)} 💅 Tu cita en Queen Nails Studio quedó *confirmada*:\n🗓️ ${fechaLarga(c.fecha)} a las ${h12(hhmm(c.hora))}\n✨ ${c.servicios}${dir()}\n\nSi necesitas cambiarla o cancelarla: ${PN.manageUrl(c.token)}\n¡Te esperamos! 💖`;
  const msgRecordatorio = c => `Hola ${firstName(c.cliente)} ✨ Te recordamos tu cita en Queen Nails Studio ${c.fecha === addDays(hoy(), 1) ? '*mañana*' : 'el ' + fechaLarga(c.fecha)} a las *${h12(hhmm(c.hora))}* (${c.servicios}).${dir()}\n\nPor favor confirma tu asistencia aquí: ${PN.manageUrl(c.token)} 💖`;
  const msgCancelada = c => `Hola ${firstName(c.cliente)}, te escribimos de Queen Nails Studio. Tu cita del ${fechaLarga(c.fecha)} a las ${h12(hhmm(c.hora))} fue cancelada. Si quieres, podemos buscarte otro horario: ${PN.bookingUrl()} 💖`;
  const msgMovida = c => `Hola ${firstName(c.cliente)} 💅 Tu cita en Queen Nails Studio cambió de horario:\n🗓️ ${fechaLarga(c.fecha)} a las ${h12(hhmm(c.hora))}\n✨ ${c.servicios}\n\nVer o cambiar tu cita: ${PN.manageUrl(c.token)}`;

  // ---------- Detalle de una cita ----------
  async function openCita(id) {
    let c;
    try { c = await citaById(id); } catch (e) { return toast(e.message, 'err'); }
    const fin = fromMin(toMin(hhmm(c.hora)) + c.dur_min);
    const act = c.estado === 'pendiente' || c.estado === 'confirmada';
    const wa = (text, label, cls = 'wa') => waLink(c.telefono, '') ? `<a class="btn ${cls}" target="_blank" rel="noopener" href="${esc(waLink(c.telefono, text))}">${label}</a>` : '';
    const b = modal(c.cliente, `
      <div class="detail">
        <p>${badge(c.estado)} ${c.origen === 'online' ? '<span class="tag">Reservó en línea</span>' : '<span class="tag">Creada en el panel</span>'}</p>
        <p class="big">${esc(fechaLarga(c.fecha))}<br>${h12(hhmm(c.hora))} – ${h12(fin)} <small class="muted">(${dur(c.dur_min)})</small></p>
        <p><b>${esc(c.servicios)}</b>${c.precio_estimado > 0 ? ' · ' + money(c.precio_estimado) : ''}${PN.multiPro() ? '<br>Con ' + esc(PN.pro(c.profesional_id)?.nombre || '') : ''}</p>
        ${telShow(c.telefono) ? `<p>📱 <a href="tel:+${esc(c.telefono)}">${telShow(c.telefono)}</a></p>` : ''}
        ${c.nota ? `<p class="note">📝 <b>Nota de la clienta:</b> ${esc(c.nota)}</p>` : ''}
      </div>
      <div class="action-grid">
        ${c.estado === 'pendiente' ? '<button class="btn primary" data-act="confirmar">✓ Confirmar</button>' : ''}
        ${act ? '<button class="btn gold" data-act="cobrar">💰 Cobrar</button>' : ''}
        ${act && c.estado === 'confirmada' ? wa(msgConfirmada(c), '📲 Enviar confirmación') : ''}
        ${act ? wa(msgRecordatorio(c), '🔔 Enviar recordatorio', 'wa ghost') : ''}
        ${act ? '<button class="btn ghost" data-act="mover">🕑 Cambiar horario</button>' : ''}
        ${act ? '<button class="btn ghost" data-act="abono">💵 Registrar abono</button>' : ''}
        ${act ? '<button class="btn ghost" data-act="noasistio">🚫 No asistió</button>' : ''}
        ${act ? '<button class="btn ghost danger-text" data-act="cancelar">✕ Cancelar cita</button>' : ''}
        ${!act && c.estado !== 'atendida' ? '<button class="btn ghost" data-act="restaurar">↺ Volver a activar</button>' : ''}
        ${c.cliente_id ? '<button class="btn ghost" data-act="clienta">👩 Ver ficha de la clienta</button>' : ''}
        <button class="btn ghost" data-act="enlace">🔗 Copiar enlace de la clienta</button>
      </div>
      <label for="ni">Nota interna (solo la ves tú)</label>
      <textarea id="ni" rows="2" maxlength="500">${esc(c.nota_interna || '')}</textarea>
      <button class="btn sm ghost" data-act="nota">Guardar nota</button>`);
    b.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const a = btn.dataset.act;
      const setEstado = async (estado, extra = {}) => {
        await run(btn, () => QN.q(sb.from('citas').update({ estado, ...extra }).eq('id', c.id)));
        c.estado = estado;
      };
      try {
        if (a === 'confirmar') {
          await setEstado('confirmada');
          const link = waLink(c.telefono, msgConfirmada(c));
          modal('Cita confirmada ✓', `<p>¿Quieres avisarle a ${esc(firstName(c.cliente))} por WhatsApp?</p>${link ? `<a class="btn wa full" target="_blank" rel="noopener" href="${esc(link)}" data-close>📲 Enviar confirmación</a>` : ''}<button class="btn ghost full" data-close>Listo</button>`, { onClose: afterChange });
        } else if (a === 'cobrar') { closeModal(); PN.go('caja', { cita: c }); }
        else if (a === 'mover') moverCita(c);
        else if (a === 'abono') window.PN_Caja.nuevoAbono({ cliente: c.cliente, telefono: c.telefono, cita_id: c.id });
        else if (a === 'noasistio') { if (await ask('¿Marcar como "no asistió"?', `${esc(c.cliente)} no llegó a su cita.`, 'Sí, no asistió')) { await setEstado('no_asistio'); closeModal(); afterChange(); } }
        else if (a === 'cancelar') {
          if (!(await ask('¿Cancelar esta cita?', `Se liberará el horario de ${esc(c.cliente)}.`, 'Sí, cancelar'))) return;
          await setEstado('cancelada', { cancelada_por: 'estudio' });
          const link = waLink(c.telefono, msgCancelada(c));
          modal('Cita cancelada', `<p>El horario quedó libre.</p>${link ? `<a class="btn wa full" target="_blank" rel="noopener" href="${esc(link)}" data-close>📲 Avisarle por WhatsApp</a>` : ''}<button class="btn ghost full" data-close>Listo</button>`, { onClose: afterChange });
        } else if (a === 'restaurar') { await setEstado('confirmada'); toast('Cita activada de nuevo'); closeModal(); afterChange(); }
        else if (a === 'clienta') { closeModal(); PN.go('clientes', { id: c.cliente_id }); }
        else if (a === 'enlace') { await navigator.clipboard.writeText(PN.manageUrl(c.token)).then(() => toast('Enlace copiado'), () => toast(PN.manageUrl(c.token))); }
        else if (a === 'nota') { await run(btn, () => QN.q(sb.from('citas').update({ nota_interna: $('#ni', b).value.trim() || null }).eq('id', c.id)), 'Nota guardada'); }
      } catch { /* el aviso ya se mostró */ }
    });
  }
  const afterChange = () => { updatePendBadge(); if (PN.current() === 'agenda') PN.go('agenda'); };

  // ---------- Horas disponibles para formularios ----------
  async function slotOptions(fecha, minutos, prof, ignorarToken, selected) {
    let slots = [];
    try { slots = await QN.rpc('disponibilidad', { p_fecha: fecha, p_dur: minutos, p_prof: prof || null, p_servicios: null, p_ignorar: ignorarToken || null }); } catch { /* fuera de rango */ }
    const libres = (slots || []).filter(s => s.libre).map(s => s.hora);
    return { libres, html: opt('', libres.length ? 'Elige una hora libre' : 'Sin horas libres (usa "otra hora")', '') + libres.map(h => opt(h, h12(h), selected)).join('') };
  }

  // ---------- Nueva cita ----------
  async function nuevaCita(pre = {}) {
    if (!clientesCache) clientesCache = await QN.q(sb.from('clientes').select('id,nombre,telefono').order('nombre')).catch(() => []);
    const svcs = D.svcs.filter(s => s.activo);
    const b = modal('Nueva cita', `<form id="nc" autocomplete="off">
      <label for="nc-n">Clienta</label>
      <input id="nc-n" name="cliente" list="nc-dl" required maxlength="80" placeholder="Nombre" value="${esc(pre.cliente || '')}">
      <datalist id="nc-dl">${clientesCache.map(c => `<option value="${esc(c.nombre)}">${esc(telShow(c.telefono))}</option>`).join('')}</datalist>
      <label for="nc-t">Celular <span class="muted">(opcional)</span></label>
      <input id="nc-t" name="telefono" type="tel" inputmode="tel" placeholder="300 000 0000" value="${esc(telShow(pre.telefono || ''))}">
      <label>Servicios</label>
      <div class="checks">${svcs.map(s => `<label class="check"><input type="checkbox" name="svc" value="${s.id}"${(pre.servicios || []).includes(s.id) ? ' checked' : ''}><span>${esc(s.nombre)} <small>${dur(s.dur_min)}${s.precio > 0 ? ' · ' + money(s.precio) : ''}</small></span></label>`).join('')}</div>
      ${PN.multiPro() ? `<label for="nc-p">Profesional</label><select id="nc-p" name="pro">${proOpts(pre.pro)}</select>` : ''}
      <div class="grid2">
        <div><label for="nc-f">Fecha</label><input id="nc-f" name="fecha" type="date" required value="${pre.fecha || hoy()}"></div>
        <div><label for="nc-d">Duración (min)</label><input id="nc-d" name="dur" type="number" min="5" max="720" step="5" required value="60"></div>
      </div>
      <div class="grid2">
        <div><label for="nc-h">Hora libre</label><select id="nc-h" name="hora"></select></div>
        <div><label for="nc-o">u otra hora</label><input id="nc-o" name="otra" type="time" step="300" value=""></div>
      </div>
      <label for="nc-e">Estado</label>
      <select id="nc-e" name="estado">${opt('confirmada', 'Confirmada', 'confirmada')}${opt('pendiente', 'Por confirmar')}</select>
      <label for="nc-nt">Nota</label><textarea id="nc-nt" name="nota" rows="2" maxlength="300"></textarea>
      <p class="err" id="nc-err"></p>
      <button class="btn primary full">Guardar cita</button>
    </form>`);
    const f = $('#nc', b);
    const proSel = () => PN.multiPro() ? $('#nc-p', b).value : PN.activePros()[0]?.id;
    const chosen = () => [...f.querySelectorAll('input[name=svc]:checked')].map(i => i.value);
    let durTouched = false;
    const refreshHours = async () => {
      const { html } = await slotOptions($('#nc-f', b).value, num($('#nc-d', b).value) || 60, proSel(), null, pre.hora);
      $('#nc-h', b).innerHTML = html;
      if (pre.hora && ![...$('#nc-h', b).options].some(o => o.value === pre.hora)) $('#nc-o', b).value = pre.hora;
    };
    f.addEventListener('change', e => {
      if (e.target.name === 'svc') {
        if (!durTouched) $('#nc-d', b).value = chosen().reduce((a, id) => a + (PN.svc(id)?.dur_min || 0), 0) || 60;
        refreshHours();
      } else if (e.target.name === 'dur') { durTouched = true; refreshHours(); }
      else if (e.target.name === 'fecha' || e.target.name === 'pro') refreshHours();
      else if (e.target.name === 'cliente') {
        const m = clientesCache.find(c => c.nombre.toLowerCase() === e.target.value.trim().toLowerCase());
        if (m && !$('#nc-t', b).value) $('#nc-t', b).value = telShow(m.telefono);
      }
    });
    if (pre.servicios?.length) $('#nc-d', b).value = pre.servicios.reduce((a, id) => a + (PN.svc(id)?.dur_min || 0), 0) || 60;
    refreshHours();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(f), hora = fd.get('otra') || fd.get('hora');
      const err = m => { $('#nc-err', b).textContent = m; };
      if (!chosen().length) return err('Elige al menos un servicio.');
      if (!hora) return err('Elige una hora libre o escribe otra hora.');
      const btn = f.querySelector('button.primary');
      let newId;
      try {
        newId = await run(btn, () => QN.rpc('crear_cita_admin', {
          p_servicios: chosen(), p_fecha: fd.get('fecha'), p_hora: hora, p_cliente: fd.get('cliente'), p_telefono: fd.get('telefono') || '',
          p_prof: proSel(), p_nota: fd.get('nota') || null, p_estado: fd.get('estado'), p_dur: num(fd.get('dur')) || null
        }));
      } catch (ex) { return err(ex.message); }
      clientesCache = null;
      A.date = fd.get('fecha'); if (A.mode === 'lista') A.mode = 'dia';
      const tel = fd.get('telefono');
      if (tel && fd.get('estado') === 'confirmada') {
        const c = await citaById(newId).catch(() => null);
        if (c) {
          modal('Cita guardada ✓', `<p>¿Le envías la confirmación a ${esc(firstName(c.cliente))}?</p><a class="btn wa full" target="_blank" rel="noopener" data-close href="${esc(waLink(c.telefono, msgConfirmada(c)))}">📲 Enviar por WhatsApp</a><button class="btn ghost full" data-close>Ahora no</button>`, { onClose: afterChange });
          return;
        }
      }
      toast('Cita guardada'); closeModal(); afterChange();
    });
  }

  // ---------- Cambiar horario ----------
  async function moverCita(c) {
    const b = modal('Cambiar horario', `<form id="mv">
      <p class="muted">${esc(c.cliente)} · ${esc(c.servicios)}</p>
      <div class="grid2"><div><label for="mv-f">Fecha</label><input id="mv-f" name="fecha" type="date" required value="${c.fecha}"></div>
      <div><label for="mv-d">Duración (min)</label><input id="mv-d" name="dur" type="number" min="5" max="720" step="5" value="${c.dur_min}"></div></div>
      <div class="grid2"><div><label for="mv-h">Hora libre</label><select id="mv-h" name="hora"></select></div>
      <div><label for="mv-o">u otra hora</label><input id="mv-o" name="otra" type="time" step="300"></div></div>
      ${PN.multiPro() ? `<label for="mv-p">Profesional</label><select id="mv-p" name="pro">${proOpts(c.profesional_id)}</select>` : ''}
      <p class="err" id="mv-err"></p><button class="btn primary full">Guardar nuevo horario</button></form>`);
    const f = $('#mv', b);
    const refresh = async () => { $('#mv-h', b).innerHTML = (await slotOptions($('#mv-f', b).value, num($('#mv-d', b).value) || c.dur_min, PN.multiPro() ? $('#mv-p', b).value : c.profesional_id, c.token, hhmm(c.hora))).html; };
    f.addEventListener('change', e => { if (['fecha', 'dur', 'pro'].includes(e.target.name)) refresh(); });
    refresh();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(f), hora = fd.get('otra') || fd.get('hora');
      if (!hora) { $('#mv-err', b).textContent = 'Elige una hora.'; return; }
      try {
        await run(f.querySelector('button'), () => QN.rpc('mover_cita', { p_id: c.id, p_fecha: fd.get('fecha'), p_hora: hora, p_prof: fd.get('pro') || null, p_dur: num(fd.get('dur')) || null }));
      } catch (ex) { $('#mv-err', b).textContent = ex.message; return; }
      const moved = { ...c, fecha: fd.get('fecha'), hora };
      A.date = moved.fecha;
      const link = waLink(c.telefono, msgMovida(moved));
      modal('Horario actualizado ✓', `<p>${esc(fechaLarga(moved.fecha))} a las ${h12(hhmm(hora))}.</p>${link ? `<a class="btn wa full" target="_blank" rel="noopener" data-close href="${esc(link)}">📲 Avisarle por WhatsApp</a>` : ''}<button class="btn ghost full" data-close>Listo</button>`, { onClose: afterChange });
    });
  }

  // ---------- Avisos en tiempo real de reservas nuevas ----------
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = i ? 1046 : 784; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
      });
    } catch { /* sin sonido */ }
  }
  function realtime() {
    try {
      sb.channel('citas-nuevas')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citas' }, p => {
          const c = p.new;
          if (c.origen !== 'online') return;
          const text = `Nueva reserva: ${c.cliente} · ${fechaCorta(c.fecha)} ${h12(hhmm(c.hora))}`;
          toast('🎉 ' + text);
          beep();
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker?.getRegistration().then(r => r ? r.showNotification('Queen Nails · Nueva reserva', { body: text, icon: 'assets/icon-192.png', tag: c.id }) : new Notification('Queen Nails · Nueva reserva', { body: text, icon: 'assets/icon-192.png' }));
          }
          updatePendBadge();
          if (PN.current() === 'agenda') PN.go('agenda');
        })
        .subscribe();
    } catch (e) { console.warn('Tiempo real no disponible', e); }
  }

  const mod = { title: 'Agenda', show, openCita, nuevaCita, citaById, realtime, updatePendBadge, msgConfirmada };
  PN.register('agenda', mod);
  return mod;
})();

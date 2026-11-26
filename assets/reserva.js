// Página pública de reservas de Queen Nails Studio.
(() => {
  const { esc, money, h12, fechaLarga, fmt, dur, wa, rpc } = QN;
  const $ = s => document.querySelector(s);
  const app = $('#booking-app');
  const TOKEN = new URLSearchParams(location.search).get('t');
  const MAX_SVCS = 4, MAX_PEOPLE = 6;

  const S = {
    cfg: null, svcs: [], pros: [], rel: [],
    sel: [], pro: '', date: '', time: '', days: [], slots: null,
    loadingDays: false, loadingSlots: false, group: false, people: [],
    msg: '', busy: false, step: 1, t0: Date.now()
  };
  let reqDays = 0, reqSlots = 0;

  // ---------- Datos derivados ----------
  const svc = id => S.svcs.find(s => s.id === id);
  const bookable = () => S.svcs.filter(s => !s.requiere_valoracion);
  const ids = () => S.group ? S.people.map(p => p.svc).filter(Boolean) : S.sel;
  const totalDur = () => ids().reduce((a, id) => a + (svc(id)?.dur_min || 0), 0);
  const allPriced = () => ids().length > 0 && ids().every(id => svc(id)?.precio > 0);
  const totalPrice = () => ids().reduce((a, id) => a + Number(svc(id)?.precio || 0), 0);
  const prosFor = () => S.pros.filter(p => ids().every(sid => {
    const r = S.rel.filter(x => x.servicio_id === sid);
    return !r.length || r.some(x => x.profesional_id === p.id);
  }));
  const negocio = () => S.cfg?.negocio || {};
  const waNum = () => negocio().whatsapp || '';
  const svcLine = s => `${dur(s.dur_min)}${s.precio > 0 ? ' · ' + money(s.precio) : ''}`;

  // ---------- Mis citas guardadas en este celular ----------
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('qn-citas') || '[]'); } catch { return []; } },
    set(v) { try { localStorage.setItem('qn-citas', JSON.stringify(v.slice(-10))); } catch { /* sin almacenamiento */ } },
    add(items) { this.set([...this.get(), ...items]); }
  };
  function renderMisCitas() {
    const today = S.cfg?.hoy || QN.hoy();
    const list = store.get().filter(c => c.fecha >= today);
    store.set(list);
    const box = $('#mis-citas'), link = $('#mis-citas-link');
    if (!list.length) { box.hidden = true; link.hidden = true; return; }
    link.hidden = false;
    link.href = '?t=' + encodeURIComponent(list[0].t);
    box.hidden = false;
    box.className = 'mine';
    box.innerHTML = `<b>Tus próximas citas</b>` + list.map(c =>
      `<a href="?t=${encodeURIComponent(c.t)}"><span>${esc(c.servicios)}</span><small>${esc(fechaLarga(c.fecha))} · ${h12(c.hora)}</small><i aria-hidden="true">›</i></a>`).join('');
  }

  // ---------- Carga inicial ----------
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    if (TOKEN) document.body.classList.add('manage');
    if (!QN.configured) {
      const t = 'La agenda en línea se está configurando. Muy pronto podrás reservar aquí.';
      app.innerHTML = `<div class="notice">${t}</div>`;
      if (TOKEN) { $('#mi-cita').hidden = false; $('#mi-cita').innerHTML = `<div class="manage-card"><p class="msg">${t}</p></div>`; }
      return;
    }
    try {
      S.cfg = await rpc('publico_config');
      S.svcs = S.cfg.servicios || [];
      S.pros = S.cfg.profesionales || [];
      S.rel = S.cfg.rel || [];
    } catch (e) {
      app.innerHTML = `<p class="msg">No pudimos cargar la agenda. ${esc(e.message)}</p>`;
      if (TOKEN) { $('#mi-cita').hidden = false; $('#mi-cita').innerHTML = `<div class="manage-card"><p class="msg">${esc(e.message)}</p></div>`; }
      return;
    }
    paintBusiness();
    if (TOKEN) return Manage.load();
    renderMisCitas();
    renderServicesGrid();
    buildApp();
  }

  function paintBusiness() {
    const n = negocio();
    if (n.direccion) { $('#tip-dir').textContent = n.direccion; }
    if (n.aviso) { const a = $('#aviso'); a.hidden = false; a.textContent = n.aviso; }
    if (waNum()) {
      const link = wa(waNum(), 'Hola, quiero información sobre Queen Nails Studio ✨');
      $('#wa-float').href = link; $('#wa-float').hidden = false; $('#foot-wa').href = link;
    } else { $('#foot-wa').remove(); }
    // Horario agrupado: "Lun – Sáb · 9:00 a. m. – 8:00 p. m."
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const order = [1, 2, 3, 4, 5, 6, 0].map(d => S.cfg.horarios.find(h => h.dia === d)).filter(Boolean);
    const groups = [];
    for (const h of order) {
      const key = h.activo ? h.abre + '-' + h.cierra : 'off';
      const last = groups.at(-1);
      if (last && last.key === key) last.to = h.dia; else groups.push({ key, from: h.dia, to: h.dia, h });
    }
    $('#hours').innerHTML = groups.map(g => `<li><span>${names[g.from]}${g.from !== g.to ? ' – ' + names[g.to] : ''}</span><span>${g.key === 'off' ? 'Cerrado' : h12(g.h.abre) + ' – ' + h12(g.h.cierra)}</span></li>`).join('');
  }

  function renderServicesGrid() {
    const grid = $('#service-grid');
    if (!grid) return;
    if (!S.svcs.length) { grid.innerHTML = '<p class="muted">Pronto publicaremos nuestros servicios.</p>'; return; }
    grid.innerHTML = S.svcs.map(s => `<article class="service-card">
      <span class="symbol" aria-hidden="true">✧</span>
      <h3>${esc(s.nombre)}</h3>
      ${s.descripcion ? `<p class="desc">${esc(s.descripcion)}</p>` : ''}
      <p class="meta">${s.requiere_valoracion ? 'Requiere valoración previa' : svcLine(s)}</p>
      ${s.requiere_valoracion
        ? (waNum() ? `<a class="card-btn" target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero una valoración para ' + s.nombre)}">Pedir valoración por WhatsApp</a>` : '')
        : `<button type="button" class="card-btn" data-pick="${s.id}">Reservar este servicio</button>`}
    </article>`).join('');
    grid.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      S.group = false; S.sel = [b.dataset.pick]; S.msg = '';
      renderSvc(); renderPro(); refreshDays();
      $('#reserva').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ---------- Formulario por pasos ----------
  function buildApp() {
    if (!bookable().length) { app.innerHTML = '<p class="muted">Aún no hay servicios disponibles para reservar en línea.</p>'; return; }
    app.innerHTML = `
      <ol class="progress" id="progress" aria-label="Pasos de la reserva"></ol>
      <section class="pane" data-pane="1">
        <div class="step" id="st-svc"></div>
        <div class="step" id="st-pro" hidden></div>
      </section>
      <section class="pane" data-pane="2" hidden>
        <div class="step" id="st-date"></div>
      </section>
      <section class="pane" data-pane="3" hidden>
        <div id="summary"></div>
        <div class="step">
          <h4>Tus datos</h4>
          <div class="form-row">
            <div><label for="f-name">Nombre y apellido</label><input id="f-name" autocomplete="name" maxlength="80" placeholder="Ej.: Laura Gómez"></div>
            <div><label for="f-phone">Celular (WhatsApp)</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="300 000 0000"></div>
          </div>
          <label for="f-nota">¿Algo que debamos saber? <span class="opt">(opcional)</span></label>
          <textarea id="f-nota" maxlength="300" rows="2" placeholder="Ej.: traigo diseño de referencia, retiro de acrílico…"></textarea>
          <input class="hp" id="f-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="form-hint">🔒 Usaremos tu número únicamente para contactarte sobre tu cita.</p>
        </div>
      </section>
      <p class="msg" id="msg" role="alert"></p>
      <div class="actionbar" id="actionbar">
        <div class="ab-sum" id="ab-sum"></div>
        <div class="ab-btns"><button type="button" class="btn-back" id="back" hidden>‹ Atrás</button><button type="button" class="button primary" id="next">Continuar</button></div>
      </div>`;
    renderSvc(); renderPro(); renderDate(); renderSummary(); goStep(1, true);
    $('#next').addEventListener('click', () => S.step === 3 ? book() : goStep(S.step + 1));
    $('#back').addEventListener('click', () => goStep(S.step - 1));
    $('#progress').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goStep(+b.dataset.go); });
    app.addEventListener('click', onClick);
    app.addEventListener('change', onChange);
    app.addEventListener('input', e => { if (e.target.dataset.pn !== undefined) S.people[+e.target.dataset.pn].nombre = e.target.value; });
  }

  // ---------- Asistente por pasos ----------
  const STEPS = ['Servicio', 'Fecha y hora', 'Tus datos'];
  const step1Ok = () => ids().length > 0 && !(S.group && S.people.some(p => !p.svc));
  const step2Ok = () => step1Ok() && !!S.date && !!S.time;

  function goStep(n, silent) {
    if (n < 1 || n > 3) return;
    if (n >= 2 && !step1Ok()) { n = 1; if (!silent) setMsg(S.group ? 'Elige el servicio de cada persona.' : 'Elige al menos un servicio.'); }
    else if (n === 3 && !step2Ok()) { n = 2; if (!silent) setMsg('Elige el día y la hora de tu cita.'); }
    else setMsg('');
    S.step = n;
    document.querySelectorAll('.pane').forEach(p => { p.hidden = +p.dataset.pane !== n; });
    $('#progress').innerHTML = STEPS.map((label, i) => {
      const k = i + 1, st = k < n ? 'done' : k === n ? 'on' : '';
      return `<li class="${st}">${k < n ? `<button type="button" data-go="${k}">` : '<span>'}<i>${k < n ? '✓' : k}</i><em>${label}</em>${k < n ? '</button>' : '</span>'}</li>`;
    }).join('');
    renderBar();
    if (!silent) { $('#booking-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); if (n === 3) setTimeout(() => $('#f-name')?.focus({ preventScroll: true }), 350); }
  }

  function renderBar() {
    const sum = $('#ab-sum'), next = $('#next'), back = $('#back');
    if (!sum) return;
    const n = S.step || 1, count = ids().length;
    let line = '';
    if (count) {
      line = `<b>${S.group ? S.people.length + ' personas' : count === 1 ? esc(svc(ids()[0])?.nombre) : count + ' servicios'}</b><small>${dur(totalDur())}${allPriced() ? ' · ' + money(totalPrice()) : ''}${S.time && n >= 2 ? ' · ' + esc(fmt(S.date, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')) + ' ' + h12(S.time) : ''}</small>`;
    } else line = '<small>Elige uno o varios servicios</small>';
    sum.innerHTML = line;
    back.hidden = n === 1;
    next.textContent = n === 1 ? 'Elegir fecha y hora' : n === 2 ? 'Continuar' : 'Confirmar reserva';
    next.disabled = (n === 1 && !step1Ok()) || (n === 2 && !step2Ok());
  }

  function renderSvc() {
    const el = $('#st-svc');
    if (!el) return;
    const val = S.svcs.filter(s => s.requiere_valoracion);
    const valNote = val.length && waNum() ? `<div class="info">✨ <b>${esc(val.map(s => s.nombre).join(', '))}:</b> requiere${val.length > 1 ? 'n' : ''} una valoración antes de agendar. <a target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero una valoración para ' + val.map(s => s.nombre).join(', '))}">Escríbenos por WhatsApp</a>.</div>` : '';
    if (!S.group) {
      el.innerHTML = `<h4>¿Qué te quieres hacer?</h4>
        <p class="hint">Puedes elegir hasta ${MAX_SVCS} servicios para la misma cita.</p>
        <div class="svc-pick">${bookable().map(s => {
          const on = S.sel.includes(s.id);
          return `<button type="button" class="svc-opt${on ? ' on' : ''}" data-svc="${s.id}" aria-pressed="${on}">
            <span class="svc-txt"><b>${esc(s.nombre)}</b>${s.descripcion ? `<small class="svc-desc">${esc(s.descripcion)}</small>` : ''}
            <span class="svc-meta"><span class="chip-dur">🕑 ${dur(s.dur_min)}</span>${s.precio > 0 ? `<span class="svc-price">${money(s.precio)}</span>` : ''}</span></span>
            <span class="tick" aria-hidden="true">${on ? '✓' : '+'}</span></button>`;
        }).join('')}</div>
        ${valNote}
        <button type="button" class="alt" data-group="on">👭 Vengo con más personas</button>`;
    } else {
      const opts = sel => `<option value="">Elige un servicio</option>` + bookable().map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.nombre)} · ${svcLine(s)}</option>`).join('');
      el.innerHTML = `<h4>¿Quiénes vienen?</h4>
        <p class="hint">Las atendemos una después de la otra, empezando a la hora que elijas.</p>
        ${S.people.map((p, i) => `<div class="person">
          <div class="person-head"><b>Persona ${i + 1}</b>${S.people.length > 2 ? `<button type="button" class="x" data-rm="${i}" aria-label="Quitar persona ${i + 1}">✕</button>` : ''}</div>
          <input data-pn="${i}" maxlength="40" placeholder="Nombre (opcional, ej. Mamá)" value="${esc(p.nombre)}" aria-label="Nombre de la persona ${i + 1}">
          <select data-ps="${i}" aria-label="Servicio de la persona ${i + 1}">${opts(p.svc)}</select></div>`).join('')}
        ${S.people.length < MAX_PEOPLE ? '<button type="button" class="alt" data-add-person="1">➕ Agregar otra persona</button>' : ''}
        <button type="button" class="alt ghost" data-group="off">← Reservar solo para mí</button>`;
    }
    renderBar();
  }

  function renderPro() {
    const el = $('#st-pro');
    if (!el) return;
    if (S.pros.length <= 1) { el.hidden = true; S.pro = ''; return; }
    el.hidden = false;
    const list = prosFor();
    if (S.pro && !list.some(p => p.id === S.pro)) S.pro = '';
    el.innerHTML = `<h4>¿Quién te atiende?</h4>
      <select data-pro="1" aria-label="Profesional"><option value="">Cualquiera disponible</option>${list.map(p => `<option value="${p.id}"${p.id === S.pro ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`;
  }

  function renderDate() {
    const el = $('#st-date');
    if (!el) return;
    let body;
    if (!ids().length) body = '<p class="muted">Primero elige un servicio.</p>';
    else if (S.loadingDays && !S.days.length) body = '<p class="muted">Buscando fechas disponibles…</p>';
    else if (!S.days.some(d => d.libres > 0)) body = `<p class="muted">No hay horarios libres para esta duración en los próximos días.${waNum() ? ` <a target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero agendar una cita y no encuentro horario')}">Escríbenos por WhatsApp</a>.` : ''}</p>`;
    else {
      let lastMonth = '';
      const chips = S.days.map(d => {
        const m = fmt(d.fecha, { month: 'short' }).replace('.', '');
        const showM = m !== lastMonth; lastMonth = m;
        return `<button type="button" class="day${d.fecha === S.date ? ' on' : ''}" data-day="${d.fecha}"${d.libres ? '' : ' disabled'} aria-label="${esc(fechaLarga(d.fecha))}${d.libres ? '' : ', sin horarios'}">
          <small>${fmt(d.fecha, { weekday: 'short' }).replace('.', '')}</small><b>${+d.fecha.slice(8)}</b><small class="m">${showM ? m : '&nbsp;'}</small></button>`;
      }).join('');
      let slots;
      if (!S.date) slots = '';
      else if (S.loadingSlots) slots = '<p class="muted">Consultando horarios…</p>';
      else if (!S.slots || !S.slots.length) slots = '<p class="muted">No atendemos este día. Prueba otra fecha.</p>';
      else {
        const parts = [['Mañana', 0, 12], ['Tarde', 12, 18], ['Noche', 18, 24]].map(([label, a, b]) => {
          const list = S.slots.filter(s => { const h = +s.hora.slice(0, 2); return h >= a && h < b; });
          if (!list.length) return '';
          return `<p class="slot-label">${label}</p><div class="slots">${list.map(s => s.libre
            ? `<button type="button" class="slot${S.time === s.hora ? ' on' : ''}" data-time="${s.hora}">${h12(s.hora)}</button>`
            : `<button type="button" class="slot busy" disabled aria-label="${h12(s.hora)} ocupada">${h12(s.hora)}<small>Ocupada</small></button>`).join('')}</div>`;
        }).join('');
        slots = `<p class="day-title">${esc(fechaLarga(S.date))}</p>${parts}${S.slots.some(s => s.libre) ? '' : '<p class="muted">Este día está completo. Prueba otra fecha.</p>'}`;
      }
      body = `<div class="days" role="group" aria-label="Fechas">${chips}</div><div id="slots-box">${slots}</div>`;
    }
    el.innerHTML = `<h4>Elige el día y la hora</h4>${ids().length ? `<p class="hint">Tu cita dura <b>${dur(totalDur())}</b>.</p>` : ''}${body}`;
    renderBar();
  }

  function renderSummary() {
    const el = $('#summary');
    if (!el) return;
    renderBar();
    if (!S.time || !ids().length) { el.innerHTML = ''; return; }
    const fin = QN.fromMin(QN.toMin(S.time) + totalDur());
    const what = S.group
      ? S.people.map((p, i) => `${esc(p.nombre.trim() || 'Persona ' + (i + 1))}: ${esc(svc(p.svc)?.nombre || '—')}`).join('<br>')
      : esc(S.sel.map(id => svc(id)?.nombre).join(' + '));
    el.innerHTML = `<div class="summary"><span class="card-kicker">RESUMEN DE TU CITA</span><p>${what}</p>
      <p><b>${esc(fechaLarga(S.date))}</b><br>${h12(S.time)} – ${h12(fin)}${S.pro ? ' · con ' + esc(S.pros.find(p => p.id === S.pro)?.nombre) : ''}</p>
      ${allPriced() ? `<p class="price">Total aproximado: <b>${money(totalPrice())}</b></p>` : ''}</div>`;
  }

  const setMsg = m => { S.msg = m; const el = $('#msg'); if (el) el.textContent = m; };

  // ---------- Disponibilidad ----------
  async function refreshDays() {
    S.time = ''; renderSummary();
    if (!ids().length || (S.group && S.people.some(p => !p.svc))) {
      S.days = []; S.slots = null; S.date = ''; renderDate(); return;
    }
    const my = ++reqDays;
    S.loadingDays = true; renderDate();
    try {
      const days = await rpc('dias_disponibles', { p_dur: totalDur(), p_prof: S.pro || null, p_servicios: ids() });
      if (my !== reqDays) return;
      S.days = days || [];
      if (!S.days.some(d => d.fecha === S.date && d.libres > 0)) S.date = S.days.find(d => d.libres > 0)?.fecha || '';
    } catch (e) { if (my === reqDays) { S.days = []; setMsg(e.message); } }
    if (my !== reqDays) return;
    S.loadingDays = false;
    await refreshSlots();
  }

  async function refreshSlots() {
    S.time = ''; renderSummary();
    if (!S.date) { S.slots = null; renderDate(); return; }
    const my = ++reqSlots;
    S.loadingSlots = true; renderDate();
    try {
      const slots = await rpc('disponibilidad', { p_fecha: S.date, p_dur: totalDur(), p_prof: S.pro || null, p_servicios: ids() });
      if (my !== reqSlots) return;
      S.slots = slots || [];
    } catch (e) { if (my === reqSlots) { S.slots = []; setMsg(e.message); } }
    if (my !== reqSlots) return;
    S.loadingSlots = false; renderDate();
    // Mantener visible el día elegido en la tira de fechas
    document.querySelector('.day.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ---------- Eventos ----------
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.svc) {
      const i = S.sel.indexOf(d.svc);
      if (i >= 0) S.sel.splice(i, 1);
      else if (S.sel.length >= MAX_SVCS) return setMsg(`Puedes elegir hasta ${MAX_SVCS} servicios por cita.`);
      else S.sel.push(d.svc);
      setMsg(''); renderSvc(); renderPro(); refreshDays();
    } else if (d.group === 'on') {
      const first = S.sel[0] || '';
      S.group = true; S.people = [{ nombre: '', svc: first }, { nombre: '', svc: first }];
      setMsg(''); renderSvc(); renderPro(); refreshDays();
    } else if (d.group === 'off') {
      S.group = false; S.sel = S.people.map(p => p.svc).filter(Boolean).slice(0, 1);
      setMsg(''); renderSvc(); renderPro(); refreshDays();
    } else if (d.addPerson) {
      S.people.push({ nombre: '', svc: S.people.at(-1)?.svc || '' });
      renderSvc(); refreshDays();
    } else if (d.rm !== undefined) {
      S.people.splice(+d.rm, 1); renderSvc(); refreshDays();
    } else if (d.day) {
      S.date = d.day; setMsg(''); refreshSlots();
    } else if (d.time) {
      S.time = d.time; setMsg(''); renderDate(); renderSummary();
      setTimeout(() => goStep(3), 180);
    }
  }

  function onChange(e) {
    const d = e.target.dataset;
    if (d.ps !== undefined) { S.people[+d.ps].svc = e.target.value; setMsg(''); renderPro(); refreshDays(); }
    else if (d.pro) { S.pro = e.target.value; setMsg(''); refreshDays(); }
  }

  // ---------- Reservar ----------
  async function book() {
    if (S.busy) return;
    const name = $('#f-name').value.trim(), phone = $('#f-phone').value.trim(), nota = $('#f-nota').value.trim();
    if ($('#f-hp').value || Date.now() - S.t0 < 3000) return; // anti-spam
    if (!step1Ok()) return goStep(1);
    if (!step2Ok()) return goStep(2);
    if (name.length < 2) { $('#f-name').focus(); return setMsg('Escribe tu nombre.'); }
    if (phone.replace(/\D/g, '').length < 10) { $('#f-phone').focus(); return setMsg('Escribe tu número de celular (10 dígitos).'); }
    S.busy = true; $('#next').disabled = true; $('#next').textContent = 'Reservando…'; setMsg('');
    try {
      let done;
      if (S.group) {
        const items = S.people.map(p => ({ nombre: p.nombre.trim(), servicios: [p.svc] }));
        const res = await rpc('reservar_grupo', { p_fecha: S.date, p_hora: S.time, p_items: items, p_cliente: name, p_telefono: phone, p_prof: S.pro || null, p_nota: nota || null });
        done = { group: res, token: res[0].token, fecha: S.date, hora: S.time, min: totalDur(), servicios: 'Reserva en grupo (' + res.length + ' personas)', name };
        store.add(res.map(r => ({ t: r.token, fecha: S.date, hora: r.hora, servicios: r.nombre + ': ' + r.servicios })));
      } else {
        const token = await rpc('reservar_cita', { p_servicios: S.sel, p_fecha: S.date, p_hora: S.time, p_cliente: name, p_telefono: phone, p_prof: S.pro || null, p_nota: nota || null });
        done = { token, fecha: S.date, hora: S.time, min: totalDur(), servicios: S.sel.map(id => svc(id)?.nombre).join(' + '), name };
        store.add([{ t: token, fecha: S.date, hora: S.time, servicios: done.servicios }]);
      }
      try { done.estado = (await rpc('mi_cita', { p_token: done.token }))?.estado; } catch { done.estado = 'pendiente'; }
      renderDone(done);
    } catch (e) {
      setMsg(e.message);
      if (/ocup|disponible/i.test(e.message)) { goStep(2); refreshSlots(); }
    } finally {
      S.busy = false;
      if ($('#next')) renderBar();
    }
  }

  function manageUrl(token) { return location.href.split(/[?#]/)[0] + '?t=' + encodeURIComponent(token); }

  function calButtons(o) {
    return `<a class="alt" target="_blank" rel="noopener" href="${QN.googleCal(o)}">📅 Agregar a Google Calendar</a>
      <button type="button" class="alt" data-ics='${esc(JSON.stringify(o))}'>📅 Guardar en otro calendario (.ics)</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ics]');
    if (b) QN.descargarIcs(JSON.parse(b.dataset.ics));
  });

  function renderDone(d) {
    const n = negocio(), pend = d.estado !== 'confirmada';
    const detalle = d.group
      ? d.group.map(g => `${g.nombre}: ${g.servicios} a las ${h12(g.hora)}`).join('\n')
      : d.servicios;
    const msgWa = `Hola, soy ${d.name}. Reservé ${d.group ? 'para ' + d.group.length + ' personas' : d.servicios} el ${fechaLarga(d.fecha)} a las ${h12(d.hora)}. ${pend ? '¿Me confirman, por favor?' : '¡Nos vemos!'}\nMi cita: ${manageUrl(d.token)}`;
    const cal = { titulo: 'Cita en Queen Nails Studio', fecha: d.fecha, hora: d.hora, min: d.min, detalle: detalle + '\nGestiona tu cita: ' + manageUrl(d.token), lugar: n.direccion || '' };
    app.innerHTML = `<div class="done">
      <div class="check" aria-hidden="true">✓</div>
      <h3>${pend ? '¡Reserva recibida!' : '¡Cita confirmada!'}</h3>
      <p class="done-what">${d.group ? d.group.map(g => `<span>${esc(g.nombre)} · ${esc(g.servicios)} · <b>${h12(g.hora)}</b></span>`).join('') : `<b>${esc(d.servicios)}</b>`}</p>
      <p class="done-when">${esc(fechaLarga(d.fecha))} · ${h12(d.hora)}</p>
      <p class="muted">${pend ? 'Tu cita queda pendiente hasta que Sofía la confirme. Para hacerlo más rápido, escríbenos por WhatsApp.' : 'Te esperamos. Si necesitas cambiar algo, usa tu enlace personal.'}</p>
      ${waNum() ? `<a class="button primary wide" target="_blank" rel="noopener" href="${wa(waNum(), msgWa)}">${pend ? 'Confirmar por WhatsApp' : 'Escribir por WhatsApp'}</a>` : ''}
      <a class="alt" href="${esc(manageUrl(d.token))}">Ver, cambiar o cancelar mi cita</a>
      ${calButtons(cal)}
      <button type="button" class="alt ghost" id="again">Hacer otra reserva</button>
    </div>`;
    $('#again').addEventListener('click', () => location.reload());
    renderMisCitas();
    $('#booking-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Mi cita (enlace personal) ----------
  const Manage = {
    M: null, mode: '', date: '', time: '', days: [], slots: null, msg: '', busy: false,
    el: () => $('#mi-cita'),
    async load() {
      this.el().hidden = false;
      this.el().innerHTML = '<div class="manage-card"><p class="muted">Cargando tu cita…</p></div>';
      try { this.M = await rpc('mi_cita', { p_token: TOKEN }); } catch (e) { this.M = null; this.msg = e.message; }
      this.render();
      this.el().addEventListener('click', e => this.click(e));
    },
    render() {
      const M = this.M, n = negocio();
      const head = `<a class="back-link" href="./">← Ir al inicio</a>`;
      if (!M) {
        this.el().innerHTML = `<div class="manage-card">${head}<h3>No encontramos esta cita</h3><p class="muted">Revisa el enlace o escríbenos.</p>${waNum() ? `<a class="button primary wide" target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, no encuentro mi cita')}">Escribir por WhatsApp</a>` : ''}</div>`;
        return;
      }
      const lbl = { pendiente: 'Pendiente de confirmar', confirmada: 'Confirmada', cancelada: 'Cancelada', atendida: 'Atendida', no_asistio: 'No asistió' }[M.estado] || M.estado;
      const fin = QN.fromMin(QN.toMin(M.hora) + M.dur_min);
      let body = '';
      if (M.estado === 'cancelada' || M.estado === 'atendida' || M.estado === 'no_asistio') {
        body = `<a class="button primary wide" href="./#reserva">Reservar una nueva cita</a>`;
      } else if (this.mode === 'cx') {
        body = `<p class="warn">¿Seguro que quieres cancelar esta cita?</p>
          <button type="button" class="button danger wide" data-a="yes">Sí, cancelar mi cita</button>
          <button type="button" class="alt" data-a="back">No, volver</button>`;
      } else if (this.mode === 're') {
        body = this.reHtml();
      } else {
        const cal = { titulo: 'Cita en Queen Nails Studio', fecha: M.fecha, hora: M.hora, min: M.dur_min, detalle: M.servicios + '\nGestiona tu cita: ' + location.href, lugar: n.direccion || '' };
        body = (M.estado === 'pendiente' ? `<button type="button" class="button primary wide" data-a="ok">Confirmar mi asistencia</button>` : '') +
          (M.puede_modificar
            ? `<button type="button" class="alt" data-a="re">Cambiar fecha u hora</button><button type="button" class="alt" data-a="cx">Cancelar cita</button>`
            : `<p class="muted small">Faltan menos de ${M.horas_cancelar} horas: para cambios escríbenos por WhatsApp.</p>`) +
          calButtons(cal) +
          (waNum() ? `<a class="alt" target="_blank" rel="noopener" href="${wa(waNum(), `Hola, soy ${M.cliente}. Tengo cita el ${fechaLarga(M.fecha)} a las ${h12(M.hora)}.`)}">💬 Escribir por WhatsApp</a>` : '');
      }
      this.el().innerHTML = `<div class="manage-card">${head}
        <span class="badge ${M.estado}">${esc(lbl)}</span>
        <h3>${esc(M.servicios || 'Tu cita')}</h3>
        <p class="done-when">${esc(fechaLarga(M.fecha))}<br>${h12(M.hora)} – ${h12(fin)}</p>
        <p class="muted">${esc(M.cliente)}${S.pros.length > 1 && M.profesional ? ' · con ' + esc(M.profesional) : ''}${M.precio > 0 ? ' · ' + money(M.precio) + ' aprox.' : ''}</p>
        ${n.direccion ? `<p class="muted small">📍 ${esc(n.direccion)}</p>` : ''}
        ${this.msg ? `<p class="msg${this.ok ? ' ok' : ''}">${esc(this.msg)}</p>` : ''}
        <div class="manage-actions">${body}</div></div>`;
    },
    reHtml() {
      const chips = this.days.length ? this.days.map(d => `<button type="button" class="day${d.fecha === this.date ? ' on' : ''}" data-mday="${d.fecha}"${d.libres || d.fecha === this.M.fecha ? '' : ' disabled'}>
          <small>${fmt(d.fecha, { weekday: 'short' }).replace('.', '')}</small><b>${+d.fecha.slice(8)}</b><small class="m">${fmt(d.fecha, { month: 'short' }).replace('.', '')}</small></button>`).join('') : '';
      let slots = '<p class="muted">Cargando…</p>';
      if (this.slots) slots = this.slots.filter(s => s.libre).length
        ? `<div class="slots">${this.slots.filter(s => s.libre).map(s => `<button type="button" class="slot${this.time === s.hora ? ' on' : ''}" data-mtime="${s.hora}">${h12(s.hora)}</button>`).join('')}</div>`
        : '<p class="muted">No hay horarios libres este día.</p>';
      return `<p class="hint">Elige el nuevo día y la nueva hora:</p><div class="days">${chips}</div>
        ${this.date ? `<p class="day-title">${esc(fechaLarga(this.date))}</p>${slots}` : ''}
        <button type="button" class="button primary wide" data-a="save"${this.time ? '' : ' disabled'}>Guardar nuevo horario</button>
        <button type="button" class="alt" data-a="back">Volver</button>`;
    },
    async loadDays() {
      try { this.days = await rpc('dias_disponibles', { p_dur: this.M.dur_min, p_prof: this.M.profesional_id, p_servicios: null }); } catch (e) { this.msg = e.message; this.days = []; }
      this.date = this.days.some(d => d.fecha === this.M.fecha) ? this.M.fecha : (this.days.find(d => d.libres)?.fecha || '');
      await this.loadSlots();
    },
    async loadSlots() {
      this.slots = null; this.time = ''; this.render();
      if (!this.date) return;
      try { this.slots = await rpc('disponibilidad', { p_fecha: this.date, p_dur: this.M.dur_min, p_prof: this.M.profesional_id, p_servicios: null, p_ignorar: TOKEN }); }
      catch (e) { this.slots = []; this.msg = e.message; }
      this.render();
    },
    async click(e) {
      const b = e.target.closest('button');
      if (!b || b.disabled || this.busy) return;
      const d = b.dataset;
      if (d.mday) { this.date = d.mday; return this.loadSlots(); }
      if (d.mtime) { this.time = d.mtime; return this.render(); }
      if (!d.a) return;
      this.msg = ''; this.ok = false;
      if (d.a === 'back') { this.mode = ''; return this.render(); }
      if (d.a === 'cx') { this.mode = 'cx'; return this.render(); }
      if (d.a === 're') { this.mode = 're'; this.render(); return this.loadDays(); }
      this.busy = true; b.disabled = true;
      try {
        if (d.a === 'ok') await rpc('confirmar_cita', { p_token: TOKEN });
        else if (d.a === 'yes') await rpc('cancelar_cita', { p_token: TOKEN });
        else if (d.a === 'save') {
          await rpc('reagendar_cita', { p_token: TOKEN, p_fecha: this.date, p_hora: this.time });
          const list = store.get().map(c => c.t === TOKEN ? { ...c, fecha: this.date, hora: this.time } : c); store.set(list);
        }
        this.mode = '';
        this.M = await rpc('mi_cita', { p_token: TOKEN });
        this.ok = true;
        this.msg = { ok: '¡Gracias! Tu asistencia quedó confirmada.', yes: 'Tu cita fue cancelada.', save: '¡Listo! Tu cita cambió de horario.' }[d.a];
      } catch (err) {
        this.msg = err.message;
        if (this.mode === 're') await this.loadSlots();
      } finally { this.busy = false; }
      this.render();
    }
  };

  init();
})();

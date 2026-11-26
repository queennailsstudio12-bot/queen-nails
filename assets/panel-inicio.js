// Panel · Inicio: resumen del día (estilo tablero de AgendaPro).
window.PN_Inicio = (() => {
  const { $, D, sb, toast, waLink } = PN;
  const { esc, money, h12, fechaLarga, fechaCorta, hoy, addDays, toMin, fromMin } = QN;
  const hhmm = t => String(t).slice(0, 5);

  function saludo() {
    const h = +new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false });
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
  const ahoraHHMM = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

  async function show(v) {
    const Ag = window.PN_Agenda, f = hoy(), m = addDays(f, 1);
    const [citasHoy, manana, pendientes, caja, clientes] = await Promise.all([
      Ag.citasRango(f, f),
      Ag.citasRango(m, m, ['pendiente', 'confirmada']),
      Ag.citasRango(f, addDays(f, 120), ['pendiente']),
      QN.rpc('caja_dia', { p_fecha: f }).catch(() => null),
      QN.q(sb.from('clientes').select('id,nombre,telefono,cumpleanos').not('cumpleanos', 'is', null)).catch(() => [])
    ]);
    Ag.updatePendBadge();
    const act = citasHoy.filter(c => ['pendiente', 'confirmada', 'atendida'].includes(c.estado));
    const now = ahoraHHMM();
    const prox = act.filter(c => c.estado !== 'atendida' && hhmm(c.hora) >= now)[0];
    const atendidas = act.filter(c => c.estado === 'atendida').length;
    const estimado = act.reduce((a, c) => a + Number(c.precio_estimado || 0), 0);
    const sinRecordar = manana.filter(c => !c.recordatorio_enviado);
    const stockBajo = D.prods.filter(p => p.activo && !p.uso_interno && p.stock <= p.stock_min);
    const mes = f.slice(5, 7), dia = f.slice(8);
    const cumpleHoy = clientes.filter(c => c.cumpleanos.slice(5) === `${mes}-${dia}`);
    const cumpleMes = clientes.filter(c => c.cumpleanos.slice(5, 7) === mes);
    const hNombre = (PN.activePros()[0]?.nombre || '').split(' ')[0];

    const row = c => `<button type="button" class="tl-row st-${c.estado}" data-cita="${c.id}">
        <span class="tl-time">${h12(hhmm(c.hora))}</span>
        <span class="tl-main"><b>${esc(c.cliente)}</b><small>${esc(c.servicios || '')}</small></span>
        ${PN.badge(c.estado)}</button>`;

    v.innerHTML = `<div class="pad dash">
      <div class="dash-head">
        <div><h1>${saludo()}${hNombre ? ', ' + esc(hNombre) : ''} ✨</h1><p class="muted">${esc(fechaLarga(f))}</p></div>
        <div class="quick">
          <button type="button" class="btn primary" data-q="cita">＋ Nueva cita</button>
          <button type="button" class="btn gold" data-q="cobrar">💰 Cobrar</button>
          <button type="button" class="btn ghost" data-q="bloqueo">🌙 Bloquear</button>
          <button type="button" class="btn ghost" data-q="enlace">🔗 Enlace</button>
        </div>
      </div>

      <div class="kpis">
        <button type="button" class="kpi" data-go="agenda"><small>Citas hoy</small><b>${act.length}</b><span>${atendidas ? atendidas + ' atendida' + (atendidas > 1 ? 's' : '') : 'ninguna atendida aún'}</span></button>
        <button type="button" class="kpi ${pendientes.length ? 'warn' : ''}" data-go="pend"><small>Por confirmar</small><b>${pendientes.length}</b><span>${pendientes.length ? 'toca para revisarlas' : 'todo al día ✓'}</span></button>
        <button type="button" class="kpi hl" data-go="caja"><small>Ventas de hoy</small><b>${money(caja?.total_ventas || 0)}</b><span>${caja ? caja.ventas + ' venta' + (caja.ventas == 1 ? '' : 's') : '—'}${estimado ? ' · estimado ' + money(estimado) : ''}</span></button>
        <button type="button" class="kpi" ${prox ? `data-cita="${prox.id}"` : 'data-go="agenda"'}><small>Próxima cita</small><b>${prox ? h12(hhmm(prox.hora)) : '—'}</b><span>${prox ? esc(prox.cliente) : 'no hay más citas hoy'}</span></button>
      </div>

      <div class="dash-grid">
        <section class="card">
          <h3>Agenda de hoy <button type="button" class="link" data-go="agenda">Ver calendario ›</button></h3>
          ${act.length ? `<div class="timeline">${act.map(row).join('')}</div>` : `<div class="empty-state"><span>🗓️</span><p>No hay citas para hoy.</p><button type="button" class="btn sm primary" data-q="cita">＋ Agendar una cita</button></div>`}
        </section>

        <div class="dash-side">
          ${pendientes.length ? `<section class="card attention">
            <h3>⏳ Por confirmar <span class="count">${pendientes.length}</span></h3>
            ${pendientes.slice(0, 5).map(c => `<button type="button" class="mini-row" data-cita="${c.id}"><span><b>${esc(c.cliente)}</b><small>${esc(fechaCorta(c.fecha))} · ${h12(hhmm(c.hora))} · ${esc(c.servicios || '')}</small></span><i>›</i></button>`).join('')}
            ${pendientes.length > 5 ? `<button type="button" class="link" data-go="pend">Ver las ${pendientes.length} ›</button>` : ''}
          </section>` : ''}

          <section class="card">
            <h3>🔔 Recordatorios de mañana</h3>
            ${manana.length ? `<p class="muted small">${manana.length} cita${manana.length > 1 ? 's' : ''} mañana · ${sinRecordar.length ? `<b>${sinRecordar.length} sin recordar</b>` : 'todas recordadas ✓'}</p>
              ${sinRecordar.slice(0, 4).map(c => `<div class="mini-row static"><span><b>${h12(hhmm(c.hora))} · ${esc(c.cliente)}</b><small>${esc(c.servicios || '')}</small></span>${waLink(c.telefono, '') ? `<a class="btn sm wa" target="_blank" rel="noopener" data-remind="${c.id}" href="${esc(waLink(c.telefono, Ag.msgRecordatorio(c)))}">Recordar</a>` : ''}</div>`).join('')}`
              : '<p class="muted small">No hay citas mañana.</p>'}
          </section>

          ${stockBajo.length || cumpleHoy.length || cumpleMes.length ? `<section class="card">
            <h3>📌 Avisos</h3>
            ${cumpleHoy.map(c => `<div class="mini-row static"><span><b>🎂 Hoy cumple ${esc(c.nombre)}</b></span>${waLink(c.telefono, '') ? `<a class="btn sm wa ghost" target="_blank" rel="noopener" href="${esc(waLink(c.telefono, `¡Feliz cumpleaños, ${c.nombre.split(' ')[0]}! 🎂👑 Te deseamos un día hermoso. Con cariño, Queen Nails Studio 💅✨`))}">Felicitar</a>` : ''}</div>`).join('')}
            ${cumpleMes.length > cumpleHoy.length ? `<button type="button" class="mini-row" data-go="cumple"><span><b>🎂 ${cumpleMes.length} clienta${cumpleMes.length > 1 ? 's' : ''} cumple${cumpleMes.length > 1 ? 'n' : ''} años este mes</b></span><i>›</i></button>` : ''}
            ${stockBajo.length ? `<button type="button" class="mini-row" data-go="stock"><span><b>🧴 ${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''} con poco stock</b><small>${esc(stockBajo.slice(0, 3).map(p => p.nombre).join(', '))}</small></span><i>›</i></button>` : ''}
          </section>` : ''}
        </div>
      </div>
    </div>`;

    v.firstElementChild.addEventListener('click', e => {
      const rem = e.target.closest('[data-remind]');
      if (rem) { PN.safe(QN.q(sb.from('citas').update({ recordatorio_enviado: true }).eq('id', rem.dataset.remind)).then(() => { rem.classList.replace('wa', 'ghost'); rem.textContent = 'Enviado ✓'; })); return; }
      const c = e.target.closest('[data-cita]'); if (c) return Ag.openCita(c.dataset.cita);
      const g = e.target.closest('[data-go]')?.dataset.go;
      if (g === 'agenda') { Ag.setDate(hoy(), 'dia'); return PN.go('agenda'); }
      if (g === 'pend') { Ag.setDate(hoy(), 'lista'); return PN.go('agenda'); }
      if (g === 'caja') return PN.go('caja', { tab: 'caja' });
      if (g === 'cumple') return PN.go('clientes', { filtro: 'cumple' });
      if (g === 'stock') return PN.go('mas', { sub: 'productos' });
      const q = e.target.closest('[data-q]')?.dataset.q;
      if (q === 'cita') Ag.nuevaCita({ fecha: hoy() });
      else if (q === 'cobrar') PN.go('caja', { tab: 'cobrar' });
      else if (q === 'bloqueo') window.PN_Ajustes.editBloqueo({ desde: hoy(), hasta: hoy() }, () => PN.go('inicio'));
      else if (q === 'enlace') navigator.clipboard.writeText(PN.bookingUrl()).then(() => toast('Enlace de reservas copiado'), () => PN.go('mas', { sub: 'enlace' }));
    });
  }

  const mod = { title: 'Inicio', show };
  PN.register('inicio', mod);
  return mod;
})();

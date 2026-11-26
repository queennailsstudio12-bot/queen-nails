// Panel · Clientas: lista, ficha, historial, registros técnicos.
window.PN_Clientes = (() => {
  const { $, sb, modal, closeModal, ask, toast, run, badge, telShow, waLink, num } = PN;
  const { esc, money, h12, fechaLarga, fechaCorta, hoy, addDays } = QN;
  const S = { q: '', filtro: 'todas', list: null };

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const mesActual = () => hoy().slice(5, 7);

  async function show(v, arg) {
    S.list = await QN.rpc('clientes_resumen');
    v.innerHTML = `<div class="toolbar"><input type="search" id="cl-q" placeholder="Buscar por nombre o celular" value="${esc(S.q)}" aria-label="Buscar clienta">
      <div class="seg scroll">${[['todas', 'Todas'], ['cumple', '🎂 Cumpleaños del mes'], ['frecuentes', '⭐ Frecuentes'], ['inactivas', '💤 Sin venir +60 días'], ['abono', '💵 Con abono']].map(([k, l]) => `<button type="button" data-f="${k}" class="${S.filtro === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="pad"><div id="cl-list"></div></div>
      <button type="button" class="fab" id="cl-new" aria-label="Nueva clienta">＋</button>`;
    $('#cl-q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
    v.querySelector('.seg').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { S.filtro = b.dataset.f; PN.go('clientes'); } });
    $('#cl-new').addEventListener('click', () => editar(null));
    $('#cl-list').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) ficha(r.dataset.id); });
    renderList();
    if (arg?.id) ficha(arg.id);
  }

  function renderList() {
    const q = norm(S.q), qd = S.q.replace(/\D/g, '');
    const lim = addDays(hoy(), -60);
    let list = S.list.filter(c => !q || norm(c.nombre).includes(q) || (qd.length >= 3 && c.telefono.includes(qd)));
    if (S.filtro === 'cumple') list = list.filter(c => c.cumpleanos && c.cumpleanos.slice(5, 7) === mesActual()).sort((a, b) => a.cumpleanos.slice(8).localeCompare(b.cumpleanos.slice(8)));
    if (S.filtro === 'frecuentes') list = list.filter(c => c.visitas >= 3).sort((a, b) => b.visitas - a.visitas);
    if (S.filtro === 'inactivas') list = list.filter(c => c.ultima && c.ultima < lim && !c.proxima);
    if (S.filtro === 'abono') list = list.filter(c => Number(c.abono_disponible) > 0);
    $('#cl-list').innerHTML = `<p class="day-sum">${list.length} clienta${list.length === 1 ? '' : 's'}</p>` + (list.map(c => `<button type="button" class="list-row" data-id="${c.id}">
      <span class="avatar" aria-hidden="true">${esc((c.nombre || '?')[0].toUpperCase())}</span>
      <span><b>${esc(c.nombre)}</b><small>${esc(telShow(c.telefono))}${c.visitas ? ` · ${c.visitas} visita${c.visitas > 1 ? 's' : ''}` : ' · nueva'}${c.ultima ? ' · última ' + esc(fechaCorta(c.ultima)) : ''}${c.proxima ? ' · 📅 ' + esc(fechaCorta(String(c.proxima).slice(0, 10))) : ''}${c.cumpleanos && S.filtro === 'cumple' ? ' · 🎂 ' + esc(QN.fmt(c.cumpleanos, { day: 'numeric', month: 'long' })) : ''}${c.no_asistio ? ` · ⚠️ ${c.no_asistio} no asistió` : ''}</small></span>
      <b>${Number(c.gastado) ? money(c.gastado) : ''}</b></button>`).join('') || '<p class="muted">No hay clientas con ese filtro.</p>');
  }

  async function ficha(id) {
    let h;
    try { h = await QN.rpc('cliente_historial', { p_id: id }); } catch (e) { return toast(e.message, 'err'); }
    const c = h.cliente; if (!c) return toast('La clienta no existe.', 'err');
    const r = S.list?.find(x => x.id === id) || {};
    const cumple = c.cumpleanos && c.cumpleanos.slice(5, 7) === mesActual();
    const b = modal(c.nombre, `
      <div class="detail">
        ${telShow(c.telefono) ? `<p>📱 <a href="tel:+${esc(c.telefono)}">${esc(telShow(c.telefono))}</a></p>` : ''}
        ${c.cumpleanos ? `<p>🎂 ${esc(QN.fmt(c.cumpleanos, { day: 'numeric', month: 'long' }))}${cumple ? ' <span class="tag">¡Cumple este mes!</span>' : ''}</p>` : ''}
        ${c.notas ? `<p class="note">📝 ${esc(c.notas)}</p>` : ''}
      </div>
      <div class="stats sm">
        <div><small>Visitas</small><b>${r.visitas ?? '—'}</b></div>
        <div><small>Ha gastado</small><b>${money(r.gastado || 0)}</b></div>
        <div><small>No asistió</small><b>${r.no_asistio ?? 0}</b></div>
        <div><small>Abono</small><b>${money(r.abono_disponible || 0)}</b></div>
      </div>
      <div class="action-grid">
        ${waLink(c.telefono, '') ? `<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(c.telefono, `Hola ${c.nombre.split(' ')[0]} 💖`))}">📲 WhatsApp</a>` : ''}
        ${cumple && waLink(c.telefono, '') ? `<a class="btn wa ghost" target="_blank" rel="noopener" href="${esc(waLink(c.telefono, `¡Feliz cumpleaños, ${c.nombre.split(' ')[0]}! 🎂👑 En Queen Nails Studio queremos consentirte: este mes tienes un detalle especial en tu próxima cita. ¡Te esperamos! 💅✨`))}">🎂 Felicitar</a>` : ''}
        <button class="btn primary" data-a="cita">📅 Nueva cita</button>
        <button class="btn ghost" data-a="tec">🧪 Registro técnico</button>
        <button class="btn ghost" data-a="abono">💵 Abono</button>
        <button class="btn ghost" data-a="edit">✏️ Editar datos</button>
      </div>
      <h3 class="sec-title">Registros técnicos</h3>
      ${h.registros.map(x => `<div class="list-row static"><span><b>${esc(fechaCorta(x.fecha))}${x.servicio ? ' · ' + esc(x.servicio) : ''}</b><small class="pre">${esc(x.detalle)}</small></span><button type="button" class="icon-btn" data-deltec="${x.id}" aria-label="Borrar registro">🗑</button></div>`).join('') || '<p class="muted small">Anota aquí productos, colores, técnicas y medidas que usaste.</p>'}
      <h3 class="sec-title">Citas</h3>
      ${h.citas.slice(0, 30).map(x => `<div class="list-row static"><span><b>${esc(fechaCorta(x.fecha))} · ${h12(x.hora)}</b><small>${esc(x.servicios || '')}</small></span>${badge(x.estado)}</div>`).join('') || '<p class="muted small">Sin citas.</p>'}
      <h3 class="sec-title">Compras</h3>
      ${h.ventas.slice(0, 30).map(x => `<button type="button" class="list-row" data-venta="${x.id}"><span><b>#${x.numero} · ${esc(fechaCorta(x.fecha))}</b><small>${esc(x.items || '')}${x.anulada ? ' · ANULADA' : ''}</small></span><b>${money(x.total)}</b></button>`).join('') || '<p class="muted small">Sin compras.</p>'}
      ${h.abonos.length ? `<h3 class="sec-title">Abonos</h3>${h.abonos.map(a => `<div class="list-row static"><span><b>${money(a.monto)}</b><small>${esc(fechaCorta(a.fecha))} · ${esc(a.estado)}</small></span></div>`).join('')}` : ''}
      <button class="btn ghost danger-text full mt" data-a="del">Eliminar clienta</button>`, { wide: true });
    b.addEventListener('click', async e => {
      const v = e.target.closest('[data-venta]'); if (v) return window.PN_Caja.comprobante(v.dataset.venta);
      const dt = e.target.closest('[data-deltec]');
      if (dt) { if (await ask('¿Borrar este registro técnico?', '', 'Sí, borrar')) { await run(dt, () => QN.q(sb.from('registros_tecnicos').delete().eq('id', dt.dataset.deltec))).catch(() => {}); ficha(id); } return; }
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'cita') window.PN_Agenda.nuevaCita({ cliente: c.nombre, telefono: c.telefono, fecha: hoy() });
      else if (a === 'abono') window.PN_Caja.nuevoAbono({ cliente: c.nombre, telefono: c.telefono }, () => ficha(id));
      else if (a === 'edit') editar(c);
      else if (a === 'tec') tecnico(c);
      else if (a === 'del') {
        if (!(await ask('¿Eliminar a ' + esc(c.nombre) + '?', 'Se borra su ficha y sus registros técnicos. Sus citas y ventas se conservan sin el vínculo.', 'Sí, eliminar'))) return;
        await run(null, () => QN.q(sb.from('clientes').delete().eq('id', id)), 'Clienta eliminada').catch(() => {});
        closeModal(); PN.go('clientes');
      }
    });
  }

  function editar(c) {
    const b = modal(c ? 'Editar clienta' : 'Nueva clienta', `<form id="ce">
      <label for="ce-n">Nombre</label><input id="ce-n" name="nombre" required maxlength="80" value="${esc(c?.nombre || '')}">
      <div class="grid2"><div><label for="ce-t">Celular</label><input id="ce-t" name="telefono" type="tel" required value="${esc(telShow(c?.telefono || ''))}"></div>
      <div><label for="ce-b">Cumpleaños</label><input id="ce-b" name="cumpleanos" type="date" value="${esc(c?.cumpleanos || '')}"></div></div>
      <label for="ce-e">Correo</label><input id="ce-e" name="email" type="email" value="${esc(c?.email || '')}">
      <label for="ce-no">Notas (alergias, preferencias…)</label><textarea id="ce-no" name="notas" rows="3" maxlength="1000">${esc(c?.notas || '')}</textarea>
      <p class="err" id="ce-err"></p><button class="btn primary full mt">Guardar</button></form>`);
    $('#ce', b).addEventListener('submit', async e => {
      e.preventDefault();
      const fd = PN.formData(e.target);
      let tel = fd.telefono.replace(/\D/g, '');
      if (tel.length === 10 && tel[0] === '3') tel = '57' + tel;
      if (tel.length < 8) { $('#ce-err', b).textContent = 'Revisa el celular.'; return; }
      const row = { nombre: fd.nombre.trim(), telefono: tel, cumpleanos: fd.cumpleanos || null, email: fd.email || null, notas: fd.notas || null };
      let id = c?.id;
      try {
        await run(e.target.querySelector('button'), async () => {
          if (c) await QN.q(sb.from('clientes').update(row).eq('id', c.id));
          else id = (await QN.q(sb.from('clientes').insert(row).select('id')))[0].id;
        }, 'Clienta guardada');
      } catch (ex) { $('#ce-err', b).textContent = /duplicate|unique/i.test(ex.raw?.message || '') ? 'Ya existe una clienta con ese celular.' : ex.message; return; }
      S.list = await QN.rpc('clientes_resumen');
      if (PN.current() === 'clientes') renderList();
      ficha(id);
    });
  }

  function tecnico(c) {
    const b = modal('Registro técnico · ' + c.nombre, `<form id="rt">
      <div class="grid2"><div><label for="rt-f">Fecha</label><input id="rt-f" name="fecha" type="date" value="${hoy()}" required></div>
      <div><label for="rt-s">Servicio</label><input id="rt-s" name="servicio" list="rt-dl" maxlength="80"><datalist id="rt-dl">${PN.D.svcs.map(s => `<option value="${esc(s.nombre)}">`).join('')}</datalist></div></div>
      <label for="rt-d">Detalle</label><textarea id="rt-d" name="detalle" rows="5" required maxlength="2000" placeholder="Ej.: Polygel rosa nude #12, forma almendra, largo 2, top coat mate. Cutícula sensible."></textarea>
      <button class="btn primary full mt">Guardar registro</button></form>`);
    $('#rt', b).addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      await run(e.target.querySelector('button'), () => QN.q(sb.from('registros_tecnicos').insert({ cliente_id: c.id, fecha: fd.fecha, servicio: fd.servicio || null, detalle: fd.detalle })), 'Registro guardado').catch(() => {});
      ficha(c.id);
    });
  }

  const mod = { title: 'Clientas', show, ficha };
  PN.register('clientes', mod);
  return mod;
})();

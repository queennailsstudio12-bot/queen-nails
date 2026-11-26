// Panel · Más: servicios, equipo, horario, descansos, inventario, gastos fijos, pagos, configuración, PIN y respaldo.
window.PN_Ajustes = (() => {
  const { $, D, sb, modal, closeModal, ask, toast, run, opt, metodoOpts, proOpts, metodoLbl, telShow, num } = PN;
  const { esc, money, h12, fechaLarga, fechaCorta, hoy, addDays, dur } = QN;
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const hhmm = t => t ? String(t).slice(0, 5) : '';
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

  const MENU = [
    ['Negocio', [
      ['servicios', '💅', 'Servicios y precios', 'Nombre, duración, precio y si se reservan en línea'],
      ['horario', '🕘', 'Horario de atención', 'Días y horas en que se puede reservar'],
      ['descansos', '🌙', 'Descansos y ausencias', 'Vacaciones, festivos, citas médicas…'],
      ['equipo', '👩‍🎨', 'Equipo', 'Profesionales, comisiones y servicios que hace cada una'],
      ['productos', '🧴', 'Productos e inventario', 'Precios, costos y stock'],
      ['fijos', '🏠', 'Gastos fijos', 'Arriendo, servicios… para calcular la utilidad'],
      ['pagos', '💸', 'Pagos a profesionales', 'Comisiones, propinas y adelantos', true]
    ]],
    ['Reservas en línea', [
      ['enlace', '🔗', 'Enlace y código QR', 'Compártelo en Instagram, WhatsApp o imprímelo'],
      ['negocio', '⚙️', 'Configuración de reservas', 'WhatsApp, aviso, anticipación, cancelaciones', true]
    ]],
    ['Seguridad y datos', [
      ['pin', '🔒', 'PIN de seguridad', 'Protege reportes, pagos y configuración'],
      ['clave', '🔑', 'Cambiar contraseña', 'De tu cuenta del panel'],
      ['notif', '🔔', 'Notificaciones', 'Aviso cuando llegue una reserva'],
      ['app', '📲', 'Instalar como app', 'Tener la agenda en la pantalla de inicio'],
      ['respaldo', '💾', 'Respaldo', 'Descarga una copia de todos tus datos', true],
      ['limpieza', '🧹', 'Liberar espacio', 'Borra citas canceladas antiguas', true],
      ['salir', '🚪', 'Cerrar sesión', '']
    ]]
  ];
  const SUBS = {};

  async function show(v, arg) {
    const sub = arg?.sub;
    if (sub && SUBS[sub]) {
      const item = MENU.flatMap(g => g[1]).find(i => i[0] === sub);
      if (item?.[4] && !(await PN.pinGate())) return PN.go('mas');
      $('#top-sub').textContent = item?.[2] || 'Ajustes';
      v.innerHTML = `<div class="pad"><button type="button" class="link back" data-back>‹ Volver</button><div id="sub"></div></div>`;
      v.querySelector('[data-back]').addEventListener('click', () => PN.go('mas'));
      return SUBS[sub]($('#sub'));
    }
    v.innerHTML = `<div class="pad">${MENU.map(([g, items]) => `<h3 class="sec-title">${g}</h3><div class="menu">${items.map(([k, ic, t, d, lock]) =>
      `<button type="button" class="menu-row" data-sub="${k}"><span class="ic" aria-hidden="true">${ic}</span><span><b>${t}${lock && D.hasPin ? ' 🔒' : ''}</b>${d ? `<small>${d}</small>` : ''}</span><i aria-hidden="true">›</i></button>`).join('')}</div>`).join('')}
      <p class="muted small center mt">Queen Nails Studio · Panel de gestión</p></div>`;
    v.firstElementChild.addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (b) PN.go('mas', { sub: b.dataset.sub }); });
  }
  const reload = sub => PN.loadBase().then(() => PN.go('mas', { sub }));

  // ---------- Servicios ----------
  SUBS.servicios = el => {
    el.innerHTML = `<button type="button" class="btn primary full" data-new>＋ Nuevo servicio</button>
      ${D.svcs.map(s => `<button type="button" class="list-row${s.activo ? '' : ' void'}" data-id="${s.id}"><span><b>${esc(s.nombre)}</b><small>${dur(s.dur_min)} · ${s.precio > 0 ? money(s.precio) : 'sin precio'}${!s.activo ? ' · oculto' : !s.reserva_online ? ' · solo en el panel' : s.requiere_valoracion ? ' · requiere valoración' : ' · en línea'}</small></span><i aria-hidden="true">›</i></button>`).join('')}
      <p class="muted small mt">Los precios aparecen en la página de reservas. Si un servicio tiene precio 0, no se muestra el precio.</p>`;
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.new !== undefined) editServicio(); else if (b.dataset.id) editServicio(PN.svc(b.dataset.id)); });
  };
  function editServicio(s) {
    const b = modal(s ? 'Editar servicio' : 'Nuevo servicio', `<form id="sf">
      <label for="s-n">Nombre</label><input id="s-n" name="nombre" required maxlength="80" value="${esc(s?.nombre || '')}">
      <label for="s-d">Descripción <span class="muted">(opcional)</span></label><textarea id="s-d" name="descripcion" rows="2" maxlength="300">${esc(s?.descripcion || '')}</textarea>
      <div class="grid3"><div><label for="s-du">Duración (min)</label><input id="s-du" name="dur_min" type="number" min="5" max="720" step="5" required value="${s?.dur_min || 60}"></div>
      <div><label for="s-p">Precio</label><input id="s-p" name="precio" type="number" min="0" step="1000" value="${s?.precio ?? 0}"></div>
      <div><label for="s-o">Orden</label><input id="s-o" name="orden" type="number" step="1" value="${s?.orden ?? D.svcs.length + 1}"></div></div>
      <label for="s-c">Categoría <span class="muted">(opcional)</span></label><input id="s-c" name="categoria" maxlength="40" value="${esc(s?.categoria || '')}">
      <label class="check"><input type="checkbox" name="activo"${!s || s.activo ? ' checked' : ''}><span>Activo</span></label>
      <label class="check"><input type="checkbox" name="reserva_online"${!s || s.reserva_online ? ' checked' : ''}><span>Se puede reservar en línea</span></label>
      <label class="check"><input type="checkbox" name="requiere_valoracion"${s?.requiere_valoracion ? ' checked' : ''}><span>Requiere valoración antes (la clienta escribe por WhatsApp)</span></label>
      <p class="err" id="s-e"></p>
      <button class="btn primary full mt">Guardar</button>${s ? '<button type="button" class="btn ghost danger-text full" data-del>Eliminar servicio</button>' : ''}</form>`);
    const f = $('#sf', b);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(f);
      const row = { nombre: fd.nombre.trim(), descripcion: fd.descripcion || null, categoria: fd.categoria || null, dur_min: num(fd.dur_min), precio: num(fd.precio), orden: num(fd.orden), activo: !!fd.activo, reserva_online: !!fd.reserva_online, requiere_valoracion: !!fd.requiere_valoracion };
      try { await run(f.querySelector('.primary'), () => QN.q(s ? sb.from('servicios').update(row).eq('id', s.id) : sb.from('servicios').insert(row)), 'Servicio guardado'); }
      catch (ex) { $('#s-e', b).textContent = ex.message; return; }
      closeModal(); reload('servicios');
    });
    f.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ask('¿Eliminar "' + esc(s.nombre) + '"?', 'Las citas y ventas anteriores conservan el nombre. Si solo quieres dejar de ofrecerlo, desmarca "Activo".', 'Sí, eliminar'))) return;
      await run(null, () => QN.q(sb.from('servicios').delete().eq('id', s.id)), 'Servicio eliminado').catch(() => {});
      closeModal(); reload('servicios');
    });
  }

  // ---------- Horario ----------
  SUBS.horario = el => {
    const rows = [1, 2, 3, 4, 5, 6, 0].map(d => D.horarios.find(h => h.dia === d) || { dia: d, activo: false, abre: '09:00', cierra: '18:00' });
    el.innerHTML = `<form id="hf">${rows.map(h => `<div class="hour-row">
        <label class="check"><input type="checkbox" name="a${h.dia}"${h.activo ? ' checked' : ''}><span><b>${DIAS[h.dia]}</b></span></label>
        <div class="inline"><input type="time" name="o${h.dia}" value="${hhmm(h.abre)}" aria-label="${DIAS[h.dia]} abre"><span>a</span><input type="time" name="c${h.dia}" value="${hhmm(h.cierra)}" aria-label="${DIAS[h.dia]} cierra"></div>
        <details${h.descanso_ini ? ' open' : ''}><summary>Pausa (almuerzo)</summary><div class="inline"><input type="time" name="di${h.dia}" value="${hhmm(h.descanso_ini)}" aria-label="Pausa desde"><span>a</span><input type="time" name="df${h.dia}" value="${hhmm(h.descanso_fin)}" aria-label="Pausa hasta"></div></details>
      </div>`).join('')}
      <div class="card"><label for="h-p">Cada cuántos minutos se ofrecen horas</label><select id="h-p" name="paso">${[15, 20, 30, 45, 60].map(m => opt(m, m + ' minutos', D.cfg.paso_min)).join('')}</select>
      <p class="muted small">Con 30 minutos se ofrecen 9:00, 9:30, 10:00… La última hora ofrecida es la que permite terminar el servicio antes del cierre.</p></div>
      <p class="err" id="h-e"></p><button class="btn primary full">Guardar horario</button></form>`;
    $('#hf').addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      const err = m => { $('#h-e').textContent = m; };
      const upd = [];
      for (const h of rows) {
        const d = h.dia, row = { activo: !!fd['a' + d], abre: fd['o' + d] || '09:00', cierra: fd['c' + d] || '18:00', descanso_ini: fd['di' + d] || null, descanso_fin: fd['df' + d] || null };
        if (row.cierra <= row.abre) return err(`${DIAS[d]}: la hora de cierre debe ser después de la de apertura.`);
        if (!!row.descanso_ini !== !!row.descanso_fin) return err(`${DIAS[d]}: completa las dos horas de la pausa o déjalas vacías.`);
        if (row.descanso_ini && row.descanso_fin <= row.descanso_ini) return err(`${DIAS[d]}: la pausa debe terminar después de empezar.`);
        upd.push([d, row]);
      }
      try {
        await run(e.target.querySelector('button'), async () => {
          for (const [d, row] of upd) await QN.q(sb.from('horarios').update(row).eq('dia', d));
          await QN.q(sb.from('config_negocio').update({ paso_min: num(fd.paso), actualizado: new Date().toISOString() }).eq('id', 1));
        }, 'Horario guardado');
      } catch (ex) { return err(ex.message); }
      reload('horario');
    });
  };

  // ---------- Descansos ----------
  SUBS.descansos = async el => {
    const list = await QN.q(sb.from('bloqueos').select('*').gte('hasta', addDays(hoy(), -30)).order('desde'));
    const fut = list.filter(b => b.hasta >= hoy()), past = list.filter(b => b.hasta < hoy());
    const row = b => `<button type="button" class="list-row" data-id="${b.id}"><span><b>${esc(b.motivo || 'Descanso')}</b><small>${esc(fechaCorta(b.desde))}${b.hasta !== b.desde ? ' – ' + esc(fechaCorta(b.hasta)) : ''} · ${b.hora_ini ? h12(hhmm(b.hora_ini)) + ' – ' + h12(hhmm(b.hora_fin)) : 'todo el día'}${PN.multiPro() ? ' · ' + esc(b.profesional_id ? PN.pro(b.profesional_id)?.nombre : 'Todo el estudio') : ''}</small></span><i aria-hidden="true">›</i></button>`;
    el.innerHTML = `<button type="button" class="btn primary full" data-new>＋ Nuevo descanso</button>
      <p class="muted small">En esos días u horas no se podrán hacer reservas en línea.</p>
      <h3 class="sec-title">Próximos</h3>${fut.map(row).join('') || '<p class="muted">No hay descansos programados.</p>'}
      ${past.length ? `<details class="others"><summary>Recientes (${past.length})</summary>${past.map(row).join('')}</details>` : ''}`;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.new !== undefined) editBloqueo({}, () => PN.go('mas', { sub: 'descansos' }));
      else if (b.dataset.id) editBloqueo(list.find(x => x.id === b.dataset.id), () => PN.go('mas', { sub: 'descansos' }));
    });
  };
  function editBloqueo(bq = {}, done) {
    const horas = !!bq.hora_ini;
    const b = modal(bq.id ? 'Editar descanso' : 'Nuevo descanso', `<form id="bf">
      <label for="b-m">Motivo</label><input id="b-m" name="motivo" maxlength="80" placeholder="Ej.: Vacaciones, festivo, cita médica" value="${esc(bq.motivo || '')}">
      ${PN.multiPro() ? `<label for="b-p">¿Quién?</label><select id="b-p" name="pro">${opt('', 'Todo el estudio', bq.profesional_id || '')}${PN.activePros().map(p => opt(p.id, p.nombre, bq.profesional_id)).join('')}</select>` : ''}
      <div class="grid2"><div><label for="b-d">Desde</label><input id="b-d" name="desde" type="date" required value="${bq.desde || hoy()}"></div>
      <div><label for="b-h">Hasta</label><input id="b-h" name="hasta" type="date" required value="${bq.hasta || bq.desde || hoy()}"></div></div>
      <label class="check"><input type="checkbox" name="horas" id="b-x"${horas ? ' checked' : ''}><span>Solo unas horas (no el día completo)</span></label>
      <div class="grid2" id="b-hr"${horas ? '' : ' hidden'}><div><label for="b-i">De</label><input id="b-i" name="hora_ini" type="time" value="${hhmm(bq.hora_ini) || '12:00'}"></div>
      <div><label for="b-f">A</label><input id="b-f" name="hora_fin" type="time" value="${hhmm(bq.hora_fin) || '14:00'}"></div></div>
      <p class="err" id="b-e"></p><button class="btn primary full mt">Guardar</button>${bq.id ? '<button type="button" class="btn ghost danger-text full" data-del>Eliminar descanso</button>' : ''}</form>`);
    const f = $('#bf', b);
    $('#b-x', b).addEventListener('change', e => { $('#b-hr', b).hidden = !e.target.checked; });
    f.addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(f);
      const row = { motivo: fd.motivo || null, profesional_id: fd.pro || null, desde: fd.desde, hasta: fd.hasta, hora_ini: fd.horas ? fd.hora_ini : null, hora_fin: fd.horas ? fd.hora_fin : null };
      if (row.hasta < row.desde) return void ($('#b-e', b).textContent = 'La fecha final debe ser igual o posterior a la inicial.');
      if (fd.horas && row.hora_fin <= row.hora_ini) return void ($('#b-e', b).textContent = 'La hora final debe ser después de la inicial.');
      try { await run(f.querySelector('.primary'), () => QN.q(bq.id ? sb.from('bloqueos').update(row).eq('id', bq.id) : sb.from('bloqueos').insert(row)), 'Descanso guardado'); }
      catch (ex) { $('#b-e', b).textContent = ex.message; return; }
      // Avisar si ya hay citas en ese periodo
      let citas = await QN.q(sb.from('citas').select('id,fecha,hora,dur_min,cliente,profesional_id').gte('fecha', row.desde).lte('fecha', row.hasta).in('estado', ['pendiente', 'confirmada'])).catch(() => []);
      citas = citas.filter(c => (!row.profesional_id || c.profesional_id === row.profesional_id) && (!row.hora_ini || (hhmm(c.hora) < row.hora_fin && QN.fromMin(QN.toMin(hhmm(c.hora)) + c.dur_min) > row.hora_ini)));
      if (citas.length) {
        modal('Ojo: hay citas en ese descanso', `<p>Estas citas ya estaban agendadas. Cámbialas de horario o cancélalas:</p>${citas.map(c => `<button type="button" class="list-row" data-cita="${c.id}"><span><b>${esc(c.cliente)}</b><small>${esc(fechaLarga(c.fecha))} · ${h12(hhmm(c.hora))}</small></span><i>›</i></button>`).join('')}<button class="btn ghost full mt" data-close>Entendido</button>`, { onClose: done })
          .addEventListener('click', e => { const x = e.target.closest('[data-cita]'); if (x) window.PN_Agenda.openCita(x.dataset.cita); });
      } else { closeModal(); done && done(); }
    });
    f.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ask('¿Eliminar este descanso?', 'Esos días u horas volverán a estar disponibles para reservas.', 'Sí, eliminar'))) return;
      await run(null, () => QN.q(sb.from('bloqueos').delete().eq('id', bq.id)), 'Descanso eliminado').catch(() => {});
      closeModal(); done && done();
    });
  }

  // ---------- Equipo ----------
  SUBS.equipo = el => {
    el.innerHTML = `<button type="button" class="btn primary full" data-new>＋ Agregar profesional</button>
      ${D.pros.map(p => `<button type="button" class="list-row${p.activo ? '' : ' void'}" data-id="${p.id}"><span class="avatar" aria-hidden="true">${esc(p.nombre[0])}</span><span><b>${esc(p.nombre)}</b><small>Comisión servicios ${Number(p.comision)}% · productos ${Number(p.comision_producto)}%${p.activo ? '' : ' · inactiva'}</small></span><i aria-hidden="true">›</i></button>`).join('')}
      <p class="muted small mt">Con una sola profesional activa, las clientas no ven el paso "¿Quién te atiende?". Si Sofía es la dueña, deja su comisión en 0%.</p>`;
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.new !== undefined) editPro(); else if (b.dataset.id) editPro(PN.pro(b.dataset.id)); });
  };
  function editPro(p) {
    const mine = p ? D.rel.filter(r => r.profesional_id === p.id).map(r => r.servicio_id) : [];
    const b = modal(p ? 'Editar profesional' : 'Nueva profesional', `<form id="pf">
      <div class="grid2"><div><label for="p-n">Nombre</label><input id="p-n" name="nombre" required maxlength="60" value="${esc(p?.nombre || '')}"></div>
      <div><label for="p-t">Celular</label><input id="p-t" name="telefono" type="tel" value="${esc(telShow(p?.telefono || ''))}"></div></div>
      <div class="grid3"><div><label for="p-c">Comisión servicios %</label><input id="p-c" name="comision" type="number" min="0" max="100" step="1" value="${p ? Number(p.comision) : 0}"></div>
      <div><label for="p-cp">Comisión productos %</label><input id="p-cp" name="comision_producto" type="number" min="0" max="100" step="1" value="${p ? Number(p.comision_producto) : 0}"></div>
      <div><label for="p-o">Orden</label><input id="p-o" name="orden" type="number" value="${p?.orden ?? D.pros.length + 1}"></div></div>
      <label class="check"><input type="checkbox" name="activo"${!p || p.activo ? ' checked' : ''}><span>Activa (aparece en la agenda y en reservas)</span></label>
      <label>Servicios que hace</label><p class="muted small">Si no marcas ninguno, puede hacer todos.</p>
      <div class="checks">${D.svcs.map(s => `<label class="check"><input type="checkbox" name="svc" value="${s.id}"${mine.includes(s.id) ? ' checked' : ''}><span>${esc(s.nombre)}</span></label>`).join('')}</div>
      <p class="err" id="p-e"></p><button class="btn primary full mt">Guardar</button></form>`);
    const f = $('#pf', b);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(f);
      const svcs = [...f.querySelectorAll('input[name=svc]:checked')].map(i => i.value);
      let tel = String(fd.telefono || '').replace(/\D/g, ''); if (tel.length === 10) tel = '57' + tel;
      const row = { nombre: fd.nombre.trim(), telefono: tel || null, comision: num(fd.comision), comision_producto: num(fd.comision_producto), orden: num(fd.orden), activo: !!fd.activo };
      if (p && !row.activo && D.pros.filter(x => x.activo && x.id !== p.id).length === 0) return void ($('#p-e', b).textContent = 'Debe quedar al menos una profesional activa.');
      try {
        await run(f.querySelector('.primary'), async () => {
          let id = p?.id;
          if (p) await QN.q(sb.from('profesionales').update(row).eq('id', id));
          else id = (await QN.q(sb.from('profesionales').insert(row).select('id')))[0].id;
          await QN.q(sb.from('profesional_servicio').delete().eq('profesional_id', id));
          if (svcs.length) await QN.q(sb.from('profesional_servicio').insert(svcs.map(s => ({ profesional_id: id, servicio_id: s }))));
        }, 'Guardado');
      } catch (ex) { $('#p-e', b).textContent = ex.message; return; }
      closeModal(); reload('equipo');
    });
  }

  // ---------- Productos ----------
  SUBS.productos = el => {
    const low = D.prods.filter(p => p.activo && p.stock <= p.stock_min);
    const valor = D.prods.filter(p => p.activo).reduce((a, p) => a + Math.max(0, p.stock) * Number(p.costo), 0);
    el.innerHTML = `<button type="button" class="btn primary full" data-new>＋ Nuevo producto</button>
      <div class="stats sm"><div><small>Productos activos</small><b>${D.prods.filter(p => p.activo).length}</b></div><div><small>Valor del inventario (costo)</small><b>${money(valor)}</b></div><div class="${low.length ? 'warn' : ''}"><small>Stock bajo</small><b>${low.length}</b></div></div>
      <input type="search" id="pq" placeholder="Buscar producto" aria-label="Buscar producto">
      <div id="plist"></div>`;
    const paint = q => { $('#plist').innerHTML = D.prods.filter(p => !q || p.nombre.toLowerCase().includes(q)).map(p => `<button type="button" class="list-row${p.activo ? '' : ' void'}" data-id="${p.id}"><span><b>${esc(p.nombre)}</b><small>${p.uso_interno ? 'Insumo · ' : ''}${money(p.precio)} · costo ${money(p.costo)}${p.categoria ? ' · ' + esc(p.categoria) : ''}</small></span><b class="${p.stock <= p.stock_min ? 'warn-text' : ''}">${p.stock} u.</b></button>`).join('') || '<p class="muted">No hay productos.</p>'; };
    paint('');
    $('#pq').addEventListener('input', e => paint(e.target.value.toLowerCase()));
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.new !== undefined) editProducto(); else if (b.dataset.id) editProducto(D.prods.find(x => x.id === b.dataset.id)); });
  };
  async function editProducto(p) {
    const movs = p ? await QN.q(sb.from('stock_movs').select('*').eq('producto_id', p.id).order('creado', { ascending: false }).limit(15)).catch(() => []) : [];
    const b = modal(p ? p.nombre : 'Nuevo producto', `<form id="prf">
      <label for="pr-n">Nombre</label><input id="pr-n" name="nombre" required maxlength="80" value="${esc(p?.nombre || '')}">
      <div class="grid2"><div><label for="pr-c">Categoría</label><input id="pr-c" name="categoria" maxlength="40" value="${esc(p?.categoria || '')}"></div>
      <div><label for="pr-m">Marca</label><input id="pr-m" name="marca" maxlength="40" value="${esc(p?.marca || '')}"></div></div>
      <div class="grid3"><div><label for="pr-p">Precio venta</label><input id="pr-p" name="precio" type="number" min="0" step="100" value="${p?.precio ?? 0}"></div>
      <div><label for="pr-co">Costo</label><input id="pr-co" name="costo" type="number" min="0" step="100" value="${p?.costo ?? 0}"></div>
      <div><label for="pr-mi">Stock mínimo</label><input id="pr-mi" name="stock_min" type="number" min="0" value="${p?.stock_min ?? 0}"></div></div>
      ${p ? '' : '<label for="pr-s">Stock inicial</label><input id="pr-s" name="stock" type="number" min="0" value="0">'}
      <label class="check"><input type="checkbox" name="uso_interno"${p?.uso_interno ? ' checked' : ''}><span>Insumo de uso interno (no se vende)</span></label>
      <label class="check"><input type="checkbox" name="activo"${!p || p.activo ? ' checked' : ''}><span>Activo</span></label>
      <p class="err" id="pr-e"></p><button class="btn primary full mt">Guardar</button></form>
      ${p ? `<section class="card mt"><h3>Inventario: ${p.stock} unidades</h3><form id="aj" class="inline"><input name="c" type="number" step="1" placeholder="+5 o -2" required aria-label="Cantidad"><input name="m" placeholder="Motivo" maxlength="60" aria-label="Motivo"><button class="btn sm primary">Ajustar</button></form>
        ${movs.map(m => `<div class="list-row static"><span><b>${m.cantidad > 0 ? '+' : ''}${m.cantidad}</b><small>${esc(m.motivo || '')} · ${new Date(m.creado).toLocaleDateString('es-CO')}</small></span></div>`).join('')}</section>
        <button type="button" class="btn ghost danger-text full" data-del>Eliminar producto</button>` : ''}`);
    $('#prf', b).addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      const row = { nombre: fd.nombre.trim(), categoria: fd.categoria || null, marca: fd.marca || null, precio: num(fd.precio), costo: num(fd.costo), stock_min: num(fd.stock_min), uso_interno: !!fd.uso_interno, activo: !!fd.activo };
      try {
        await run(e.target.querySelector('button'), async () => {
          if (p) await QN.q(sb.from('productos').update(row).eq('id', p.id));
          else {
            const [n] = await QN.q(sb.from('productos').insert({ ...row, stock: 0 }).select('id'));
            if (num(fd.stock)) await QN.rpc('ajustar_stock', { p_prod: n.id, p_cant: num(fd.stock), p_motivo: 'Stock inicial' });
          }
        }, 'Producto guardado');
      } catch (ex) { $('#pr-e', b).textContent = ex.message; return; }
      closeModal(); reload('productos');
    });
    $('#aj', b)?.addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      try { await run(e.target.querySelector('button'), () => QN.rpc('ajustar_stock', { p_prod: p.id, p_cant: Math.trunc(num(fd.c)), p_motivo: fd.m || 'Ajuste manual' }), 'Inventario ajustado'); } catch { return; }
      await PN.loadBase(); editProducto(D.prods.find(x => x.id === p.id)); if (PN.current() === 'mas') PN.go('mas', { sub: 'productos' });
    });
    b.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await ask('¿Eliminar este producto?', 'Las ventas anteriores conservan el nombre. Si solo no lo vendes más, desmarca "Activo".', 'Sí, eliminar'))) return;
      await run(null, () => QN.q(sb.from('productos').delete().eq('id', p.id)), 'Producto eliminado').catch(() => {});
      closeModal(); reload('productos');
    });
  }

  // ---------- Gastos fijos ----------
  SUBS.fijos = async el => {
    const list = await QN.q(sb.from('gastos_fijos').select('*').order('concepto'));
    el.innerHTML = `<button type="button" class="btn primary full" data-new>＋ Nuevo gasto fijo</button>
      <p class="day-sum">Total mensual: <b>${money(list.filter(g => g.activo).reduce((a, g) => a + Number(g.monto), 0))}</b></p>
      ${list.map(g => `<button type="button" class="list-row${g.activo ? '' : ' void'}" data-id="${g.id}"><span><b>${esc(g.concepto)}</b><small>${g.dia_mes ? 'Se paga el día ' + g.dia_mes : 'Mensual'}${g.activo ? '' : ' · inactivo'}</small></span><b>${money(g.monto)}</b></button>`).join('') || '<p class="muted">Agrega arriendo, servicios públicos, internet… Se usan en los reportes para calcular la utilidad.</p>'}`;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const g = list.find(x => x.id === b.dataset.id);
      if (b.dataset.new === undefined && !g) return;
      const m = modal(g ? 'Editar gasto fijo' : 'Nuevo gasto fijo', `<form id="gff"><label for="gf-c">Concepto</label><input id="gf-c" name="concepto" required maxlength="80" value="${esc(g?.concepto || '')}">
        <div class="grid2"><div><label for="gf-m">Monto mensual</label><input id="gf-m" name="monto" type="number" min="1" step="1000" required value="${g?.monto || ''}"></div>
        <div><label for="gf-d">Día de pago</label><input id="gf-d" name="dia_mes" type="number" min="1" max="31" value="${g?.dia_mes || ''}"></div></div>
        <label class="check"><input type="checkbox" name="activo"${!g || g.activo ? ' checked' : ''}><span>Activo</span></label>
        <button class="btn primary full mt">Guardar</button>${g ? '<button type="button" class="btn ghost danger-text full" data-del>Eliminar</button>' : ''}</form>`);
      $('#gff', m).addEventListener('submit', async ev => {
        ev.preventDefault(); const fd = PN.formData(ev.target);
        const row = { concepto: fd.concepto, monto: num(fd.monto), dia_mes: num(fd.dia_mes) || null, activo: !!fd.activo };
        await run(ev.target.querySelector('.primary'), () => QN.q(g ? sb.from('gastos_fijos').update(row).eq('id', g.id) : sb.from('gastos_fijos').insert(row)), 'Guardado').catch(() => {});
        closeModal(); PN.go('mas', { sub: 'fijos' });
      });
      m.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await ask('¿Eliminar este gasto fijo?', '', 'Sí, eliminar'))) return;
        await run(null, () => QN.q(sb.from('gastos_fijos').delete().eq('id', g.id))).catch(() => {});
        closeModal(); PN.go('mas', { sub: 'fijos' });
      });
    });
  };

  // ---------- Pagos a profesionales ----------
  SUBS.pagos = async el => {
    const [saldos, hist] = await Promise.all([QN.rpc('saldo_pros'), QN.q(sb.from('pagos_pro').select('*').order('creado', { ascending: false }).limit(50))]);
    el.innerHTML = `<p class="muted small">Saldo = comisiones + propinas − lo ya pagado (incluye adelantos). Las comisiones se calculan con el porcentaje de cada profesional al momento de cobrar.</p>
      ${saldos.map(s => `<section class="card"><h3>${esc(s.nombre)} <b class="${Number(s.saldo) > 0 ? 'warn-text' : ''}">${money(s.saldo)}</b></h3>
        <table class="tbl"><tr><td>Comisiones</td><td>${money(s.comisiones)}</td></tr><tr><td>Propinas</td><td>${money(s.propinas)}</td></tr><tr><td>Pagado</td><td>${money(s.pagado)}</td></tr></table>
        <button type="button" class="btn sm primary" data-pay="${s.profesional_id}" data-saldo="${s.saldo}">Registrar pago o adelanto</button></section>`).join('')}
      <h3 class="sec-title">Historial</h3>
      ${hist.map(h => `<div class="list-row${h.anulado ? ' void' : ''}"><span><b>${esc(PN.pro(h.profesional_id)?.nombre || '')} · ${h.tipo === 'adelanto' ? 'Adelanto' : 'Pago'}</b><small>${esc(fechaCorta(h.fecha))} · ${esc(metodoLbl(h.metodo))}${h.nota ? ' · ' + esc(h.nota) : ''}${h.anulado ? ' · anulado' : ''}</small></span><b>${money(h.monto)}</b>${h.anulado ? '' : `<button type="button" class="icon-btn" data-anu="${h.id}" aria-label="Anular pago">✕</button>`}</div>`).join('') || '<p class="muted">Sin pagos.</p>'}`;
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pay) {
        const m = modal('Pago a ' + (PN.pro(b.dataset.pay)?.nombre || ''), `<form id="ppf"><div class="grid2"><div><label for="pp-m">Monto</label><input id="pp-m" name="monto" type="number" min="1" step="100" required value="${Math.max(0, Math.round(Number(b.dataset.saldo)))}"></div>
          <div><label for="pp-t">Tipo</label><select id="pp-t" name="tipo">${opt('pago', 'Pago')}${opt('adelanto', 'Adelanto')}</select></div></div>
          <label for="pp-me">Método</label><select id="pp-me" name="metodo">${metodoOpts('efectivo')}</select>
          <label for="pp-n">Nota</label><input id="pp-n" name="nota" maxlength="120"><button class="btn primary full mt">Registrar</button></form>`);
        $('#ppf', m).addEventListener('submit', async ev => {
          ev.preventDefault(); const fd = PN.formData(ev.target);
          await run(ev.target.querySelector('button'), () => QN.rpc('pagar_profesional', { p_prof: b.dataset.pay, p_monto: num(fd.monto), p_tipo: fd.tipo, p_metodo: fd.metodo, p_nota: fd.nota || null }), 'Pago registrado').catch(() => {});
          closeModal(); PN.go('mas', { sub: 'pagos' });
        });
      } else if (b.dataset.anu) {
        if (!(await ask('¿Anular este pago?', 'El saldo de la profesional volverá a incluirlo.', 'Sí, anular'))) return;
        await run(b, () => QN.q(sb.from('pagos_pro').update({ anulado: true }).eq('id', b.dataset.anu)), 'Pago anulado').catch(() => {});
        PN.go('mas', { sub: 'pagos' });
      }
    });
  };

  // ---------- Configuración de reservas ----------
  SUBS.negocio = el => {
    const c = D.cfg;
    el.innerHTML = `<form id="cf">
      <label for="c-n">Nombre del negocio</label><input id="c-n" name="nombre" required maxlength="80" value="${esc(c.nombre || '')}">
      <label for="c-e">Eslogan</label><input id="c-e" name="eslogan" maxlength="120" value="${esc(c.eslogan || '')}">
      <label for="c-d">Dirección</label><input id="c-d" name="direccion" maxlength="120" value="${esc(c.direccion || '')}">
      <label for="c-w">WhatsApp del estudio</label><input id="c-w" name="whatsapp" type="tel" required value="${esc(telShow(c.whatsapp || ''))}">
      <label for="c-a">Aviso en la página de reservas <span class="muted">(opcional)</span></label><textarea id="c-a" name="aviso" rows="2" maxlength="300" placeholder="Ej.: Del 24 al 26 de diciembre no atendemos.">${esc(c.aviso || '')}</textarea>
      <div class="grid2"><div><label for="c-dr">Se puede reservar hasta (días)</label><input id="c-dr" name="dias_reserva" type="number" min="1" max="180" value="${c.dias_reserva}"></div>
      <div><label for="c-ma">Anticipación mínima (min)</label><input id="c-ma" name="min_anticipacion_min" type="number" min="0" max="2880" step="15" value="${c.min_anticipacion_min}"></div></div>
      <div class="grid2"><div><label for="c-hc">Cancelar/cambiar hasta (horas antes)</label><input id="c-hc" name="horas_cancelar" type="number" min="0" max="72" value="${c.horas_cancelar}"></div>
      <div><label for="c-mx">Máx. citas activas por celular</label><input id="c-mx" name="max_citas_telefono" type="number" min="1" max="20" value="${c.max_citas_telefono}"></div></div>
      <label class="check"><input type="checkbox" name="confirmacion_auto"${c.confirmacion_auto ? ' checked' : ''}><span>Confirmar automáticamente las reservas en línea (si no, quedan "por confirmar")</span></label>
      <p class="err" id="c-err"></p><button class="btn primary full mt">Guardar</button></form>`;
    $('#cf').addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      let w = fd.whatsapp.replace(/\D/g, ''); if (w.length === 10) w = '57' + w;
      if (w.length < 10) return void ($('#c-err').textContent = 'Revisa el número de WhatsApp.');
      const row = { nombre: fd.nombre, eslogan: fd.eslogan || null, direccion: fd.direccion || null, whatsapp: w, aviso: fd.aviso || null,
        dias_reserva: num(fd.dias_reserva), min_anticipacion_min: num(fd.min_anticipacion_min), horas_cancelar: num(fd.horas_cancelar),
        max_citas_telefono: num(fd.max_citas_telefono), confirmacion_auto: !!fd.confirmacion_auto, actualizado: new Date().toISOString() };
      try { await run(e.target.querySelector('button'), () => QN.q(sb.from('config_negocio').update(row).eq('id', 1)), 'Configuración guardada'); }
      catch (ex) { $('#c-err').textContent = ex.message; return; }
      reload('negocio');
    });
  };

  // ---------- Enlace y QR ----------
  SUBS.enlace = el => {
    const url = PN.bookingUrl();
    const texto = `💅 ¡Agenda tu cita en Queen Nails Studio! Elige tu servicio y horario aquí: ${url}`;
    el.innerHTML = `<section class="card center"><h3>Enlace de reservas</h3><p class="url-box">${esc(url)}</p>
      <div class="action-grid"><button type="button" class="btn primary" data-copy>📋 Copiar enlace</button>
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">📲 Compartir por WhatsApp</a>
      ${navigator.share ? '<button type="button" class="btn ghost" data-share>📤 Compartir…</button>' : ''}
      <a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">👀 Ver la página</a></div></section>
      <section class="card center"><h3>Código QR</h3><p class="muted small">Imprímelo y ponlo en el estudio o en tus tarjetas.</p><div id="qr" class="qr"></div>
      <button type="button" class="btn ghost" data-print>🖨️ Imprimir cartel</button></section>
      <p class="muted small">Tip: pon este enlace en la biografía de Instagram y en tu perfil de WhatsApp Business.</p>`;
    let qrImg = '';
    if (window.QRCode) {
      new QRCode($('#qr'), { text: url, width: 220, height: 220, colorDark: '#4e2535', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      setTimeout(() => { qrImg = $('#qr canvas')?.toDataURL() || $('#qr img')?.src || ''; }, 100);
    } else $('#qr').innerHTML = '<p class="muted">No se pudo cargar el generador de QR. Revisa tu conexión.</p>';
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.copy !== undefined) navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'), () => toast(url));
      else if (b.dataset.share !== undefined) navigator.share({ title: 'Queen Nails Studio', text: texto, url }).catch(() => {});
      else if (b.dataset.print !== undefined) PN.printHtml(`<div class="poster"><img src="assets/logo.jpg" alt="" width="220" height="220"><h1>Agenda tu cita</h1><p>Escanea el código con la cámara de tu celular</p>${qrImg ? `<img src="${qrImg}" width="300" height="300" alt="Código QR">` : ''}<p class="url">${esc(url)}</p></div>`);
    });
  };

  // ---------- PIN ----------
  SUBS.pin = el => {
    el.innerHTML = `<section class="card"><p>${D.hasPin ? '✅ Tienes un PIN activo. Se pide al entrar a Reportes, Pagos, Configuración, Respaldo y Liberar espacio (una vez por sesión).' : 'Con un PIN de 4 a 6 números proteges las secciones sensibles si alguien más usa tu celular o computador.'}</p>
      <form id="pinf">${D.hasPin ? '<label for="pa">PIN actual</label><input id="pa" name="actual" type="password" inputmode="numeric" maxlength="6" required>' : ''}
      <label for="pn1">${D.hasPin ? 'Nuevo PIN' : 'PIN'}</label><input id="pn1" name="nuevo" type="password" inputmode="numeric" maxlength="6" pattern="\\d{4,6}" required>
      <label for="pn2">Repite el PIN</label><input id="pn2" name="rep" type="password" inputmode="numeric" maxlength="6" required>
      <p class="err" id="pin-err"></p><button class="btn primary full mt">${D.hasPin ? 'Cambiar PIN' : 'Activar PIN'}</button></form>
      ${D.hasPin ? '<form id="pinq" class="mt"><label for="pq1">Para quitar el PIN escribe el actual</label><div class="inline"><input id="pq1" name="actual" type="password" inputmode="numeric" maxlength="6" required><button class="btn ghost danger-text">Quitar PIN</button></div></form>' : ''}</section>`;
    $('#pinf').addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      if (fd.nuevo !== fd.rep) return void ($('#pin-err').textContent = 'Los PIN no coinciden.');
      try { await run(e.target.querySelector('button'), () => QN.rpc('pin_guardar', { p_nuevo: fd.nuevo, p_actual: fd.actual || null }), 'PIN guardado'); }
      catch (ex) { $('#pin-err').textContent = ex.message; return; }
      try { sessionStorage.setItem('qn-pin', '1'); } catch { /* */ }
      reload('pin');
    });
    $('#pinq')?.addEventListener('submit', async e => {
      e.preventDefault();
      try { await run(e.target.querySelector('button'), () => QN.rpc('pin_quitar', { p_actual: PN.formData(e.target).actual }), 'PIN eliminado'); } catch { return; }
      reload('pin');
    });
  };

  SUBS.clave = el => {
    el.innerHTML = `<form id="kf" class="card"><label for="k1">Nueva contraseña</label><input id="k1" name="a" type="password" minlength="8" required autocomplete="new-password">
      <label for="k2">Repite la contraseña</label><input id="k2" name="b" type="password" minlength="8" required autocomplete="new-password">
      <p class="err" id="k-e"></p><button class="btn primary full mt">Cambiar contraseña</button></form>`;
    $('#kf').addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      if (fd.a !== fd.b) return void ($('#k-e').textContent = 'Las contraseñas no coinciden.');
      try { await run(e.target.querySelector('button'), async () => { const { error } = await sb.auth.updateUser({ password: fd.a }); if (error) throw new Error(error.message); }, 'Contraseña actualizada'); }
      catch (ex) { $('#k-e').textContent = ex.message; return; }
      e.target.reset();
    });
  };

  SUBS.notif = el => {
    const ok = 'Notification' in window;
    const st = ok ? Notification.permission : 'no';
    el.innerHTML = `<section class="card"><p>Cuando una clienta reserva en línea, el panel muestra un aviso con sonido${ok ? ' y una notificación del sistema' : ''} mientras la agenda esté abierta (también instalada como app).</p>
      <p><b>Estado:</b> ${st === 'granted' ? '✅ Activadas' : st === 'denied' ? '⛔ Bloqueadas en este navegador (actívalas en los ajustes del sitio)' : st === 'no' ? 'Este navegador no las permite' : 'Sin activar'}</p>
      ${ok && st === 'default' ? '<button type="button" class="btn primary full" data-on>Activar notificaciones</button>' : ''}
      <p class="muted small">Consejo: deja la agenda abierta en el computador o el celular del estudio. Las reservas también se ven en la pestaña "Por confirmar".</p></section>`;
    el.querySelector('[data-on]')?.addEventListener('click', async () => { await Notification.requestPermission(); PN.go('mas', { sub: 'notif' }); });
  };

  SUBS.app = el => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    el.innerHTML = `<section class="card">${standalone ? '<p>✅ Ya estás usando la agenda como app.</p>' : installEvt ? '<p>Instala la agenda para abrirla como una app desde tu pantalla de inicio.</p><button type="button" class="btn primary full" data-inst>📲 Instalar app</button>'
      : ios ? '<p>En iPhone: toca el botón <b>Compartir</b> (□↑) en Safari y luego <b>"Agregar a pantalla de inicio"</b>.</p>'
        : '<p>En Android (Chrome): abre el menú <b>⋮</b> y toca <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b>.</p>'}</section>`;
    el.querySelector('[data-inst]')?.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; PN.go('mas', { sub: 'app' }); });
  };

  // ---------- Respaldo ----------
  const TABLAS = ['servicios', 'profesionales', 'profesional_servicio', 'horarios', 'bloqueos', 'clientes', 'citas', 'cita_servicios', 'registros_tecnicos',
    'productos', 'stock_movs', 'ventas', 'venta_items', 'venta_pagos', 'abonos', 'gastos', 'gastos_fijos', 'cajas', 'pagos_pro'];
  SUBS.respaldo = el => {
    el.innerHTML = `<section class="card"><p>Descarga una copia completa de tus datos (citas, clientas, ventas, inventario…). Guárdala en tu correo o en Google Drive.</p>
      <p class="muted small">Recomendado: una vez por semana. El plan gratuito de Supabase no guarda copias automáticas.</p>
      <button type="button" class="btn primary full" data-json>💾 Descargar respaldo completo (JSON)</button>
      <button type="button" class="btn ghost full" data-csv>⬇️ Descargar clientas (CSV para Excel)</button></section>`;
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.json !== undefined) await run(b, async () => {
        const out = { generado: new Date().toISOString(), negocio: D.cfg };
        for (const t of TABLAS) {
          out[t] = [];
          for (let i = 0; ; i += 1000) {
            const rows = await QN.q(sb.from(t).select('*').range(i, i + 999));
            out[t].push(...rows); if (rows.length < 1000) break;
          }
        }
        PN.downloadFile(`respaldo-queen-nails-${hoy()}.json`, JSON.stringify(out, null, 1), 'application/json');
      }, 'Respaldo descargado').catch(() => {});
      if (b.dataset.csv !== undefined) await run(b, async () => {
        const list = await QN.rpc('clientes_resumen');
        PN.downloadFile(`clientas-${hoy()}.csv`, PN.csv([['Nombre', 'Celular', 'Cumpleaños', 'Visitas', 'Última visita', 'Total gastado', 'Notas'],
          ...list.map(c => [c.nombre, telShow(c.telefono), c.cumpleanos || '', c.visitas, c.ultima || '', c.gastado, c.notas || ''])]), 'text/csv;charset=utf-8');
      }).catch(() => {});
    });
  };

  SUBS.limpieza = el => {
    el.innerHTML = `<form id="lf" class="card"><p>Borra las citas <b>canceladas</b> y de <b>no asistió</b> anteriores a la fecha elegida, y el historial de movimientos de inventario. Las ventas, clientas y citas atendidas no se borran.</p>
      <label for="l-f">Borrar anteriores a</label><input id="l-f" name="f" type="date" required max="${addDays(hoy(), -30)}" value="${addDays(hoy(), -365)}">
      <p class="muted small">Descarga un respaldo antes.</p><button class="btn danger full mt">🧹 Liberar espacio</button></form>`;
    $('#lf').addEventListener('submit', async e => {
      e.preventDefault(); const f = PN.formData(e.target).f;
      if (!(await ask('¿Borrar datos antiguos?', `Citas canceladas y movimientos de inventario anteriores al ${esc(fechaLarga(f))}. No se puede deshacer.`, 'Sí, borrar'))) return;
      try { const r = await run(e.target.querySelector('button'), () => QN.rpc('limpieza', { p_antes: f })); toast(`Listo: ${r.citas} citas y ${r.movimientos} movimientos borrados`); } catch { /* aviso mostrado */ }
    });
  };

  SUBS.salir = async () => {
    if (!(await ask('¿Cerrar sesión?', 'Tendrás que volver a escribir tu correo y contraseña.', 'Cerrar sesión', false))) return PN.go('mas');
    try { sessionStorage.removeItem('qn-pin'); } catch { /* */ }
    await sb.auth.signOut();
    location.reload();
  };

  const mod = { title: 'Más', tab: 'mas', show, editBloqueo };
  PN.register('mas', mod);
  return mod;
})();

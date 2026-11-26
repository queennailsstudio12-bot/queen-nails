// Panel · inicio de sesión y arranque.
(() => {
  const { $, sb, toast } = PN;
  const { esc } = QN;
  const login = $('#login'), shell = $('#shell');

  const card = inner => `<div class="login-card"><img src="assets/logo.jpg" alt="Queen Nails Studio" width="110" height="110"><h1>Agenda</h1>${inner}</div>`;

  function showSetup() {
    login.hidden = false;
    login.innerHTML = card(`<p>Falta conectar la base de datos.</p><p class="muted small">Edita <code>config.js</code> con la URL y la clave pública de tu proyecto de Supabase (ver README).</p>`);
  }

  function showLogin(msg = '') {
    shell.hidden = true; login.hidden = false;
    login.innerHTML = card(`<form id="lg">
      <label for="lg-e">Correo</label><input id="lg-e" name="e" type="email" autocomplete="username" required>
      <label for="lg-p">Contraseña</label><input id="lg-p" name="p" type="password" autocomplete="current-password" required>
      <p class="err" id="lg-err">${esc(msg)}</p>
      <button class="btn primary full">Entrar</button>
      <button type="button" class="link" id="lg-forgot">Olvidé mi contraseña</button></form>`);
    $('#lg').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target), btn = e.target.querySelector('.primary');
      btn.disabled = true; btn.textContent = 'Entrando…';
      const { error } = await sb.auth.signInWithPassword({ email: fd.get('e').trim(), password: fd.get('p') });
      btn.disabled = false; btn.textContent = 'Entrar';
      if (error) { $('#lg-err').textContent = /invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message; return; }
      start();
    });
    $('#lg-forgot').addEventListener('click', async () => {
      const email = $('#lg-e').value.trim();
      if (!email) { $('#lg-err').textContent = 'Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".'; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
      $('#lg-err').textContent = error ? error.message : 'Te enviamos un correo para crear una nueva contraseña.';
    });
  }

  function showNewPassword() {
    shell.hidden = true; login.hidden = false;
    login.innerHTML = card(`<form id="np"><p>Crea tu nueva contraseña.</p>
      <label for="np-1">Nueva contraseña</label><input id="np-1" name="a" type="password" minlength="8" required autocomplete="new-password">
      <label for="np-2">Repítela</label><input id="np-2" name="b" type="password" minlength="8" required autocomplete="new-password">
      <p class="err" id="np-e"></p><button class="btn primary full">Guardar</button></form>`);
    $('#np').addEventListener('submit', async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      if (fd.get('a') !== fd.get('b')) { $('#np-e').textContent = 'No coinciden.'; return; }
      const { error } = await sb.auth.updateUser({ password: fd.get('a') });
      if (error) { $('#np-e').textContent = error.message; return; }
      history.replaceState(null, '', location.pathname);
      start();
    });
  }

  let started = false;
  async function start() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return showLogin();
    let rol;
    try { rol = await QN.rpc('mi_rol'); } catch (e) { return showLogin(e.message); }
    if (rol !== 'dueno') {
      await sb.auth.signOut();
      return showLogin('Esta cuenta no tiene acceso al panel.');
    }
    try { await PN.loadBase(); } catch (e) { return showLogin(e.message); }
    login.hidden = true; shell.hidden = false;
    if (!started) {
      started = true;
      $('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) PN.go(b.dataset.view); });
      $('#btn-new').addEventListener('click', () => window.PN_Agenda.nuevaCita({ fecha: QN.hoy() }));
      $('#btn-refresh').addEventListener('click', async () => { await PN.loadBase().catch(() => {}); PN.refresh(); toast('Actualizado'); });
      window.PN_Agenda.realtime();
      // Al volver a la app después de un rato, refrescar la agenda
      let hiddenAt = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) hiddenAt = Date.now();
        else if (Date.now() - hiddenAt > 60000 && ['agenda', 'inicio'].includes(PN.current()) && $('#modal').hidden) PN.refresh();
      });
    }
    PN.go('inicio');
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!QN.configured) return showSetup();
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') showNewPassword(); if (ev === 'SIGNED_OUT') showLogin(); });
  if (/type=recovery/.test(location.hash)) return; // onAuthStateChange mostrará el formulario
  start();

})();

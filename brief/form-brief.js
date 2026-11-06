/*
  form-brief.js · formulario de contacto de hammockai.site (ES y EN, mismo archivo)
  ---------------------------------------------------------------------------
  QUE HACE
  - Paso 1 (basico) siempre visible. Al final: "¿Quieres contarnos un poco mas?"
    -> Si: muestra el paso 2 (5 preguntas cortas) / No: envia lo que hay.
  - Envia con POST (fetch) al script A1 (Google Apps Script), SIN abrir la app de correo.
  - Si A1 responde ok: dialogo modal con la confirmacion y "Volver al inicio"; al cerrarlo
    (X o Esc) el formulario queda limpio. Los errores siguen saliendo en la pagina.
  - Si el endpoint no esta configurado, lo dice con honestidad y muestra el correo de
    respaldo como texto (no abre ningun mailto).

  PARA ACTIVARLO (una sola linea): pegar abajo la URL /exec del despliegue del script A1.
  La misma URL debe estar en la CSP de _headers (connect-src y form-action).
*/
(function () {
  'use strict';

  // ---- CONFIGURACION --------------------------------------------------------
  // URL real del despliegue A1 v1.2 (2026-11-06).
  const A1_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxYgWZgNeL4zvHWgcj0bN9R_JaY71e82s551kqfpGX1Xqqym8x3l7HGmSTlajaNU1FQBQ/exec';
  const CORREO = 'hammockai@proton.me'; // correo de respaldo (se muestra como texto)
  // ---------------------------------------------------------------------------

  const configurado = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(A1_ENDPOINT);

  const form = document.getElementById('contacto');
  if (!form) return;
  const estado = document.getElementById('estado');
  const paso2 = document.getElementById('paso2');
  const pregunta = document.getElementById('mas');
  const btnSi = document.getElementById('btn-si');
  const campoPaso = form.elements.namedItem('paso');
  const idioma = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';

  const T = {
    es: {
      enviando: 'Enviando…',
      nombre: 'Escribe tu nombre.',
      correo: 'Escribe tu correo, así podemos responderte.',
      correoMal: 'Ese correo no parece válido. Revisa que tenga @ y un dominio, por ejemplo nombre@correo.com.',
      negocio: 'Cuéntanos en pocas palabras de qué se trata tu negocio.',
      revisa: 'Falta algo o hay un dato por corregir. Revisa lo marcado.',
      sinEndpoint: 'El envío directo todavía no está activo, así que no se envió nada. Escríbenos a ' + CORREO + ' y te respondemos.',
      ok: function (n) { return 'Gracias, ' + n + '. Te escribimos dentro de 1 día hábil.'; },
      // Textos del dialogo (finales, 2026-11-06).
      dlgTitulo: function (n) { return '¡Gracias, ' + n + '!'; },
      dlgPlazo: 'Te escribimos dentro de 1 día hábil.',
      dlgCalido: 'Mientras tanto, acomódate en la hamaca y recorre el sitio.',
      inicio: '/es/',
      volver: 'Volver al inicio',
      cerrar: 'Cerrar',
      limite: 'Llegaron muchas consultas en poco tiempo. Intenta en un rato o escríbenos a ' + CORREO + '.',
      pausado: 'El formulario está en pausa. Escríbenos a ' + CORREO + '.',
      largo: 'Alguno de tus textos es demasiado largo. Acórtalo un poco.',
      error: 'No pudimos guardar tu mensaje. Escríbenos a ' + CORREO + '.',
      incierto: 'No pudimos confirmar si tu mensaje llegó. Para asegurarte, escríbenos a ' + CORREO + '.'
    },
    en: {
      enviando: 'Sending…',
      nombre: 'Please enter your name.',
      correo: 'Please enter your email so we can reply.',
      correoMal: 'That email does not look valid. Check it has an @ and a domain, for example name@mail.com.',
      negocio: 'Tell us in a few words what your business is about.',
      revisa: 'Something is missing or needs fixing. Please check the marked fields.',
      sinEndpoint: 'Direct sending is not active yet, so nothing was sent. Write to us at ' + CORREO + ' and we will reply.',
      ok: function (n) { return 'Thank you, ' + n + '. We will write to you within 1 business day.'; },
      // Dialog copy (final, 2026-11-06).
      dlgTitulo: function (n) { return 'Thank you, ' + n + '!'; },
      dlgPlazo: "We'll write to you within 1 business day.",
      dlgCalido: 'Meanwhile, settle into the hammock and look around the site.',
      inicio: '/',
      volver: 'Back to home',
      cerrar: 'Close',
      limite: 'We received many messages in a short time. Try again in a while or write to us at ' + CORREO + '.',
      pausado: 'The form is paused. Please write to us at ' + CORREO + '.',
      largo: 'One of your texts is too long. Please shorten it a little.',
      error: 'We could not save your message. Please write to us at ' + CORREO + '.',
      incierto: 'We could not confirm that your message arrived. To be sure, write to us at ' + CORREO + '.'
    }
  }[idioma];

  // Con JavaScript el paso 2 empieza oculto; sin JavaScript queda todo visible.
  paso2.hidden = true;
  pregunta.hidden = false;

  function mostrar(texto, esError) {
    estado.textContent = texto;
    estado.classList.toggle('es-error', Boolean(esError));
  }
  function limpiarErrores() {
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
  }
  function marcar(id, msg) {
    const campo = document.getElementById(id);
    const err = document.getElementById(id + '-err');
    campo.setAttribute('aria-invalid', 'true');
    if (err) err.textContent = msg;
    return campo;
  }
  const correoValido = function (c) { return /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(c); };

  // Devuelve el primer campo con problema (ya marcado) o null.
  function revisar() {
    limpiarErrores();
    const v = function (n) { return String(form.elements.namedItem(n).value || '').trim(); };
    const fallos = [];
    if (!v('nombre')) fallos.push(marcar('c-nombre', T.nombre));
    if (!v('correo')) fallos.push(marcar('c-correo', T.correo));
    else if (!correoValido(v('correo'))) fallos.push(marcar('c-correo', T.correoMal));
    if (!v('negocio')) fallos.push(marcar('c-negocio', T.negocio));
    return fallos.length ? fallos[0] : null;
  }

  btnSi.addEventListener('click', function () {
    paso2.hidden = false;
    pregunta.hidden = true;
    campoPaso.value = '2';
    document.getElementById('paso2-titulo').focus();
  });

  function bloquear(si) {
    form.querySelectorAll('[type="submit"], #btn-si').forEach(function (b) { b.disabled = si; });
  }

  // Confirmacion en un dialogo modal con un boton "Volver al inicio". Cerrarlo (Esc o la X)
  // deja el formulario limpio y el aviso en la pagina. Sin soporte de <dialog>: solo el
  // aviso en la pagina, como antes.
  function confirmar(nombre) {
    const hecho = document.getElementById('hecho');
    hecho.textContent = T.ok(nombre);
    hecho.hidden = false;
    const dlg = document.createElement('dialog');
    if (typeof dlg.showModal !== 'function') { form.hidden = true; hecho.focus(); return; }
    // Formulario limpio: vuelve al paso 1, sin errores ni estado.
    form.reset();
    limpiarErrores();
    mostrar('', false);
    paso2.hidden = true;
    pregunta.hidden = false;
    campoPaso.value = '1';

    dlg.className = 'dlg';
    dlg.setAttribute('aria-labelledby', 'dlg-t');
    dlg.setAttribute('aria-describedby', 'dlg-d');
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dlg-x';
    x.setAttribute('aria-label', T.cerrar);
    x.textContent = '×';
    const titulo = document.createElement('h2');
    titulo.id = 'dlg-t';
    titulo.className = 'dlg-t';
    titulo.tabIndex = -1;
    titulo.textContent = T.dlgTitulo(nombre);
    const logo = document.createElement('img');
    logo.className = 'dlg-logo';
    logo.src = '/assets/images/logo.svg';
    logo.alt = ''; // decorativo: el nombre ya esta en el texto
    logo.width = 72;
    logo.height = 64;
    const texto = document.createElement('div');
    texto.id = 'dlg-d';
    [T.dlgPlazo, T.dlgCalido].forEach(function (s, i) {
      const p = document.createElement('p');
      p.className = i ? 'dlg-calido' : 'dlg-plazo';
      p.textContent = s;
      texto.append(p);
    });
    const volver = document.createElement('a');
    volver.className = 'boton';
    volver.href = T.inicio;
    volver.textContent = T.volver;
    dlg.append(x, logo, titulo, texto, volver);
    document.body.append(dlg);
    // Se limpia en el momento (sin esperar el evento close, que llega despues).
    let cerrado = false;
    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      if (dlg.open) dlg.close();
      dlg.remove();
      hecho.focus();
    }
    x.addEventListener('click', cerrar);
    dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrar(); }); // Esc
    dlg.addEventListener('close', cerrar);
    dlg.showModal();
    titulo.focus();
  }

  let enviando = false;
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (enviando) return;
    const primero = revisar();
    if (primero) {
      mostrar(T.revisa, true);
      primero.focus();
      return;
    }
    if (!configurado) {
      // Honesto: no se envio nada. No se abre ningun mailto.
      mostrar(T.sinEndpoint, true);
      return;
    }
    // Lo escrito en el paso 2 solo viaja si el paso 2 esta abierto.
    const datos = new URLSearchParams();
    new FormData(form).forEach(function (valor, clave) {
      if (paso2.hidden && paso2.querySelector('[name="' + clave + '"]')) return;
      datos.append(clave, String(valor));
    });
    datos.set('idioma', idioma);
    datos.set('modo', 'js');

    const nombre = String(form.elements.namedItem('nombre').value).trim();
    enviando = true;
    bloquear(true);
    mostrar(T.enviando, false);

    const control = ('AbortController' in window) ? new AbortController() : null;
    const reloj = control ? setTimeout(function () { control.abort(); }, 20000) : null;

    fetch(A1_ENDPOINT, {
      method: 'POST',
      body: datos, // x-www-form-urlencoded: no dispara consulta previa (preflight)
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      signal: control ? control.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (j && j.ok === true) {
          confirmar(nombre);
        } else {
          const c = j && j.codigo;
          mostrar(c === 'limite' ? T.limite : c === 'pausado' ? T.pausado :
            (c === 'mensaje_largo' || c === 'texto_largo') ? T.largo : T.error, true);
        }
      })
      .catch(function () { mostrar(T.incierto, true); })
      .finally(function () {
        if (reloj) clearTimeout(reloj);
        enviando = false;
        bloquear(false);
      });
  });
})();

/*
  main.js · Plantilla base Hammock AI (el mismo archivo va en cada demo)
  ---------------------------------------------------------------------------
  POR QUÉ EXISTE
  HTML y CSS no pueden, solos, abrir y cerrar el menú del celular avisando
  su estado a los lectores de pantalla (aria-expanded), ni escribir el año
  actual en el pie. Este archivo hace SOLO esas dos cosas, sin librerías.

  CÓMO SE CARGA
  En el <head> con <script src="main.js" defer>. "defer" descarga el archivo
  sin frenar la página y lo ejecuta cuando el HTML ya está leído, así que
  aquí todos los elementos ya existen.

  SEGURIDAD
  En el HTML no hay JavaScript escrito en línea ni atributos onclick: todo
  se conecta desde aquí con addEventListener. Por eso la política de
  seguridad (CSP) puede bloquear cualquier script que no sea este archivo.

  SI JAVASCRIPT FALLA
  El sitio sigue funcionando: los enlaces del pie llevan a todas las
  secciones, y el año del pie ya viene escrito en el HTML.
*/
(function () {
  'use strict';

  // 1) Menú del celular ---------------------------------------------------
  // El botón dice si el menú está abierto con aria-expanded="true|false".
  // El CSS lee ese mismo atributo para mostrar u ocultar el menú, así que
  // aquí solo se cambia el atributo: una sola fuente de verdad.
  const boton = document.querySelector('.boton-menu');
  const menu = document.getElementById('menu-principal');

  if (boton && menu) {
    const estaAbierto = () => boton.getAttribute('aria-expanded') === 'true';

    const abrir = () => {
      boton.setAttribute('aria-expanded', 'true');
    };

    const cerrar = (devolverFoco) => {
      boton.setAttribute('aria-expanded', 'false');
      if (devolverFoco) boton.focus(); // el teclado vuelve al botón
    };

    boton.addEventListener('click', () => {
      if (estaAbierto()) {
        cerrar(false);
      } else {
        abrir();
      }
    });

    // Al tocar un enlace del menú, se cierra y la página baja a la sección.
    menu.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) cerrar(false);
    });

    // La tecla Escape cierra el menú (lo esperan quienes usan teclado).
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && estaAbierto()) cerrar(true);
    });
  }

  // 2) Año del pie ---------------------------------------------------------
  // Cualquier elemento con el atributo data-anio recibe el año actual.
  const anio = String(new Date().getFullYear());
  document.querySelectorAll('[data-anio]').forEach((elemento) => {
    elemento.textContent = anio;
  });
})();

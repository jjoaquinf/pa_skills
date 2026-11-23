/*
 * live-review: señalar problemas de una página web sobre la propia página.
 *
 * Se inyecta en la aplicación en desarrollo (skill live-review). Pulsar «Señalar» (o
 * ⌥S) y hacer clic en un elemento, o arrastrar para marcar una zona; se escribe la
 * nota y queda una chincheta numerada. Las notas se guardan en localStorage del origen.
 *
 * window.__liveReview.notas() las da con la ruta, la ventana, el componente que
 * declara el elemento (Angular, React, Vue o Svelte en modo de desarrollo, con su
 * fichero y su línea si el framework los da), un selector, la caja y los estilos.
 * No cambia la aplicación: solo la observa.
 */
(() => {
  'use strict';
  if (window.__liveReview) return;

  const CLAVE = 'live-review.notas.v1';
  const CLAVE_PREFS = 'live-review.prefs.v1';
  const PROPIEDADES = [
    'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'max-width',
    'min-height', 'margin', 'padding', 'border', 'border-radius', 'font-family',
    'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
    'background-color', 'text-align', 'vertical-align', 'white-space', 'overflow',
    'text-overflow', 'flex', 'flex-direction', 'flex-wrap', 'justify-content',
    'align-items', 'align-self', 'gap', 'grid-template-columns', 'z-index', 'opacity',
    'box-shadow',
  ];
  const DE_CAJA = new Set(['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns']);
  const POR_OMISION = new Set([
    'none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', 'visible', 'static', 'start',
    'baseline',
  ]);

  const CSS = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    button { font: inherit; cursor: pointer; }
    .resalte { position: fixed; display: none; pointer-events: none; outline: 2px solid #d81b60; outline-offset: -1px; background: rgba(216, 27, 96, .10); }
    .etiqueta { position: fixed; display: none; pointer-events: none; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 6px; border-radius: 3px; background: #d81b60; color: #fff; font-size: 11px; line-height: 15px; }
    .marco { position: fixed; display: none; pointer-events: none; border: 2px dashed #d81b60; background: rgba(216, 27, 96, .12); }
    .chincheta { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border: 2px solid #fff; border-radius: 50%; background: #d81b60; color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; cursor: pointer; box-shadow: 0 1px 4px rgba(0, 0, 0, .45); }
    .chincheta:hover { transform: scale(1.15); }
    .chincheta.resuelta, .num.resuelta { background: #90a4ae; }
    .nota.resuelta .texto { color: #90a4ae; text-decoration: line-through; }
    .barra { position: fixed; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 20px; background: #263238; box-shadow: 0 2px 10px rgba(0, 0, 0, .35); cursor: default; }
    .barra button { padding: 6px 12px; border: 0; border-radius: 16px; background: transparent; color: #eceff1; font-size: 13px; }
    .barra button:hover { background: rgba(255, 255, 255, .14); }
    .barra button.activo { background: #d81b60; color: #fff; }
    .ayuda { padding: 0 8px; color: #b0bec5; font-size: 12px; white-space: nowrap; }
    .panel { position: fixed; right: 16px; bottom: 64px; width: 400px; max-width: calc(100vw - 32px); max-height: 60vh; overflow: auto; border-radius: 8px; background: #fff; color: #212121; box-shadow: 0 6px 24px rgba(0, 0, 0, .35); font-size: 13px; cursor: default; }
    .izquierda .barra { right: auto; left: 16px; }
    .izquierda .panel { right: auto; left: 16px; }
    .cab-panel { position: sticky; top: 0; display: flex; gap: 6px; align-items: center; padding: 8px 10px; background: #eceff1; }
    .cab-panel span { flex: 1; }
    .ruta { padding: 8px 10px 2px; color: #607d8b; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
    .nota { display: flex; gap: 8px; align-items: flex-start; padding: 6px 10px; border-bottom: 1px solid #eceff1; }
    .num { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #d81b60; color: #fff; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
    .cuerpo { flex: 1; min-width: 0; }
    .texto { white-space: pre-wrap; word-break: break-word; }
    .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #90a4ae; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
    .ops { display: flex; flex-direction: column; gap: 4px; }
    .vacio { padding: 16px; color: #607d8b; }
    .editor { position: fixed; width: 340px; max-width: calc(100vw - 16px); padding: 10px 12px 8px; border-top: 4px solid #d81b60; border-radius: 6px; background: #fff; color: #212121; box-shadow: 0 6px 24px rgba(0, 0, 0, .35); font-size: 13px; cursor: default; }
    .cab { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
    .desc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #607d8b; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
    .nivel { display: flex; gap: 4px; margin-bottom: 6px; }
    textarea { display: block; width: 100%; min-height: 84px; resize: vertical; padding: 6px 8px; border: 1px solid #b0bec5; border-radius: 4px; color: #212121; background: #fff; font-size: 13px; line-height: 1.4; cursor: text; user-select: text; }
    textarea:focus { outline: 2px solid #d81b60; outline-offset: -1px; border-color: transparent; }
    .acciones { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
    .acciones span { flex: 1; }
    .editor button, .panel button { padding: 4px 10px; border: 1px solid #cfd8dc; border-radius: 4px; background: #fff; color: #37474f; font-size: 12px; }
    .editor button:disabled { opacity: .4; cursor: default; }
    .editor .primario { border-color: #d81b60; background: #d81b60; color: #fff; }
    .peligro { color: #c62828 !important; }
    .pista { margin-top: 6px; color: #90a4ae; font-size: 11px; }
  `;

  let notas = cargar(CLAVE, []);
  if (!Array.isArray(notas)) notas = [];
  const prefs = Object.assign({ lado: 'derecha', ver: true }, cargar(CLAVE_PREFS, {}));
  let activo = false;
  let editor = null;
  let arrastre = null;
  let destello = null;
  let programado = false;
  let hayDebugInfo = null;
  let abiertos = 0;
  const chinchetas = new Map();
  let host, raiz, resalte, etiqueta, marco, capa, ui, barra, ayuda, panel, cajaEditor;
  let btnSenalar, btnNotas, btnVer;

  // ---------------------------------------------------------------- almacén

  function cargar(clave, porOmision) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : porOmision;
    } catch {
      return porOmision;
    }
  }

  function escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* sin almacén: las notas viven mientras no se recargue */
    }
  }

  function guardar() {
    escribir(CLAVE, notas);
    pintarBarra();
    pintarLista();
    pintarChinchetas();
  }

  function siguiente() {
    return notas.reduce((m, x) => Math.max(m, x.n), 0) + 1;
  }

  // ---------------------------------------------------------- qué es cada cosa

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /** La pantalla en la que se está: el camino y el hash (las aplicaciones con rutas en el hash). */
  function rutaActual() {
    return location.pathname + location.search + location.hash;
  }

  /** Una ruta sin su consulta, para comparar pantallas. */
  function rutaDe(ruta) {
    return String(ruta || '/').replace(/\?[^#]*/g, '');
  }

  /** Lleva a una ruta guardada: con el hash si solo cambia el hash, y si no con el historial. */
  function navegar(ruta) {
    const destino = new URL(ruta, location.origin);
    if (destino.pathname === location.pathname && destino.search === location.search) {
      location.hash = destino.hash;
      return;
    }
    history.pushState(history.state, '', destino.pathname + destino.search + destino.hash);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  function describir(el) {
    if (!el || !el.localName) return '?';
    let s = el.localName;
    if (el.id) s += '#' + el.id;
    const clases = [...el.classList]
      .filter((c) => !/^(ng-|cdk-|mat-mdc-focus|mdc-ripple|mat-ripple)/.test(c))
      .slice(0, 3);
    if (clases.length) s += '.' + clases.join('.');
    return s;
  }

  // Lo que no es texto para quien lee: los iconos que se pintan con ligaduras (el nombre del
  // icono va como texto: «expand_more»), lo oculto a los lectores de pantalla y lo que no se pinta.
  const SIN_TEXTO =
    'mat-icon, .material-icons, .material-icons-outlined, .material-symbols-outlined, ' +
    '.material-symbols-rounded, .material-symbols-sharp, [aria-hidden="true"], svg, script, style, template';

  /**
   * Si entre dos trozos de texto (los elementos a y b que los contienen) hay un límite que no es
   * en línea: una celda, un bloque, un elemento de un flex. Se mira todo el camino hasta su
   * antepasado común, porque dos celdas suelen pintar su texto en un span en línea cada una.
   */
  function separados(a, b) {
    const deA = [];
    for (let n = a; n; n = n.parentElement) deA.push(n);
    let comun = b;
    while (comun && !deA.includes(comun)) comun = comun.parentElement;
    const corta = (n) => {
      try {
        return getComputedStyle(n).display !== 'inline';
      } catch {
        return true;
      }
    };
    for (const inicio of [a, b]) {
      for (let n = inicio; n && n !== comun; n = n.parentElement) if (corta(n)) return true;
    }
    return false;
  }

  /**
   * El texto que se lee en el elemento: sin los nombres de los iconos y con un espacio entre
   * celdas, bloques o elementos de un flex (textContent los pegaba: «fact_checkSolicitudesexpand_more»).
   * Si el elemento señalado es él mismo un icono, su texto sí cuenta.
   */
  function textoDe(el, max = 100) {
    const trozos = [];
    let largo = 0;
    let anterior = null;
    const paseo = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = paseo.nextNode(); n && largo < max * 2; n = paseo.nextNode()) {
      const padre = n.parentElement;
      const fuera = padre && padre.closest(SIN_TEXTO);
      if (fuera && fuera !== el && el.contains(fuera)) continue;
      const t = n.nodeValue.replace(/\s+/g, ' ');
      if (!t.trim()) {
        if (trozos.length) trozos.push(' ');
        continue;
      }
      if (anterior && padre !== anterior && separados(anterior, padre)) trozos.push(' ');
      trozos.push(t);
      largo += t.length;
      anterior = padre;
    }
    return trozos.join('').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function selector(el) {
    const partes = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.id && /^[A-Za-z][\w-]*$/.test(n.id) && !/\d/.test(n.id) && document.querySelectorAll('#' + n.id).length === 1) {
        partes.unshift('#' + n.id);
        return partes.join(' > ');
      }
      let parte = n.localName.replace(/:/g, '\\:');
      const padre = n.parentElement;
      if (padre) {
        const iguales = [...padre.children].filter((h) => h.localName === n.localName);
        if (iguales.length > 1) parte += `:nth-of-type(${iguales.indexOf(n) + 1})`;
      }
      partes.unshift(parte);
    }
    return 'body > ' + partes.join(' > ');
  }

  function estilosDe(el) {
    const cs = getComputedStyle(el);
    const esCaja = /flex|grid/.test(cs.display);
    const r = {};
    for (const p of PROPIEDADES) {
      if (!esCaja && DE_CAJA.has(p)) continue;
      const v = cs.getPropertyValue(p);
      if (!v || POR_OMISION.has(v)) continue;
      if ((p === 'opacity' && v === '1') || (p === 'flex' && v === '0 1 auto') || (p === 'border' && v.startsWith('0px'))) continue;
      r[p] = v;
    }
    return r;
  }

  // ------------------------------------------------- de qué componente es cada cosa
  //
  // Para el elemento señalado se busca, en modo de desarrollo, el componente cuya
  // plantilla lo declara (la que hay que tocar), con su fichero y su línea si el
  // framework los da, y la cadena de componentes que lo contienen. Se salta lo que es
  // de una librería (node_modules) hasta llegar a un componente de la aplicación. Sin
  // modo de desarrollo, o sin framework reconocido, null: quedan el selector y los estilos.

  const DE_LIBRERIA = /node_modules|\/\.vite\/deps\//;

  function deLibreria(fichero) {
    return !!fichero && DE_LIBRERIA.test(fichero);
  }

  function limpio(nombre) {
    return String(nombre || '?').replace(/^_+/, '');
  }

  /** De los candidatos, del más cercano al más lejano: el primero de la aplicación. */
  function elegir(candidatos) {
    const primero = candidatos[0] || null;
    const app = candidatos.find((c) => !c.libreria) || primero;
    if (app && primero && app !== primero) app.dentroDe = primero.nombre;
    return app;
  }

  // Angular: las utilidades globales `ng` del modo de desarrollo, y el `debugInfo` que el
  // compilador deja en cada componente (Angular 17.1 o posterior) con su fichero y su línea.
  function deAngular(el) {
    const ng = window.ng;
    if (!ng || typeof ng.getOwningComponent !== 'function') return null;
    if (hayDebugInfo === null) {
      try {
        const raizApp = document.querySelector('[ng-version]');
        const c = raizApp && ng.getComponent(raizApp);
        const def = c && c.constructor['ɵcmp'];
        hayDebugInfo = !!(def && def.debugInfo);
      } catch {
        hayDebugInfo = false;
      }
    }
    const info = (inst) => {
      const ctor = inst && inst.constructor;
      if (!ctor) return null;
      const def = ctor['ɵcmp'];
      const dbg = def && def.debugInfo;
      let etiqueta = '';
      try {
        const anfitrion = ng.getHostElement(inst);
        etiqueta = anfitrion ? anfitrion.localName : '';
      } catch {
        /* sin anfitrión */
      }
      const fichero = dbg && dbg.filePath ? dbg.filePath : null;
      // Sin debugInfo no se sabe el fichero: se toman por librería los prefijos conocidos.
      const libreria = hayDebugInfo ? !fichero || deLibreria(fichero) : /^(mat|cdk|mtx|nz|p|ion|ngx?)-/.test(etiqueta);
      const c = { nombre: limpio((dbg && dbg.className) || ctor.name), etiqueta, libreria };
      if (fichero) c.fichero = fichero;
      if (dbg && dbg.lineNumber) c.linea = dbg.lineNumber;
      // debugInfo da el .ts y la línea de la clase, no la plantilla. Con templateUrl (lo
      // habitual) está en el .html de al lado; el navegador no puede comprobar que existe,
      // ni si la plantilla va en línea en el propio .ts: por eso es «probable».
      if (fichero && !libreria && /\.ts$/.test(fichero)) c.htmlProbable = fichero.replace(/\.ts$/, '.html');
      return c;
    };
    let inst = null;
    try {
      inst = ng.getOwningComponent(el);
    } catch {
      return null;
    }
    const candidatos = [];
    for (let i = 0; inst && i < 25; i++) {
      const c = info(inst);
      if (c) candidatos.push(c);
      if (c && !c.libreria) break;
      try {
        const anfitrion = ng.getHostElement(inst);
        inst = anfitrion ? ng.getOwningComponent(anfitrion) : null;
      } catch {
        inst = null;
      }
    }
    const r = { framework: 'Angular', plantilla: elegir(candidatos) };
    try {
      const c = ng.getComponent(el);
      if (c) r.esComponente = info(c);
    } catch {
      /* no es anfitrión */
    }
    try {
      const d = (ng.getDirectives(el) || []).map((x) => limpio(x.constructor.name));
      if (d.length) r.directivas = d;
    } catch {
      /* sin directivas */
    }
    const cadena = [];
    for (let n = el; n && n !== document.body && cadena.length < 10; n = n.parentElement) {
      try {
        const c = ng.getComponent(n);
        if (c) cadena.push(info(c).nombre);
      } catch {
        /* nada */
      }
    }
    if (cadena.length) r.cadena = cadena.join(' < ');
    return r;
  }

  // React: la fibra que React cuelga de cada nodo del DOM. En desarrollo, su dueño
  // (_debugOwner) es el componente que escribió el elemento en su JSX, y dónde lo escribió
  // está en _debugSource (React 18 o anterior) o en la pila de _debugStack (React 19).
  function fibraDe(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      for (const clave of Object.keys(n)) {
        if (clave.startsWith('__reactFiber$') || clave.startsWith('__reactInternalInstance$')) return n[clave];
      }
    }
    return null;
  }

  function nombreTipo(tipo) {
    if (!tipo || typeof tipo === 'string') return null;
    return tipo.displayName || tipo.name || nombreTipo(tipo.render) || nombreTipo(tipo.type) || null;
  }

  function fuenteReact(fibra) {
    const s = fibra && fibra._debugSource;
    if (s && s.fileName) return { fichero: s.fileName, linea: s.lineNumber || null };
    const pila = fibra && fibra._debugStack && fibra._debugStack.stack;
    if (typeof pila === 'string') {
      for (const linea of pila.split('\n').slice(1)) {
        const m = linea.match(/((?:https?:\/\/|\/)[^\s()]+?):(\d+):\d+\)?\s*$/);
        if (m && !deLibreria(m[1]) && !/react-dom|react\.development|jsx-dev-runtime|\/react\//.test(m[1])) {
          return { fichero: m[1].replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, ''), linea: Number(m[2]) };
        }
      }
    }
    return {};
  }

  function deReact(el) {
    const fibra = fibraDe(el);
    if (!fibra) return null;
    const candidatos = [];
    let f = fibra;
    for (let i = 0; f && i < 25; i++) {
      const dueno = f._debugOwner;
      if (!dueno) break;
      const fuente = fuenteReact(f);
      const c = { nombre: limpio(nombreTipo(dueno.type) || dueno.name), libreria: deLibreria(fuente.fichero) };
      if (fuente.fichero) c.fichero = fuente.fichero;
      if (fuente.linea) c.linea = fuente.linea;
      candidatos.push(c);
      if (!c.libreria) break;
      f = dueno;
    }
    const cadena = [];
    for (let g = fibra.return; g && cadena.length < 10; g = g.return) {
      const nombre = g.type && typeof g.type !== 'string' ? nombreTipo(g.type) : null;
      if (nombre) cadena.push(nombre);
    }
    const plantilla = elegir(candidatos) || (cadena.length ? { nombre: cadena[0], libreria: false } : null);
    if (!plantilla) return null;
    const r = { framework: 'React', plantilla };
    if (cadena.length) r.cadena = cadena.join(' < ');
    return r;
  }

  // Vue: la instancia del componente que cuelga del elemento (__vueParentComponent en Vue 3,
  // __vue__ en Vue 2). En desarrollo, el componente de un SFC trae su fichero (__file).
  function deVue(el) {
    let n = el;
    while (n && n !== document.documentElement && !n.__vueParentComponent && !n.__vue__) n = n.parentElement;
    if (!n || n === document.documentElement) return null;
    const subir = n.__vueParentComponent ? (i) => i.parent : (vm) => vm.$parent;
    const info = n.__vueParentComponent
      ? (i) => {
          const t = i.type || {};
          const fichero = t.__file || null;
          const nombre = t.name || t.__name || (fichero ? fichero.split('/').pop().replace(/\.vue$/, '') : 'Anónimo');
          const c = { nombre: limpio(nombre), libreria: fichero ? deLibreria(fichero) : true };
          if (fichero) c.fichero = fichero;
          return c;
        }
      : (vm) => {
          const o = vm.$options || {};
          const fichero = o.__file || null;
          const c = { nombre: limpio(o.name || o._componentTag || 'Anónimo'), libreria: fichero ? deLibreria(fichero) : true };
          if (fichero) c.fichero = fichero;
          return c;
        };
    const candidatos = [];
    const cadena = [];
    for (let i = n.__vueParentComponent || n.__vue__; i && cadena.length < 10; i = subir(i)) {
      const c = info(i);
      cadena.push(c.nombre);
      if (!candidatos.length || candidatos[candidatos.length - 1].libreria) candidatos.push(c);
    }
    return { framework: 'Vue', plantilla: elegir(candidatos), cadena: cadena.join(' < ') };
  }

  // Svelte: en desarrollo, cada elemento lleva __svelte_meta.loc con el fichero .svelte y la
  // línea donde se escribió (en Svelte 4 la línea empieza en 0).
  function deSvelte(el) {
    let n = el;
    while (n && n !== document.documentElement && !n.__svelte_meta) n = n.parentElement;
    if (!n || !n.__svelte_meta) return null;
    const loc = n.__svelte_meta.loc || {};
    const fichero = loc.file || null;
    const c = { nombre: fichero ? fichero.split('/').pop().replace(/\.svelte$/, '') : '?', libreria: deLibreria(fichero) };
    if (fichero) c.fichero = fichero;
    if (loc.line != null) c.linea = loc.line;
    return { framework: 'Svelte', plantilla: c };
  }

  /** El componente del elemento, con el primer adaptador que lo reconozca; o null. */
  function componenteDe(el) {
    for (const adaptador of [deAngular, deReact, deVue, deSvelte]) {
      try {
        const r = adaptador(el);
        if (r && r.plantilla) return r;
      } catch {
        /* sigue con el siguiente */
      }
    }
    return null;
  }

  function rotulo(el) {
    const r = el.getBoundingClientRect();
    const c = componenteDe(el);
    const p = c && c.plantilla;
    return `${describir(el)}${p ? ' · ' + p.nombre : ''} · ${Math.round(r.width)}×${Math.round(r.height)}`;
  }

  function datosDe(el) {
    const r = el.getBoundingClientRect();
    const d = {
      elemento: describir(el),
      selector: selector(el),
      textoElemento: textoDe(el),
      componente: componenteDe(el),
      caja: { x: Math.round(r.left), y: Math.round(r.top), ancho: Math.round(r.width), alto: Math.round(r.height) },
      estilos: estilosDe(el),
    };
    const padre = el.parentElement;
    if (padre && padre !== document.documentElement) {
      const cp = getComputedStyle(padre);
      d.contenedor = {
        elemento: describir(padre),
        ancho: Math.round(padre.getBoundingClientRect().width),
        display: cp.display,
      };
      if (/flex|grid/.test(cp.display)) {
        d.contenedor.gap = cp.gap;
        if (cp.display.includes('flex')) d.contenedor['flex-direction'] = cp.flexDirection;
        if (cp.display.includes('grid')) d.contenedor['grid-template-columns'] = cp.gridTemplateColumns;
      }
    }
    return d;
  }

  // ---------------------------------------------------------------- geometría

  function bajo(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el !== host && el !== document.documentElement) return el;
    }
    return null;
  }

  function comun(els) {
    if (!els.length) return null;
    let a = els[0];
    while (a && !els.every((x) => a.contains(x))) a = a.parentElement;
    return a;
  }

  function rectDe(a, e) {
    return {
      left: Math.min(a.x, e.clientX),
      top: Math.min(a.y, e.clientY),
      width: Math.abs(e.clientX - a.x),
      height: Math.abs(e.clientY - a.y),
    };
  }

  function elementoDe(nota) {
    try {
      return document.querySelector(nota.selector);
    } catch {
      return null;
    }
  }

  function cajaDe(nota) {
    const el = elementoDe(nota);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    if (nota.zona) return { left: r.left + nota.zona.dx, top: r.top + nota.zona.dy, width: nota.zona.ancho, height: nota.zona.alto };
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function cajaActual() {
    const ed = editor;
    if (!ed) return null;
    if (ed.nota) return cajaDe(ed.nota);
    const r = ed.el.getBoundingClientRect();
    if (ed.rel) return { left: r.left + ed.rel.dx, top: r.top + ed.rel.dy, width: ed.rel.ancho, height: ed.rel.alto };
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // ---------------------------------------------------------------- pintar

  function mostrarResalte(r, texto) {
    if (!r) return ocultarResalte();
    Object.assign(resalte.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    if (!texto) {
      etiqueta.style.display = 'none';
      return;
    }
    etiqueta.textContent = texto;
    etiqueta.style.display = 'block';
    const y = r.top - 20 >= 0 ? r.top - 20 : r.top + r.height + 2;
    etiqueta.style.left = Math.max(0, Math.min(r.left, innerWidth - etiqueta.offsetWidth - 4)) + 'px';
    etiqueta.style.top = Math.max(0, Math.min(y, innerHeight - 18)) + 'px';
  }

  function ocultarResalte() {
    resalte.style.display = 'none';
    etiqueta.style.display = 'none';
  }

  function pintarBarra() {
    btnSenalar.classList.toggle('activo', activo);
    btnSenalar.textContent = activo ? 'Señalando…' : 'Señalar';
    const resueltas = notas.filter((x) => x.resuelta).length;
    btnNotas.textContent = `Notas (${notas.length - resueltas}${resueltas ? ` · ${resueltas} ✓` : ''})`;
    btnNotas.classList.toggle('activo', !panel.hidden);
    btnVer.classList.toggle('activo', prefs.ver);
    ayuda.hidden = !activo;
    ui.classList.toggle('izquierda', prefs.lado === 'izquierda');
    document.documentElement.classList.toggle('live-review-activo', activo);
  }

  function agrupar() {
    const grupos = new Map();
    for (const x of [...notas].sort((a, b) => a.n - b.n)) {
      const k = rutaDe(x.ruta);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(x);
    }
    return grupos;
  }

  function pintarLista() {
    if (panel.hidden) return;
    if (!notas.length) {
      panel.innerHTML = '<div class="vacio">Sin notas. Pulsa «Señalar» y haz clic en lo que esté mal, o arrastra para marcar una zona.</div>';
      return;
    }
    let html =
      '<div class="cab-panel"><b>Notas</b><span></span>' +
      '<button data-accion="copiar">Copiar en Markdown</button>' +
      '<button data-accion="vaciar" class="peligro">Borrar todas</button></div>';
    for (const [ruta, lista] of agrupar()) {
      html += `<div class="ruta">${esc(ruta)}</div>`;
      for (const x of lista) {
        const p = x.componente && x.componente.plantilla;
        const meta = (p ? p.nombre + ' · ' : '') + (x.tipo === 'zona' ? 'zona en ' : '') + x.elemento;
        const r = x.resuelta ? ' resuelta' : '';
        html +=
          `<div class="nota${r}"><span class="num${r}">${x.n}</span>` +
          `<div class="cuerpo"><div class="texto">${esc(x.texto)}</div><div class="meta" title="${esc(meta)}">${esc(meta)}</div></div>` +
          `<div class="ops"><button data-accion="ir" data-id="${x.id}">Ir</button>` +
          `<button data-accion="editar" data-id="${x.id}">Editar</button>` +
          `<button data-accion="resolver" data-id="${x.id}">${x.resuelta ? 'Reabrir' : 'Resuelta'}</button></div></div>`;
      }
    }
    panel.innerHTML = html;
  }

  function pintarChinchetas() {
    const ruta = rutaDe(rutaActual());
    const vivas = new Set();
    if (prefs.ver) {
      const usadas = [];
      for (const nota of [...notas].sort((a, b) => a.n - b.n)) {
        if (rutaDe(nota.ruta) !== ruta) continue;
        const r = cajaDe(nota);
        if (!r || r.top + r.height < 0 || r.top > innerHeight || r.left + r.width < 0 || r.left > innerWidth) continue;
        let x = Math.min(Math.max(r.left, 12), innerWidth - 12);
        const y = Math.min(Math.max(r.top, 12), innerHeight - 12);
        while (usadas.some(([ux, uy]) => Math.abs(ux - x) < 20 && Math.abs(uy - y) < 20)) x += 24;
        usadas.push([x, y]);
        let p = chinchetas.get(nota.id);
        if (!p) {
          p = document.createElement('div');
          p.className = 'chincheta';
          p.dataset.id = nota.id;
          capa.appendChild(p);
          chinchetas.set(nota.id, p);
        }
        p.textContent = nota.n;
        p.classList.toggle('resuelta', !!nota.resuelta);
        p.title = nota.resuelta ? `${nota.texto} (resuelta)` : nota.texto;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        vivas.add(nota.id);
      }
    }
    for (const [id, p] of chinchetas) {
      if (!vivas.has(id)) {
        p.remove();
        chinchetas.delete(id);
      }
    }
  }

  function elevar() {
    if (typeof host.showPopover !== 'function') return;
    try {
      if (host.matches(':popover-open')) host.hidePopover();
      host.showPopover();
    } catch {
      /* sin popover: queda el z-index */
    }
    abiertos = document.querySelectorAll(':popover-open').length;
  }

  function actualizar() {
    programado = false;
    // Por si un popover se abrió sin que llegara su evento toggle.
    if (typeof host.showPopover === 'function') {
      const n = document.querySelectorAll(':popover-open').length;
      if (n !== abiertos || !host.matches(':popover-open')) elevar();
    }
    if (editor) {
      mostrarResalte(cajaActual(), null);
    } else if (destello) {
      if (Date.now() > destello.hasta) {
        destello = null;
        ocultarResalte();
      } else {
        mostrarResalte(cajaDe(destello.nota), 'Nota ' + destello.nota.n);
      }
    }
    pintarChinchetas();
  }

  function programar() {
    if (programado) return;
    programado = true;
    requestAnimationFrame(actualizar);
  }

  // ---------------------------------------------------------------- editor

  function abrirElemento(el) {
    if (el.closest && el.localName !== 'svg' && el.closest('svg')) el = el.closest('svg');
    editor = { tipo: 'elemento', el, pila: [], borrador: '' };
    pintarEditor();
  }

  function abrirZona(r) {
    const puntos = [];
    for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) puntos.push([r.left + (r.width * i) / 4, r.top + (r.height * j) / 4]);
    const hallados = [...new Set(puntos.map(([x, y]) => bajo(x, y)).filter(Boolean))];
    const ancla = comun(hallados) || document.body;
    const ra = ancla.getBoundingClientRect();
    editor = {
      tipo: 'zona',
      el: ancla,
      pila: [],
      borrador: '',
      rel: { dx: Math.round(r.left - ra.left), dy: Math.round(r.top - ra.top), ancho: Math.round(r.width), alto: Math.round(r.height) },
      dentro: hallados.slice(0, 8),
    };
    pintarEditor();
  }

  function abrirExistente(nota) {
    editor = { tipo: nota.tipo, nota, el: elementoDe(nota), pila: [] };
    pintarEditor();
  }

  function pintarEditor() {
    const ed = editor;
    const nota = ed.nota;
    const n = nota ? nota.n : siguiente();
    const desc = nota
      ? (nota.tipo === 'zona' ? `Zona ${nota.zona.ancho}×${nota.zona.alto} en ` : '') + nota.elemento
      : ed.tipo === 'zona'
        ? `Zona ${ed.rel.ancho}×${ed.rel.alto} en ${describir(ed.el)}`
        : rotulo(ed.el);
    const nivel =
      !nota && ed.tipo === 'elemento'
        ? '<div class="nivel">' +
          `<button data-accion="padre" ${ed.el.parentElement && ed.el.parentElement !== document.body ? '' : 'disabled'}>↑ Contenedor</button>` +
          `<button data-accion="hijo" ${ed.pila.length ? '' : 'disabled'}>↓ Volver</button></div>`
        : '';
    cajaEditor.innerHTML =
      `<div class="cab"><b>Nota ${n}</b><span class="desc" title="${esc(desc)}">${esc(desc)}</span></div>` +
      nivel +
      `<textarea placeholder="¿Qué está mal? ¿Cómo debería verse?">${esc(nota ? nota.texto : ed.borrador)}</textarea>` +
      '<div class="acciones">' +
      (nota ? '<button data-accion="borrar" class="peligro">Borrar</button>' : '') +
      '<span></span><button data-accion="cancelar">Cancelar</button>' +
      '<button data-accion="guardar" class="primario">Guardar</button></div>' +
      '<div class="pista">⌘↵ guarda · Esc cancela</div>';
    cajaEditor.hidden = false;
    colocarEditor();
    programar();
    const ta = cajaEditor.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function colocarEditor() {
    const r = cajaActual() || { left: innerWidth / 2 - 170, top: innerHeight / 3, width: 0, height: 0 };
    const w = cajaEditor.offsetWidth || 340;
    const h = cajaEditor.offsetHeight || 220;
    let left = Math.min(Math.max(r.left, 8), innerWidth - w - 8);
    let top = r.top + r.height + 8;
    if (top + h > innerHeight - 8) top = r.top - h - 8;
    if (top < 8) {
      top = Math.max(8, innerHeight - h - 72);
      left = prefs.lado === 'izquierda' ? 16 : innerWidth - w - 16;
    }
    cajaEditor.style.left = left + 'px';
    cajaEditor.style.top = top + 'px';
  }

  function cerrarEditor() {
    editor = null;
    cajaEditor.hidden = true;
    ocultarResalte();
  }

  function guardarEditor() {
    const ed = editor;
    const ta = cajaEditor.querySelector('textarea');
    const texto = ta.value.trim();
    if (!texto) {
      ta.focus();
      return;
    }
    if (ed.nota) {
      ed.nota.texto = texto;
      ed.nota.editada = new Date().toISOString();
    } else {
      const nota = Object.assign(
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          n: siguiente(),
          texto,
          tipo: ed.tipo,
          creada: new Date().toISOString(),
          ruta: rutaActual(),
          titulo: document.title,
          ventana: { ancho: innerWidth, alto: innerHeight, escala: devicePixelRatio },
        },
        datosDe(ed.el),
      );
      if (ed.tipo === 'zona') {
        nota.zona = ed.rel;
        nota.dentro = ed.dentro.map((el) => {
          const c = componenteDe(el);
          return { elemento: describir(el), texto: textoDe(el, 60), plantilla: c ? c.plantilla.nombre : null };
        });
      }
      notas.push(nota);
    }
    cerrarEditor();
    guardar();
  }

  function borrarNota(nota) {
    notas = notas.filter((x) => x.id !== nota.id);
    cerrarEditor();
    guardar();
  }

  /** Marca una nota como resuelta (con la fecha) o la reabre. Sigue en la lista, en gris. */
  function resolverNota(nota, si = true) {
    if (!nota) return false;
    if (si) nota.resuelta = new Date().toISOString();
    else delete nota.resuelta;
    guardar();
    return true;
  }

  function irA(nota) {
    if (!nota) return false;
    if (rutaDe(rutaActual()) !== rutaDe(nota.ruta)) navegar(nota.ruta);
    const fin = Date.now() + 4000;
    const intentar = () => {
      const el = elementoDe(nota);
      if (el && rutaDe(rutaActual()) === rutaDe(nota.ruta)) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        destello = { nota, hasta: Date.now() + 2000 };
        programar();
      } else if (Date.now() < fin) {
        setTimeout(intentar, 150);
      }
    };
    setTimeout(intentar, 50);
    return true;
  }

  // ---------------------------------------------------------------- Markdown

  function markdown() {
    const resueltas = notas.filter((x) => x.resuelta).length;
    let md = `# Notas de revisión (${notas.length}${resueltas ? `, ${resueltas} resueltas` : ''})\n`;
    for (const [ruta, lista] of agrupar()) {
      md += `\n## \`${ruta}\`\n\n`;
      for (const x of lista) {
        const p = x.componente && x.componente.plantilla;
        md += `${x.n}. ${x.resuelta ? '(Resuelta) ' : ''}${x.texto.replace(/\s*\n\s*/g, ' / ')}\n`;
        md +=
          `   - ${x.tipo === 'zona' ? `Zona de ${x.zona.ancho}×${x.zona.alto} en` : 'En'} \`${x.elemento}\`` +
          (x.textoElemento ? ` «${x.textoElemento.slice(0, 60)}»` : '') +
          `, ventana de ${x.ventana.ancho}×${x.ventana.alto}\n`;
        if (p) {
          md += `   - Plantilla: ${p.nombre}${p.fichero ? ` (\`${p.fichero}${p.linea ? ':' + p.linea : ''}\`)` : ''}`;
          md += p.htmlProbable ? `; con templateUrl, \`${p.htmlProbable}\`\n` : '\n';
        }
      }
    }
    return md;
  }

  function copiar(texto, boton) {
    const avisar = (ok) => {
      const antes = boton.textContent;
      boton.textContent = ok ? 'Copiado' : 'No se pudo copiar';
      setTimeout(() => (boton.textContent = antes), 1500);
    };
    const aMano = () => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      raiz.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      avisar(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(() => avisar(true), aMano);
    else aMano();
  }

  // ---------------------------------------------------------------- eventos

  function dentro(e) {
    return e.composedPath().includes(host);
  }

  function alternar(si) {
    activo = si === undefined ? !activo : !!si;
    if (!activo) {
      arrastre = null;
      marco.style.display = 'none';
      if (!editor) ocultarResalte();
    }
    pintarBarra();
  }

  function alPulsar(e) {
    if (!activo || dentro(e)) return;
    e.stopImmediatePropagation();
    if (editor || e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, moviendo: false };
  }

  function alMover(e) {
    if (!activo || editor) return;
    if (arrastre) {
      if (!arrastre.moviendo && Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) > 6) arrastre.moviendo = true;
      if (arrastre.moviendo) {
        const r = rectDe(arrastre, e);
        Object.assign(marco.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        ocultarResalte();
      }
      return;
    }
    if (dentro(e)) return ocultarResalte();
    const el = bajo(e.clientX, e.clientY);
    if (el) mostrarResalte(el.getBoundingClientRect(), rotulo(el));
    else ocultarResalte();
  }

  function alSoltar(e) {
    if (!activo || dentro(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (editor || !arrastre) return;
    const a = arrastre;
    arrastre = null;
    marco.style.display = 'none';
    if (a.moviendo) {
      const r = rectDe(a, e);
      if (r.width > 4 && r.height > 4) abrirZona(r);
    } else {
      const el = bajo(e.clientX, e.clientY);
      if (el) abrirElemento(el);
    }
  }

  function bloquear(e) {
    if (!activo || dentro(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function alTeclear(e) {
    if (e.key === 'Escape' && (editor || activo)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (editor) cerrarEditor();
      else alternar(false);
      return;
    }
    const t = e.target;
    const escribiendo = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.localName));
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyS' && !escribiendo && !dentro(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alternar();
    }
  }

  function alClicUI(e) {
    const chincheta = e.target.closest('.chincheta');
    if (chincheta) {
      const nota = notas.find((x) => x.id === chincheta.dataset.id);
      if (nota && !editor) abrirExistente(nota);
      return;
    }
    const b = e.target.closest('button[data-accion]');
    if (!b) return;
    const nota = b.dataset.id ? notas.find((x) => x.id === b.dataset.id) : null;
    // Que el foco no se quede en la barra: las teclas son de la aplicación.
    if (b.closest('.barra, .panel')) b.blur();
    switch (b.dataset.accion) {
      case 'senalar':
        alternar();
        break;
      case 'notas':
        panel.hidden = !panel.hidden;
        pintarLista();
        pintarBarra();
        break;
      case 'ver':
        prefs.ver = !prefs.ver;
        escribir(CLAVE_PREFS, prefs);
        pintarBarra();
        pintarChinchetas();
        break;
      case 'mover':
        prefs.lado = prefs.lado === 'izquierda' ? 'derecha' : 'izquierda';
        escribir(CLAVE_PREFS, prefs);
        pintarBarra();
        break;
      case 'ir':
        irA(nota);
        break;
      case 'resolver':
        resolverNota(nota, !(nota && nota.resuelta));
        break;
      case 'editar':
        if (nota) {
          if (editor) cerrarEditor();
          irA(nota);
          abrirExistente(nota);
        }
        break;
      case 'copiar':
        copiar(markdown(), b);
        break;
      case 'vaciar':
        if (b.dataset.confirmar) {
          notas = [];
          guardar();
        } else {
          b.dataset.confirmar = '1';
          b.textContent = '¿Seguro? Pulsa otra vez';
          setTimeout(() => {
            if (b.isConnected) {
              delete b.dataset.confirmar;
              b.textContent = 'Borrar todas';
            }
          }, 3000);
        }
        break;
      case 'padre':
        if (editor.el.parentElement && editor.el.parentElement !== document.body) {
          editor.borrador = cajaEditor.querySelector('textarea').value;
          editor.pila.push(editor.el);
          editor.el = editor.el.parentElement;
          pintarEditor();
        }
        break;
      case 'hijo':
        if (editor.pila.length) {
          editor.borrador = cajaEditor.querySelector('textarea').value;
          editor.el = editor.pila.pop();
          pintarEditor();
        }
        break;
      case 'cancelar':
        cerrarEditor();
        break;
      case 'guardar':
        guardarEditor();
        break;
      case 'borrar':
        borrarNota(editor.nota);
        break;
    }
  }

  function alPasarUI(e) {
    if (editor || arrastre) return;
    const chincheta = e.target.closest && e.target.closest('.chincheta');
    if (!chincheta) return;
    const nota = notas.find((x) => x.id === chincheta.dataset.id);
    if (nota) mostrarResalte(cajaDe(nota), null);
  }

  function alSalirUI(e) {
    if (editor || arrastre || destello) return;
    if (e.target.closest && e.target.closest('.chincheta')) ocultarResalte();
  }

  // ---------------------------------------------------------------- arranque

  function iniciar() {
    host = document.createElement('div');
    host.id = 'live-review';
    // Los diálogos y menús de la CDK 21 se abren en la capa superior (popover), por
    // encima de cualquier z-index: el señalador también va ahí, y sube cada vez que
    // se abre otro (elevar).
    host.setAttribute('popover', 'manual');
    host.style.cssText =
      'position:fixed;inset:auto;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0;' +
      'background:transparent;overflow:visible;z-index:2147483647;';
    raiz = host.attachShadow({ mode: 'open' });
    raiz.innerHTML =
      `<style>${CSS}</style>` +
      '<div class="resalte"></div><div class="etiqueta"></div><div class="marco"></div><div class="capa"></div>' +
      '<div class="ui"><div class="panel" hidden></div><div class="barra">' +
      '<span class="ayuda" hidden>Clic: elemento · Arrastrar: zona · Esc: salir</span>' +
      '<button data-accion="senalar" title="Señalar (⌥S)">Señalar</button>' +
      '<button data-accion="notas">Notas</button>' +
      '<button data-accion="ver" title="Mostrar u ocultar las chinchetas">Chinchetas</button>' +
      '<button data-accion="mover" title="Llevar la barra al otro lado">⇆</button>' +
      '</div></div><div class="editor" hidden></div>';
    const $ = (s) => raiz.querySelector(s);
    resalte = $('.resalte');
    etiqueta = $('.etiqueta');
    marco = $('.marco');
    capa = $('.capa');
    ui = $('.ui');
    barra = $('.barra');
    ayuda = $('.ayuda');
    panel = $('.panel');
    cajaEditor = $('.editor');
    btnSenalar = $('[data-accion="senalar"]');
    btnNotas = $('[data-accion="notas"]');
    btnVer = $('[data-accion="ver"]');

    const estilo = document.createElement('style');
    estilo.id = 'live-review-estilo';
    estilo.textContent =
      'html.live-review-activo, html.live-review-activo *:not(#live-review) { cursor: crosshair !important; user-select: none !important; -webkit-user-select: none !important; }';
    document.head.appendChild(estilo);
    document.body.appendChild(host);
    elevar();
    document.addEventListener(
      'toggle',
      (e) => {
        if (e.target !== host && e.newState === 'open') elevar();
      },
      true,
    );

    raiz.addEventListener('click', alClicUI);
    raiz.addEventListener('pointerover', alPasarUI);
    raiz.addEventListener('pointerout', alSalirUI);
    raiz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && editor) {
        e.preventDefault();
        guardarEditor();
      }
    });
    // Que lo que se teclea en la nota no llegue a los atajos de la aplicación.
    for (const t of ['keydown', 'keyup', 'keypress']) {
      host.addEventListener(t, (e) => {
        if (e.composedPath()[0].localName === 'textarea') e.stopPropagation();
      });
    }

    const captura = { capture: true };
    window.addEventListener('pointerdown', alPulsar, captura);
    window.addEventListener('pointermove', alMover, captura);
    window.addEventListener('pointerup', alSoltar, captura);
    for (const t of ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu']) window.addEventListener(t, bloquear, captura);
    window.addEventListener('keydown', alTeclear, captura);
    window.addEventListener('scroll', programar, { capture: true, passive: true });
    window.addEventListener('resize', programar);
    window.addEventListener('hashchange', programar);
    window.addEventListener('popstate', programar);
    setInterval(actualizar, 300);

    pintarBarra();
    pintarChinchetas();
  }

  window.__liveReview = {
    version: 3,
    /** Copia de las notas, con todos sus datos. */
    notas: () => JSON.parse(JSON.stringify(notas)),
    markdown,
    activar: (si = true) => alternar(si),
    chinchetas: (si = true) => {
      prefs.ver = !!si;
      pintarBarra();
      pintarChinchetas();
    },
    /** Esconde la barra (para capturas) o la vuelve a enseñar. */
    barra: (si = true) => {
      ui.style.display = si ? '' : 'none';
    },
    ir: (n) => irA(notas.find((x) => x.n === n)),
    /** Marca la nota n como resuelta (o la reabre con false): su chincheta pasa a gris. */
    resolver: (n, si = true) => resolverNota(notas.find((x) => x.n === n), si),
    /**
     * Dónde está ahora la nota n en la ventana, en píxeles de CSS (tras ir(n), que la centra),
     * o null si no está en esta pantalla. Para hacer zoom sobre ella en una captura reducida.
     */
    caja: (n) => {
      const nota = notas.find((x) => x.n === n);
      const r = nota && rutaDe(rutaActual()) === rutaDe(nota.ruta) ? cajaDe(nota) : null;
      return r && { x: Math.round(r.left), y: Math.round(r.top), ancho: Math.round(r.width), alto: Math.round(r.height), ventana: { ancho: innerWidth, alto: innerHeight } };
    },
    borrar: (n) => {
      notas = notas.filter((x) => x.n !== n);
      guardar();
    },
    /** Borra todas las notas de este origen. */
    vaciar: () => {
      notas = [];
      guardar();
    },
    /** El componente de un elemento, como lo guarda una nota (para comprobar el adaptador). */
    componenteDe: (el) => componenteDe(el),
  };

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();

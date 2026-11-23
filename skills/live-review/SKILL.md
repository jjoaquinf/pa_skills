---
name: live-review
description: Revisión visual en vivo de una aplicación web. El usuario señala sobre la propia página, en el panel del navegador, lo que está mal (clic en un elemento o arrastrando una zona) y escribe una nota. Claude lee cada nota con el componente y el fichero que la pintan (Angular, React, Vue o Svelte en desarrollo), sus estilos, su ruta y el ancho de la ventana, la mira en la página y la convierte en trabajo. Úsala siempre que el usuario quiera señalar, marcar o enseñar fallos gráficos o de interfaz sobre la página, revisar el aspecto de un frontal, darte su opinión visual de unas pantallas, o diga cosas como «te lo señalo en la pantalla», «mira esto en la página», «hay muchos problemas gráficos», «quiero marcarte lo que no me gusta», aunque no nombre la skill.
---

# live-review

Un script (`assets/live-review.js`) que se inyecta en la aplicación que corre en el panel
del navegador. Pinta una barra abajo a la derecha:

- **«Señalar»** (o ⌥S): un clic en un elemento, o arrastrar para marcar una zona, abre una
  nota. Al guardarla (⌘↵) queda una chincheta numerada sobre el elemento.
- **«Notas»**: la lista, con «Ir» y «Editar», y «Copiar en Markdown».
- **«Chinchetas»** y **⇆**: esconderlas y llevar la barra al otro lado.

Mientras está «Señalando…», los clics no llegan a la aplicación: nada se pulsa ni se guarda.
Las notas quedan en el `localStorage` del origen y sobreviven a recargas.

Cada nota guarda:
- la ruta y la ventana;
- el elemento, su selector y su texto;
- la caja, los estilos calculados y los de su contenedor;
- **el componente cuya plantilla declara el elemento**, con su fichero y su línea si el
  framework los da en desarrollo.

Lo último es lo que la hace útil: de cada nota se va derecho al `.html`, `.tsx`, `.vue` o
`.svelte` que hay que tocar.

## 1. Tener la aplicación en el panel

Arráncala con su servidor de desarrollo (`preview_start` con `.claude/launch.json`) o ábrela
por su URL. Tiene que ser **una build de desarrollo**: en producción no quedan nombres de
componente ni ficheros, y las notas solo traerían selector y estilos. Si pide iniciar sesión,
que entre el usuario.

## 2. Cargar el script

**A. Desde los estáticos del servidor de desarrollo.** Es la forma preferida: la llamada es
de una línea y se puede repetir tras cada recarga sin coste.

1. Copia `assets/live-review.js` a la carpeta de estáticos del proyecto. Mira su
   configuración (`angular.json` → `assets`, `vite.config` → `publicDir`):
   - `public/` en Vite, Angular 17 o posterior, CRA y Next;
   - `src/assets/` en Angular antiguo;
   - `static/` en SvelteKit.
2. Inyéctalo con `javascript_tool`. La ruta es relativa a `document.baseURI`, así que vale
   también con un `base href`:

   ```js
   const s = document.createElement('script');
   s.src = new URL('live-review.js', document.baseURI).href; // o 'assets/live-review.js'
   document.head.append(s);
   ```

3. Compruébalo: `window.__liveReview?.version` da `2`.

El fichero copiado **no se versiona**. Bórralo al terminar: un fichero sin seguir deja el
repositorio con cambios, y hay herramientas que entonces se niegan a trabajar (un loop que
monta árboles de trabajo, por ejemplo). Si el proyecto tiene un árbol de trabajo solo para
probar, cópialo allí.

**B. Pegándolo.** Si no hay estáticos a mano, lee el fichero y pásalo entero como texto a
`javascript_tool`. Cuesta unos 9.000 tokens cada vez, así que úsalo solo si A no sirve.

**Tras una recarga** (navegar entre pantallas con rutas en `#` no recarga, pero un cambio de
código o F5 sí), vuelve a inyectarlo: las notas siguen ahí. Si la revisión va a ser larga y
con recargas, propón cargarlo solo desde algo que no se versione del entorno de desarrollo.
En un proyecto se hizo desde el `env.js` de un árbol de trabajo de pruebas. La decisión es
del usuario.

## 3. Decirle al usuario cómo se usa

Corto, con este contenido:

> Pulsa «Señalar» (o ⌥S), haz clic en lo que esté mal (o arrastra para marcar una zona),
> escribe qué está mal y cómo debería verse, y guarda con ⌘↵. Esc sale. Puedes navegar entre
> pantallas: cada chincheta sale solo en la suya. Cuando termines, dime «ya».

Si el usuario pone la ventana a otro ancho, cada nota lo apunta: muchos problemas solo
existen a cierto ancho.

## 4. Leer las notas

1. `__liveReview.notas()` con `javascript_tool`.
2. Antes de mirar una nota, pon el panel al tamaño de su `ventana` (`resize_window`). Si no,
   puedes ver otro diseño, por ejemplo con el menú lateral encima o el panel debajo en vez de
   al lado.
3. Para cada nota:
   - `__liveReview.barra(false)` y `__liveReview.chinchetas(false)`, para capturas limpias;
   - `__liveReview.ir(n)` lleva a su pantalla y resalta el elemento;
   - captura o `zoom`.
4. Interpreta los datos:
   - `componente.plantilla.fichero:linea` es por donde empezar;
   - `dentroDe`, el componente de librería que envuelve al elemento;
   - `estilos` y `contenedor` dan anchos, márgenes y flex o grid sin abrir las DevTools;
   - una nota de zona trae `dentro`: los elementos que cubre.

Si `componente` sale `null`, mira por qué antes de seguir a ciegas: una build de producción,
un framework que el script no reconoce, o React 19 sin una pila legible (sale el nombre sin
fichero). `__liveReview.componenteDe(elemento)` prueba el adaptador sobre cualquier nodo.

## 5. Convertirlas en trabajo

- **Busca primero la causa común.** Varias notas de aspecto suelen tener la misma: una
  pantalla que no usa las piezas de estilo del proyecto, o un contenedor sin su tarjeta. Un
  arreglo para la causa vale más que nueve parches.
- **Separa lo visual de lo que cambia el comportamiento** o una especificación (que algo no
  aparezca por omisión, que se filtre de otra forma). Lo segundo pide decisiones del usuario
  y suele ser otro cambio.
- **Si el proyecto tiene su forma de encargar cambios** (specs, changes, skills para
  redactarlos), úsala con lo que has encontrado.
- **Devuelve una tabla**: nota, dónde (pantalla y fichero), causa y arreglo propuesto.
  Pregunta antes de tocar código. Las notas son la opinión del usuario: lo que no entiendas
  de una, pregúntalo, en vez de interpretarlo.

## 6. Al terminar

- Borra el fichero copiado a los estáticos (A).
- Las notas siguen en el `localStorage` del navegador. `__liveReview.vaciar()` las quita si
  el usuario no las quiere.

## Lo que conviene saber

- **La capa superior.** Los diálogos, menús y desplegables de Angular CDK 21 o posterior, y
  los `<dialog>` modales y los `popover` nativos, se abren en la capa superior del navegador,
  por encima de cualquier `z-index`. Si la barra quedara debajo, el clic caería en el fondo
  del diálogo y lo cerraría. El script se pone también como `popover` y vuelve a subir cada
  vez que se abre otro.
- **Señalar dentro de un menú o un desplegable**: sal con Esc, ábrelo, y ⌥S. Mientras se
  señala, los clics no llegan a la aplicación y no se abriría.
- **Lo que está encima es lo que se señala.** Con un menú lateral abierto sobre el contenido
  (en ventanas estrechas), su fondo tapa la página, y la nota se queda en el fondo
  (`mat-drawer-backdrop` o parecido). Si una nota trae un fondo o un `backdrop` como
  elemento, mírala en la captura. Si lo ves venir, pide al usuario que cierre el menú o que
  ensanche el panel.
- **Un `<select>` nativo** no sale en las capturas: elige su opción con `form_input`.
- **Las teclas**: lo que se escribe en la nota no llega a los atajos de la aplicación, y Esc
  sale de la nota o del modo. Con el foco en la barra, las teclas son de la aplicación.
- **Es una herramienta de inspección.** No la uses para cambiar la interfaz: los arreglos van
  al código.
- **Privacidad**: las notas guardan textos de la página y quedan en el navegador del usuario.
  No las mandes a ningún sitio.

## La API (`window.__liveReview`)

| Llamada | Qué hace |
| --- | --- |
| `notas()` | copia de las notas, con todos sus datos |
| `markdown()` | las notas en Markdown, por pantalla |
| `ir(n)` | lleva a la pantalla de la nota `n` y resalta su elemento |
| `activar(true/false)` | entra o sale del modo de señalar |
| `barra(false/true)`, `chinchetas(false/true)` | esconde o enseña la barra y las chinchetas, para capturas |
| `borrar(n)`, `vaciar()` | quita una nota o todas |
| `componenteDe(el)` | el componente de un elemento, como lo guarda una nota |
| `version` | `2` |

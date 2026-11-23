# AGENTS.md — pa_skills

Skills de Claude Code reutilizables entre proyectos, y el script que las instala. Este
fichero es la fuente de las convenciones del repositorio: quien cambie una, la actualiza
aquí en el mismo cambio.

## Estructura

```
pa_skills/
├── skills/<nombre>/      una carpeta por skill: SKILL.md y, si hacen falta,
│                         assets/, scripts/ y references/
├── install.mjs           el instalador: Node 18.17+, solo módulos de serie
├── test/install.test.mjs sus pruebas, y la validación de todas las skills
├── package.json          solo para «npm test» y «npm run instalar»: sin dependencias
└── .gitattributes        todo en LF, también al sacarlo en Windows
```

## Las skills

- **Una skill es una carpeta autocontenida.** Lo que usa va dentro de ella, y se refiere a
  sus ficheros por su ruta relativa a la carpeta (`assets/live-review.js`). Al instalarse se
  copia o se enlaza entera.
- **`name` es el nombre de su carpeta**, en minúsculas con guiones. `description` dice qué
  hace y cuándo usarla, sin `<` ni `>` y en menos de 1024 caracteres. Es lo único que Claude
  ve antes de cargarla, así que nombra las situaciones en que debe usarse.
- **En castellano**, como el usuario. Explica el porqué de cada regla en vez de gritarla:
  una skill la lee un modelo que razona.
- **Se cambia aquí, nunca en la copia instalada.** Después, `node install.mjs <nombre>`, o
  nada si está enlazada.
- **Sin secretos ni datos de un proyecto concreto.** Lo que una skill aprendió en un
  proyecto se escribe en general.

## El instalador

- **Funciona igual en macOS, Linux y Windows.** Usa `node:path` y `node:os`, nunca rutas
  con `/` escritas a mano ni órdenes de la consola. En Windows, `--enlazar` crea una unión
  de directorio (`junction`), que no pide modo de desarrollador.
- **Solo toca lo suyo.** Una copia suya lleva la marca `.pa-skills.json`, y un enlace suyo
  apunta a `skills/`. No pisa una carpeta ajena salvo con `--forzar`, y entonces la guarda
  antes en `<destino>-respaldo/`. El respaldo va **fuera** de la carpeta de skills: dentro,
  Claude lo cargaría como una segunda skill con el mismo nombre.
- **Una carpeta igual a la del repositorio, sin marca, se adopta** (se le pone la marca) en
  vez de tratarse como ajena.
- **Repetirlo es seguro**: no reescribe lo que ya está al día.
- **Sale con 1 si algo no se instaló**: una skill no válida, o una carpeta ajena sin
  `--forzar`. Sale con 2 ante una opción desconocida.

## Pruebas

```bash
npm test        # o: node --test test/install.test.mjs
```

Prueban todas las skills del repositorio y el instalador contra carpetas temporales, sin
tocar `~/.claude`. Una skill nueva no necesita prueba propia para pasar la validación, pero
si trae un script con lógica, la lleva en `test/`.

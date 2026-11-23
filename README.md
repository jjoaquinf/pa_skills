# pa_skills

Skills de [Claude Code](https://claude.com/claude-code) para reutilizar en cualquier
proyecto, con un instalador que funciona igual en macOS, Linux y Windows.

## Las skills

| Skill | Para qué |
| --- | --- |
| [`live-review`](skills/live-review/SKILL.md) | Revisión visual en vivo de una aplicación web: el usuario señala sobre la propia página lo que está mal y escribe una nota; Claude lee cada nota con el componente y el fichero que la pintan (Angular, React, Vue o Svelte en desarrollo), sus estilos y su ruta, y la convierte en trabajo. |

## Instalarlas

Hace falta Node 18.17 o posterior, sin dependencias.

```bash
git clone https://github.com/jjoaquinf/pa_skills.git
cd pa_skills
node install.mjs
```

Así quedan copiadas en la carpeta de skills personales de Claude Code
(`~/.claude/skills`, o `$CLAUDE_CONFIG_DIR/skills` si está definida). Claude las carga en la
siguiente sesión, en cualquier proyecto.

| Orden | Qué hace |
| --- | --- |
| `node install.mjs` | instala todas, copiadas |
| `node install.mjs live-review` | solo las que se nombran |
| `node install.mjs --enlazar` | las enlaza al repositorio en vez de copiarlas: un `git pull` las actualiza (en Windows, una unión de directorio, que no pide permisos) |
| `node install.mjs --destino ../mi-proyecto/.claude/skills` | en un proyecto, en vez de en las personales |
| `node install.mjs --listar` | cómo está cada una en el destino |
| `node install.mjs --simular` | lo que haría, sin tocar nada |
| `node install.mjs --desinstalar` | quita las que instaló este script, y nada más |
| `node install.mjs --forzar` | sustituye una carpeta con el mismo nombre que no instaló este script, guardándola antes en `<destino>-respaldo/` |

**En tus propios equipos, mejor `--enlazar`**: actualizarlas es un `git pull`. **Para
llevarlas a otro sitio sin el repositorio, la copia.** Volver a ejecutar el instalador es
seguro:
- deja como está lo que ya está al día;
- actualiza sus copias;
- no pisa una carpeta que no sea suya.

**Si guardas una skill también en tu perfil de claude.ai**, Claude Code tendrá dos con el
mismo nombre: la de esta carpeta y la sincronizada. Quédate con una.

## Añadir una skill

1. Crea `skills/<nombre>/SKILL.md`. Su cabecera lleva `name` (el mismo que la carpeta, en
   minúsculas con guiones) y `description` (cuándo usarla, como mucho 1024 caracteres y sin
   `<` ni `>`).
2. Lo que la acompañe va dentro de su carpeta:
   - `assets/`, ficheros que la skill usa tal cual;
   - `scripts/`, programas que ejecuta;
   - `references/`, documentación que lee solo si le hace falta.
3. `npm test` comprueba que todas son válidas y que el instalador funciona.
4. `node install.mjs <nombre>` para probarla en tu equipo.

Las convenciones completas, para personas y para agentes, están en [`AGENTS.md`](AGENTS.md).

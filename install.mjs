#!/usr/bin/env node
/*
 * Instala las skills de este repositorio (skills/<nombre>/) en la carpeta de skills
 * personales de Claude Code, o en la que se diga. Funciona igual en macOS, Linux y
 * Windows: solo usa Node (18 o posterior) y sus módulos de serie.
 *
 *   node install.mjs                 todas, copiadas en ~/.claude/skills
 *   node install.mjs live-review     solo esa
 *   node install.mjs --ayuda         todas las opciones
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** La marca que deja una instalación por copia: así se sabe qué carpetas son de este script. */
export const MARCA = '.pa-skills.json';
const IGNORADOS = new Set([MARCA, '.DS_Store', 'Thumbs.db']);

const AYUDA = `Uso: node install.mjs [opciones] [skill...]

Instala las skills de skills/ en la carpeta de skills personales de Claude Code
(~/.claude/skills, o $CLAUDE_CONFIG_DIR/skills si está definida). Sin nombres, todas.

Opciones:
  --destino <carpeta>  instala en otra carpeta, p. ej. <proyecto>/.claude/skills
  --enlazar            enlaza en vez de copiar: un «git pull» del repositorio las actualiza
                       (en Windows, una unión de directorio, que no pide permisos)
  --forzar             sustituye una carpeta que no instaló este script; antes la guarda
                       en <destino>-respaldo/, fuera de la carpeta de skills
  --desinstalar        quita las skills que instaló este script, y nada más
  --listar             enseña las skills del repositorio y cómo están en el destino
  --simular            dice lo que haría, sin tocar nada
  -h, --ayuda          esta ayuda`;

// ------------------------------------------------------------------ dónde

/** La carpeta de skills personales de Claude Code. */
export function destinoPorOmision(entorno = process.env) {
  const base = entorno.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'skills');
}

/** La carpeta skills/ de este repositorio. */
export function origenPorOmision() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'skills');
}

// ------------------------------------------------------------------ qué hay

/** Las skills del origen, con sus problemas si los tienen. */
export function skillsDe(origen) {
  if (!fs.existsSync(origen)) return [];
  return fs
    .readdirSync(origen, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ nombre: e.name, carpeta: path.join(origen, e.name), errores: validar(path.join(origen, e.name), e.name) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Lo que Claude Code exige de una skill: su SKILL.md con name y description válidos. */
export function validar(carpeta, nombre) {
  const fichero = path.join(carpeta, 'SKILL.md');
  if (!fs.existsSync(fichero)) return ['no tiene SKILL.md'];
  const texto = fs.readFileSync(fichero, 'utf8').replace(/^﻿/, '');
  const cabecera = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!cabecera) return ['su SKILL.md no empieza por una cabecera YAML entre «---»'];
  const campo = (clave) => {
    const m = cabecera[1].match(new RegExp(`^${clave}:\\s*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^(["'])(.*)\1$/, '$2') : null;
  };
  const errores = [];
  const name = campo('name');
  const description = campo('description');
  if (!name) errores.push('su SKILL.md no tiene name');
  else if (name !== nombre) errores.push(`su name («${name}») no es el de su carpeta («${nombre}»)`);
  else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) errores.push(`su name («${name}») no va en minúsculas con guiones`);
  if (!description) errores.push('su SKILL.md no tiene description');
  else if (description.length > 1024) errores.push(`su description pasa de 1024 caracteres (${description.length})`);
  else if (/[<>]/.test(description)) errores.push('su description lleva «<» o «>»');
  return errores;
}

/** Una huella del contenido de una carpeta: sus rutas y sus bytes, sin la marca. */
export function huella(carpeta) {
  const hash = createHash('sha256');
  const recorrer = (dir, relativo) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORADOS.has(e.name)) continue;
      const ruta = path.join(dir, e.name);
      const rel = relativo ? `${relativo}/${e.name}` : e.name;
      if (e.isDirectory()) recorrer(ruta, rel);
      else if (e.isFile()) {
        hash.update(rel);
        hash.update('\0');
        // Sin el final de línea: una copia sacada en Windows con CRLF es la misma skill.
        hash.update(fs.readFileSync(ruta).toString('binary').replace(/\r\n/g, '\n'));
        hash.update('\0');
      }
    }
  };
  recorrer(carpeta, '');
  return hash.digest('hex');
}

/** Cómo está una skill en el destino. */
export function estado(skill, destino) {
  const ruta = path.join(destino, skill.nombre);
  let info;
  try {
    info = fs.lstatSync(ruta);
  } catch {
    return { tipo: 'ausente', ruta };
  }
  if (info.isSymbolicLink()) {
    let real = null;
    try {
      real = fs.realpathSync(ruta);
    } catch {
      /* un enlace roto */
    }
    const nuestro = real !== null && real === fs.realpathSync(skill.carpeta);
    return { tipo: nuestro ? 'enlace' : 'enlace-ajeno', ruta, real };
  }
  if (!info.isDirectory()) return { tipo: 'ajena', ruta, motivo: 'no es una carpeta' };
  if (fs.existsSync(path.join(ruta, MARCA))) {
    return { tipo: 'copia', ruta, alDia: huella(ruta) === huella(skill.carpeta) };
  }
  return huella(ruta) === huella(skill.carpeta) ? { tipo: 'igual-sin-marca', ruta } : { tipo: 'ajena', ruta, motivo: 'tiene otro contenido' };
}

// ------------------------------------------------------------------ hacer

function quitar(ruta) {
  const info = fs.lstatSync(ruta);
  if (info.isSymbolicLink()) {
    try {
      fs.unlinkSync(ruta);
    } catch (error) {
      // Una unión de directorio de Windows se quita como carpeta, sin entrar en ella.
      if (error.code === 'EPERM' || error.code === 'EISDIR') fs.rmdirSync(ruta);
      else throw error;
    }
  } else {
    fs.rmSync(ruta, { recursive: true, force: true });
  }
}

function copiar(skill, ruta, repositorio) {
  fs.cpSync(skill.carpeta, ruta, { recursive: true, filter: (f) => !IGNORADOS.has(path.basename(f)) });
  marcar(ruta, skill, repositorio);
}

function marcar(ruta, skill, repositorio) {
  const marca = { skill: skill.nombre, repositorio, instalada: new Date().toISOString(), huella: huella(skill.carpeta) };
  fs.writeFileSync(path.join(ruta, MARCA), JSON.stringify(marca, null, 2) + '\n');
}

function enlazar(skill, ruta) {
  // 'junction' solo cuenta en Windows: una unión no pide modo de desarrollador ni administrador.
  fs.symlinkSync(fs.realpathSync(skill.carpeta), ruta, 'junction');
}

function respaldar(ruta, destino) {
  const carpeta = `${destino.replace(/[\\/]+$/, '')}-respaldo`;
  fs.mkdirSync(carpeta, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const copia = path.join(carpeta, `${path.basename(ruta)}-${sello}`);
  fs.cpSync(ruta, copia, { recursive: true, dereference: false, verbatimSymlinks: true });
  return copia;
}

/**
 * Instala (o desinstala) las skills pedidas. Devuelve una línea por skill y si hubo
 * algún problema; no escribe nada si `simular`.
 */
export function ejecutar(opciones) {
  const {
    origen = origenPorOmision(),
    destino = destinoPorOmision(),
    nombres = [],
    enlazar: porEnlace = false,
    forzar = false,
    desinstalar = false,
    simular = false,
  } = opciones;
  const todas = skillsDe(origen);
  const lineas = [];
  let problemas = false;
  const desconocidas = nombres.filter((n) => !todas.some((s) => s.nombre === n));
  for (const n of desconocidas) {
    lineas.push(`✘ ${n}: no hay ninguna skill con ese nombre en ${origen}`);
    problemas = true;
  }
  const elegidas = nombres.length ? todas.filter((s) => nombres.includes(s.nombre)) : todas;
  if (!simular && !desinstalar) fs.mkdirSync(destino, { recursive: true });
  const repositorio = path.dirname(origen);
  const modo = porEnlace ? 'enlace' : 'copia';
  const hacer = (accion) => {
    if (!simular) accion();
  };

  for (const skill of elegidas) {
    const e = estado(skill, destino);
    const donde = e.ruta;
    if (desinstalar) {
      if (e.tipo === 'enlace' || e.tipo === 'copia') {
        hacer(() => quitar(donde));
        lineas.push(`✔ ${skill.nombre}: desinstalada (${donde})`);
      } else if (e.tipo === 'ausente') {
        lineas.push(`· ${skill.nombre}: no estaba instalada`);
      } else {
        lineas.push(`· ${skill.nombre}: ${donde} no la instaló este script; no se toca`);
      }
      continue;
    }
    if (skill.errores.length) {
      lineas.push(`✘ ${skill.nombre}: no se instala, ${skill.errores.join('; ')}`);
      problemas = true;
      continue;
    }
    if (e.tipo === 'ajena' || e.tipo === 'enlace-ajeno') {
      if (!forzar) {
        const porque = e.tipo === 'enlace-ajeno' ? `es un enlace a ${e.real ?? 'un sitio que no existe'}` : e.motivo;
        lineas.push(`✘ ${skill.nombre}: ${donde} ya existe y ${porque}; no se toca (--forzar la sustituye, guardando antes una copia)`);
        problemas = true;
        continue;
      }
      let copia = '(simulado)';
      hacer(() => {
        copia = respaldar(donde, destino);
        quitar(donde);
      });
      lineas.push(`· ${skill.nombre}: la que había, guardada en ${copia}`);
    } else if (e.tipo === 'igual-sin-marca' && modo === 'copia') {
      hacer(() => marcar(donde, skill, repositorio));
      lineas.push(`✔ ${skill.nombre}: ya estaba, igual; queda como instalada por este script (${donde})`);
      continue;
    } else if (e.tipo === 'enlace' && modo === 'enlace') {
      lineas.push(`✔ ${skill.nombre}: ya estaba enlazada (${donde})`);
      continue;
    } else if (e.tipo === 'copia' && modo === 'copia' && e.alDia) {
      lineas.push(`✔ ${skill.nombre}: ya estaba al día (${donde})`);
      continue;
    } else if (e.tipo !== 'ausente') {
      hacer(() => quitar(donde));
    }
    hacer(() => (porEnlace ? enlazar(skill, donde) : copiar(skill, donde, repositorio)));
    const verbo = e.tipo === 'ausente' ? 'instalada' : 'actualizada';
    lineas.push(`✔ ${skill.nombre}: ${verbo} (${modo}) en ${donde}`);
  }
  return { lineas, problemas };
}

/** Una línea por skill del origen, con cómo está en el destino. */
export function listar({ origen = origenPorOmision(), destino = destinoPorOmision() } = {}) {
  const textos = {
    ausente: 'no instalada',
    copia: 'instalada (copia)',
    enlace: 'instalada (enlace)',
    'igual-sin-marca': 'ya está, igual, sin marca de este script',
    ajena: 'hay otra con ese nombre',
    'enlace-ajeno': 'hay un enlace a otro sitio con ese nombre',
  };
  return skillsDe(origen).map((skill) => {
    const e = estado(skill, destino);
    let texto = textos[e.tipo];
    if (e.tipo === 'copia' && !e.alDia) texto += ', con cambios pendientes';
    if (skill.errores.length) texto += ` — no válida: ${skill.errores.join('; ')}`;
    return `${skill.nombre}: ${texto}`;
  });
}

// ------------------------------------------------------------------ la orden

export function leerArgumentos(argv) {
  const opciones = { nombres: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--destino') {
      const valor = argv[++i];
      if (!valor) throw new Error('--destino necesita una carpeta');
      opciones.destino = path.resolve(valor);
    } else if (a.startsWith('--destino=')) opciones.destino = path.resolve(a.slice('--destino='.length));
    else if (a === '--enlazar') opciones.enlazar = true;
    else if (a === '--forzar') opciones.forzar = true;
    else if (a === '--desinstalar') opciones.desinstalar = true;
    else if (a === '--listar') opciones.listar = true;
    else if (a === '--simular') opciones.simular = true;
    else if (a === '-h' || a === '--ayuda' || a === '--help') opciones.ayuda = true;
    else if (a.startsWith('-')) throw new Error(`opción desconocida: ${a}`);
    else opciones.nombres.push(a);
  }
  return opciones;
}

function main() {
  let opciones;
  try {
    opciones = leerArgumentos(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${AYUDA}`);
    process.exit(2);
  }
  if (opciones.ayuda) {
    console.log(AYUDA);
    return;
  }
  const destino = opciones.destino ?? destinoPorOmision();
  if (opciones.listar) {
    console.log(`Skills de ${origenPorOmision()}, en ${destino}:`);
    for (const linea of listar({ destino })) console.log(`  ${linea}`);
    return;
  }
  const { lineas, problemas } = ejecutar({ ...opciones, destino });
  if (opciones.simular) console.log('(simulado: no se ha tocado nada)');
  for (const linea of lineas) console.log(linea);
  if (!lineas.length) console.log('No hay skills que instalar en skills/.');
  else if (!opciones.simular && !opciones.desinstalar && !problemas) {
    console.log('Claude Code las carga en la siguiente sesión (o en la actual, si ya vigila esa carpeta).');
  }
  process.exit(problemas ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();

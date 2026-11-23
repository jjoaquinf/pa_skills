import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MARCA, destinoPorOmision, ejecutar, estado, huella, leerArgumentos, listar, skillsDe, validar } from '../install.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = path.join(RAIZ, 'skills');
const INSTALADOR = path.join(RAIZ, 'install.mjs');

let base;
let destino;

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-skills-'));
});
after(() => fs.rmSync(base, { recursive: true, force: true }));
beforeEach(() => {
  destino = fs.mkdtempSync(path.join(base, 'destino-'));
});

/** Un origen de pega con una skill, para probar lo que el repositorio real no tiene. */
function origenDePega(nombre, cabecera) {
  const origen = fs.mkdtempSync(path.join(base, 'origen-'));
  fs.mkdirSync(path.join(origen, nombre));
  fs.writeFileSync(path.join(origen, nombre, 'SKILL.md'), `---\n${cabecera}\n---\n\n# ${nombre}\n`);
  return origen;
}

describe('las skills del repositorio', () => {
  it('son válidas: cada una con su SKILL.md, su name igual a su carpeta y su description', () => {
    const skills = skillsDe(ORIGEN);
    assert.ok(skills.length > 0);
    for (const skill of skills) assert.deepEqual(skill.errores, [], `${skill.nombre}: ${skill.errores.join('; ')}`);
  });
});

describe('validar', () => {
  it('rechaza un name distinto de la carpeta, sin description o con «<»', () => {
    assert.match(validar(path.join(origenDePega('una', 'name: otra\ndescription: x'), 'una'), 'una')[0], /no es el de su carpeta/);
    assert.match(validar(path.join(origenDePega('una', 'name: una'), 'una'), 'una')[0], /no tiene description/);
    assert.match(validar(path.join(origenDePega('una', 'name: una\ndescription: a <b>'), 'una'), 'una')[0], /«<» o «>»/);
  });

  it('no instala una skill no válida, y lo dice', () => {
    const origen = origenDePega('una', 'name: otra\ndescription: x');
    const r = ejecutar({ origen, destino });
    assert.equal(r.problemas, true);
    assert.match(r.lineas[0], /✘ una: no se instala/);
    assert.equal(fs.existsSync(path.join(destino, 'una')), false);
  });
});

describe('instalar por copia', () => {
  it('copia cada skill con su marca, y una segunda vez no cambia nada', () => {
    const r = ejecutar({ origen: ORIGEN, destino });
    assert.equal(r.problemas, false);
    for (const skill of skillsDe(ORIGEN)) {
      const copia = path.join(destino, skill.nombre);
      assert.equal(huella(copia), huella(skill.carpeta));
      const marca = JSON.parse(fs.readFileSync(path.join(copia, MARCA), 'utf8'));
      assert.equal(marca.skill, skill.nombre);
      assert.equal(marca.huella, huella(skill.carpeta));
    }
    const otra = ejecutar({ origen: ORIGEN, destino });
    assert.ok(otra.lineas.every((l) => l.includes('ya estaba al día')), otra.lineas.join('\n'));
  });

  it('actualiza una copia suya que quedó atrás', () => {
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    fs.appendFileSync(path.join(destino, 'live-review', 'SKILL.md'), '\nviejo\n');
    const r = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    assert.match(r.lineas[0], /actualizada \(copia\)/);
    assert.equal(huella(path.join(destino, 'live-review')), huella(path.join(ORIGEN, 'live-review')));
  });

  it('adopta una carpeta igual que no instaló, sin tocar su contenido', () => {
    fs.cpSync(path.join(ORIGEN, 'live-review'), path.join(destino, 'live-review'), { recursive: true });
    const r = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    assert.match(r.lineas[0], /ya estaba, igual/);
    assert.ok(fs.existsSync(path.join(destino, 'live-review', MARCA)));
  });

  it('no pisa una carpeta ajena distinta; con --forzar la guarda fuera de la carpeta de skills', () => {
    fs.mkdirSync(path.join(destino, 'live-review'));
    fs.writeFileSync(path.join(destino, 'live-review', 'SKILL.md'), 'la mía\n');
    const sin = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    assert.equal(sin.problemas, true);
    assert.equal(fs.readFileSync(path.join(destino, 'live-review', 'SKILL.md'), 'utf8'), 'la mía\n');

    const con = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'], forzar: true });
    assert.equal(con.problemas, false);
    assert.equal(huella(path.join(destino, 'live-review')), huella(path.join(ORIGEN, 'live-review')));
    const respaldo = `${destino}-respaldo`;
    const [copia] = fs.readdirSync(respaldo);
    assert.match(copia, /^live-review-/);
    assert.equal(fs.readFileSync(path.join(respaldo, copia, 'SKILL.md'), 'utf8'), 'la mía\n');
    // El respaldo no está dentro de la carpeta de skills: Claude no lo carga como otra skill.
    assert.deepEqual(fs.readdirSync(destino), ['live-review']);
  });

  it('dice que no conoce una skill que no existe', () => {
    const r = ejecutar({ origen: ORIGEN, destino, nombres: ['no-existe'] });
    assert.equal(r.problemas, true);
    assert.match(r.lineas[0], /no hay ninguna skill con ese nombre/);
  });
});

describe('instalar por enlace', () => {
  it('enlaza al repositorio, y desinstalar quita el enlace sin tocar el repositorio', () => {
    const r = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'], enlazar: true });
    assert.equal(r.problemas, false, r.lineas.join('\n'));
    const ruta = path.join(destino, 'live-review');
    assert.equal(fs.lstatSync(ruta).isSymbolicLink(), true);
    assert.equal(fs.realpathSync(ruta), fs.realpathSync(path.join(ORIGEN, 'live-review')));
    assert.equal(estado({ nombre: 'live-review', carpeta: path.join(ORIGEN, 'live-review') }, destino).tipo, 'enlace');

    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'], desinstalar: true });
    assert.equal(fs.existsSync(ruta), false);
    assert.ok(fs.existsSync(path.join(ORIGEN, 'live-review', 'SKILL.md')));
  });

  it('pasa de copia a enlace y de enlace a copia', () => {
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'], enlazar: true });
    assert.equal(fs.lstatSync(path.join(destino, 'live-review')).isSymbolicLink(), true);
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    assert.equal(fs.lstatSync(path.join(destino, 'live-review')).isSymbolicLink(), false);
    assert.ok(fs.existsSync(path.join(destino, 'live-review', MARCA)));
  });
});

describe('desinstalar', () => {
  it('quita sus copias y deja las carpetas ajenas', () => {
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    const otra = path.join(destino, 'otra-skill');
    fs.mkdirSync(otra);
    ejecutar({ origen: ORIGEN, destino, desinstalar: true });
    assert.equal(fs.existsSync(path.join(destino, 'live-review')), false);
    assert.ok(fs.existsSync(otra));

    const ajena = path.join(destino, 'live-review');
    fs.mkdirSync(ajena);
    fs.writeFileSync(path.join(ajena, 'SKILL.md'), 'la mía\n');
    const r = ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'], desinstalar: true });
    assert.match(r.lineas[0], /no la instaló este script/);
    assert.ok(fs.existsSync(ajena));
  });
});

describe('simular, listar y la orden', () => {
  it('simular no toca nada', () => {
    const r = ejecutar({ origen: ORIGEN, destino, simular: true });
    assert.ok(r.lineas.length > 0);
    assert.deepEqual(fs.readdirSync(destino), []);
  });

  it('listar dice cómo está cada una', () => {
    assert.match(listar({ origen: ORIGEN, destino })[0], /no instalada/);
    ejecutar({ origen: ORIGEN, destino, nombres: ['live-review'] });
    assert.ok(listar({ origen: ORIGEN, destino }).some((l) => l === 'live-review: instalada (copia)'));
  });

  it('el destino por omisión es el de Claude Code, o el de CLAUDE_CONFIG_DIR', () => {
    assert.equal(destinoPorOmision({}), path.join(os.homedir(), '.claude', 'skills'));
    assert.equal(destinoPorOmision({ CLAUDE_CONFIG_DIR: path.join(base, 'conf') }), path.join(base, 'conf', 'skills'));
  });

  it('lee sus opciones y rechaza las que no conoce', () => {
    const o = leerArgumentos(['--destino', 'x', '--enlazar', 'live-review']);
    assert.equal(o.destino, path.resolve('x'));
    assert.equal(o.enlazar, true);
    assert.deepEqual(o.nombres, ['live-review']);
    assert.throws(() => leerArgumentos(['--nada']), /opción desconocida/);
  });

  it('desde la línea de órdenes instala y sale con 0, y con 2 ante una opción desconocida', () => {
    const salida = execFileSync(process.execPath, [INSTALADOR, '--destino', destino], { encoding: 'utf8' });
    assert.match(salida, /✔ live-review: instalada \(copia\)/);
    assert.throws(() => execFileSync(process.execPath, [INSTALADOR, '--nada'], { stdio: 'pipe' }), (e) => e.status === 2);
  });
});

#!/usr/bin/env node
// CLI del navegador para agentes. Todas las salidas son JSON en stdout;
// los errores van como JSON con ok:false y código de salida != 0.
//
//   ab open <url>                 navega y devuelve snapshot inmediato
//   ab snapshot [--interactive]   accessibility tree compacta con refs (e1, e2…)
//   ab text                       texto plano de la página
//   ab click <ref>                clic sobre un ref del último snapshot
//   ab fill <ref> <texto> [--submit]
//   ab select <ref> <valores...>
//   ab check|uncheck <ref>
//   ab press <tecla>              p.ej. Enter, Tab, Control+a
//   ab scroll <up|down|top|bottom> [px]
//   ab eval <js>                  ejecuta JS en la página, resultado serializado
//   ab shot [archivo]             screenshot fullPage
//   ab preview [archivo.jpg]      captura la vista previa actual (con cursor) y la guarda
//   ab images [--min-px N]        lista las imágenes de la página (con refs)
//   ab save <ref|url> [-o nombre] guarda una imagen (o archivo) en downloads/
//   ab imgsearch "<query>" [-n N] busca imágenes (DuckDuckGo) y guarda N
//   ab fetch <url> [-o nombre]    descarga arbitraria respetando la sesión
//   --- navegación humana (ratón/teclado realistas para anti-bots) ---
//   ab mmove <x> <y>              mueve el cursor con trayectoria Bezier
//   ab clickh <ref|x> [y]         clic humano (--right --double, --at x y)
//   ab hover <ref|x> [y]          pasa el ratón (revela overlays)
//   ab drag <de> <a>              arrastrar de ref/coord a ref/coord
//   ab wheel <dy>                 rueda con inercia (scroll suave)
//   ab typetext <ref|"texto">     teclea tecla a tecla (--wpm N --mistakes)
//   ab keys <k1+k2...>            combo realista (p.ej. Control+s)
//   ab dclick <ref|url>           clic + captura evento download del navegador
//   ab gesture <nombre>           reveal-lazy | accept-cookies
//   ab stealth on|off             fingerprint anti-detección (requiere reinicio)
//   ab back | forward | status | logs [--errors] | state | close
//   ab serve [puerto]             arranca el servidor HTTP/WS para agentes remotos
//   ab help                       catálogo de operaciones en JSON (para leerlo un LLM)

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const statePath = () => process.env.AB_STATE || path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'state.json');

const HELP = {
  protocol: 'agent-browser/1',
  output: 'stdout siempre JSON; exit code 0 si ok:true, 1 si ok:false',
  workflow: [
    '1. ab open <url> o ab goto <url>',
    '2. ab snapshot -> obtén refs tipo e12 (cada ref incluye at=(x,y))',
    '3. para sitios con anti-bot usa gestos humanos: ab clickh e12 / ab typetext e3 "texto"',
    '4. repite snapshot tras cada navegación',
  ],
  humanMode: {
    why: 'los repositorios de imágenes suelen bloquear clics instantáneos de bot; mouse_move con trayectoria bezier + tiempos de reacción imitan a una persona',
    targetSyntax: 'cualquier <target> acepta un ref del snapshot (e12) o coordenadas x y del viewport (campo at= del snapshot)',
    tips: [
      'ab gesture reveal-lazy antes de ab images en páginas con lazy-loading',
      'ab hover <ref> revela overlays de descarga ocultos hasta el hover',
      'AB_FINGERPRINT=stealth suaviza navigator.webdriver/UA antes de lanzar',
      'ab dclick <ref> captura el evento download real del navegador (POST/blob incluidos)',
    ],
  },
  commands: {
    open: { args: ['url'], desc: 'navega y muestra snapshot interactivo' },
    goto: { args: ['url'], desc: 'navega sin snapshot' },
    snapshot: { flags: ['--interactive'], desc: 'accessibility tree con refs estables por sesión' },
    text: { desc: 'innerText truncado a 40k chars' },
    click: { args: ['ref'] },
    fill: { args: ['ref', 'texto'], flags: ['--submit'] },
    select: { args: ['ref', 'valor...'] },
    check: { args: ['ref'] }, uncheck: { args: ['ref'] },
    press: { args: ['tecla playwright'] },
    scroll: { args: ['up|down|top|bottom', 'px?'] },
    eval: { args: ['javascript'], desc: 'se envuelve en IIFE; devuelve result' },
    shot: { args: ['ruta?'], default: './shot.png' },
    images: { flags: ['--min-px N'], desc: 'lista imágenes de la página (src, alt, dimensiones, enlace de origen)' },
    save: { args: ['ref|url'], flags: ['-o nombre', '--dir ruta'], desc: 'descarga una imagen (acepta refs del snapshot) a downloads/ usando cookies de la sesión' },
    imgsearch: { args: ['"query"'], flags: ['-n N', '--dir ruta'], desc: 'busca imágenes en DuckDuckGo y guarda las N primeras; flujo completo en 1 comando' },
    fetch: { args: ['url'], flags: ['-o nombre', '--dir ruta'], desc: 'descarga cualquier archivo respetando la sesión del navegador' },
    mmove: { args: ['x', 'y'], desc: 'mueve el ratón con trayectoria bezier humana hasta coordenadas del viewport' },
    clickh: { args: ['ref|x [y]'], flags: ['--right', '--double', '--at x y'], desc: 'clic humano: mueve el cursor en arco, espera reacción, pulsa y suelta con timing variable' },
    hover: { args: ['ref|x [y]'], desc: 'pasa el ratón sobre un ref/coordenada y deja que se asiente (revela overlays)' },
    drag: { args: ['de', 'a'], desc: 'arrastrar entre refs o coordenadas con trayectoria real' },
    wheel: { args: ['dy'], desc: 'rueda del ratón con inercia decreciente (scroll suave anti-bot)' },
    typetext: { args: ['ref|"texto"'], flags: ['--wpm N', '--mistakes'], desc: 'teclea tecla a tecla con cadencia irregular; opcional errores corregidos' },
    keys: { args: ['Control+s'], desc: 'combo de teclas con tiempos humanos (down...up invertido)' },
    dclick: { args: ['ref|url'], flags: ['-o nombre', '--dir ruta'], desc: 'clic humano y captura el evento download del navegador (funciona con POST/blob)' },
    gesture: { args: ['reveal-lazy|accept-cookies'], desc: 'macros: scroll suave que monta imágenes lazy / acepta banner de cookies con clic humano' },
    stealth: { args: ['on|off'], desc: 'activa fingerprint anti-detección en el próximo lanzamiento (navigator.webdriver, UA, locale)' },
    back: {}, forward: {}, status: {},
    logs: { flags: ['--errors'], desc: 'consola + peticiones fallidas' },
    state: { desc: 'guarda cookies en state.json (persistencia de sesiones)' },
    close: { desc: 'cierra el navegador' },
    serve: { args: ['puerto?'], desc: 'API REST + WebSocket para agentes' },
  },
};

function out(obj, code = obj.ok === false ? 1 : 0) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exitCode = code;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  // parseo de flags con valor: --dir ruta, -o nombre, -n 3, --min-px 400
  const opts = {};
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') opts.name = argv[++i];
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '-n') opts.n = Number(argv[++i]) || 1;
    else if (a === '--min-px') opts.minPx = Number(argv[++i]) || 0;
    else if (a.startsWith('--')) opts[a.slice(2)] = true;
    else positional.push(a);
  }
  const rest = positional;
  const flags = new Set(Object.keys(opts).map((k) => '--' + k));

  if (!cmd || cmd === 'help') return out({ ok: true, ...HELP });

  if (cmd === 'serve') {
    process.argv = [process.argv[0], process.argv[1], ...(rest[0] ? [rest[0]] : [])];
    await import('./server.js');
    return; // el servidor mantiene el proceso vivo
  }

  const { AgentBrowser } = await import('./core/browser.js');
  const b = new AgentBrowser();

  try {
    switch (cmd) {
      case 'open': {
        if (!rest[0]) throw new Error('falta <url>');
        const nav = await b.goto(rest[0]);
        const snap = await b.snapshot({ interactive: flags.has('--full') ? false : true });
        return out({ ...nav, ...snap });
      }
      case 'goto':     return out(await b.goto(rest[0]));
      case 'snapshot': return out(await b.snapshot({ interactive: flags.has('--interactive') }));
      case 'text':     return out(await b.text());
      case 'click':    return out(await b.click(rest[0]));
      case 'fill':     return out(await b.fill(rest[0], rest.slice(1).join(' '), { submit: flags.has('--submit') }));
      case 'select':   return out(await b.select(rest[0], rest.slice(1)));
      case 'check':    return out(await b.check(rest[0], true));
      case 'uncheck':  return out(await b.check(rest[0], false));
      case 'press':    return out(await b.press(rest[0]));
      case 'scroll':   return out(await b.scroll(rest[0] || 'down', Number(rest[1]) || 600));
      case 'eval':     return out(await b.eval(rest.join(' ')));
      case 'shot':     return out(await b.screenshot(rest[0] || 'shot.png'));
      case 'preview': {
        const f = await b.grabPreview({});
        if (rest[0]) { fs.writeFileSync(rest[0], Buffer.from(f.jpeg, 'base64')); return out({ ok: true, path: rest[0], url: f.url }); }
        delete f.jpeg; return out({ ...f, note: 'el monitor humano muestra esto en vivo en http://localhost:8737/' });
      }
      case 'images': {
        const r = await b.images({ minArea: (opts.minPx || 0) ** 2 });
        if (flags.has('--big')) { r.images = r.images.filter((i) => (i.w * i.h) >= 40000); r.count = r.images.length; }
        return out(r);
      }
      case 'save': {
        if (!rest[0]) throw new Error('falta <ref|url> — p.ej. ab save e7 o ab save https://…/img.png -o gato');
        return out(await b.saveImage(rest[0], { name: opts.name, dir: opts.dir }));
      }
      case 'imgsearch': {
        if (!rest[0]) throw new Error('falta "<query>"');
        return out(await b.searchImages(rest.join(' '), { save: opts.n ?? 0, dir: opts.dir }));
      }
      case 'fetch': {
        if (!rest[0]) throw new Error('falta <url>');
        return out(await b.download(rest[0], { name: opts.name, dir: opts.dir }));
      }
      // ---- navegación humana ----
      case 'mmove': {
        const [x, y] = rest.map(Number);
        if (!(Number.isFinite(x) && Number.isFinite(y))) throw new Error('uso: ab mmove <x> <y>');
        return out(await b.mouseMove(x, y, { steps: opts.steps ? Number(opts.steps) : null }));
      }
      case 'clickh': {
        // acepta: clickh e12 | clickh 400 300 | clickh --at 400 300
        let target = rest[0], x = null, y = null;
        if (flags.has('--at')) { x = Number(rest[0]); y = Number(rest[1]); target = null; }
        else if (rest.length >= 2 && !/^e\d+$/.test(rest[0])) { x = Number(rest[0]); y = Number(rest[1]); target = null; }
        return out(await b.humanClick(target ?? { x, y }, {
          button: flags.has('--right') ? 'right' : 'left',
          double: flags.has('--double'),
        }));
      }
      case 'hover': {
        let target = rest[0];
        if (rest.length >= 2 && !/^e\d+$/.test(rest[0])) target = { x: Number(rest[0]), y: Number(rest[1]) };
        return out(await b.hover(target));
      }
      case 'drag': {
        if (rest.length < 2) throw new Error('uso: ab drag <ref|coord> <ref|coord>');
        const pt = (s, i) => (/^e\d+$/.test(s) ? s : undefined);
        const parse = (tok, next) => {
          if (/^e\d+$/.test(tok)) return tok;
          const x = Number(tok), y = Number(next);
          if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
          throw new Error(`target inválido: ${tok}`);
        };
        const from = parse(rest[0], rest[1]);
        const toIdx = /^e\d+$/.test(rest[0]) ? 1 : (typeof from === 'object' ? 2 : 1);
        const to = parse(rest[toIdx], rest[toIdx + 1]);
        return out(await b.drag(from, to));
      }
      case 'wheel': {
        const dy = Number(rest[0]);
        if (!Number.isFinite(dy)) throw new Error('uso: ab wheel <dy>  (positivo=abajo)');
        return out(await b.wheel(dy));
      }
      case 'typetext': {
        if (!rest[0]) throw new Error('uso: ab typetext <ref|"texto"> o ab typetext "texto" eN');
        let ref = null, text;
        if (/^e\d+$/.test(rest[0])) { ref = rest[0]; text = rest.slice(1).join(' '); }
        else { text = rest.join(' '); }
        if (!text) throw new Error('falta el texto a teclear');
        return out(await b.typeText(text, { ref, wpm: opts.wpm ? Number(opts.wpm) : 120, mistakes: flags.has('--mistakes') }));
      }
      case 'keys': {
        if (!rest[0]) throw new Error('uso: ab keys Control+s');
        return out(await b.keyCombo(rest[0]));
      }
      case 'dclick': {
        if (!rest[0]) throw new Error('uso: ab dclick <ref|url> [-o nombre]');
        return out(await b.clickToDownload(rest[0], { name: opts.name, dir: opts.dir }));
      }
      case 'gesture': {
        if (!rest[0]) throw new Error('uso: ab gesture <reveal-lazy|accept-cookies>');
        return out(await b.gesture(rest[0]));
      }
      case 'stealth': {
        // persiste la preferencia en state.json para que launch() la lea
        const on = rest[0] !== 'off';
        process.env.AB_FINGERPRINT = on ? 'stealth' : '';
        try {
          const st = fs.existsSync(statePath()) ? JSON.parse(fs.readFileSync(statePath(), 'utf8')) : {};
          st.fingerprint = on ? 'stealth' : null;
          fs.writeFileSync(statePath(), JSON.stringify(st, null, 2));
        } catch { /* sin estado aún */ }
        return out({ ok: true, action: 'stealth', enabled: on, note: 'se aplica al próximo lanzamiento del navegador' });
      }
      case 'back':     return out(await b.back());
      case 'forward':  return out(await b.forward());
      case 'status':   return out({ ok: true, running: !!b.page });
      case 'logs':     return out({ ok: true, ...b.logs({ errorsOnly: flags.has('--errors') }) });
      case 'state':    return out(await b.saveState());
      case 'close':    return out(await b.close());
      default:
        return out({ ok: false, error: `comando desconocido: ${cmd}`, hint: 'ejecuta: ab help' });
    }
  } catch (e) {
    return out({ ok: false, command: cmd, error: String(e.message || e) });
  } finally {
    if (cmd !== 'serve') await b.close().catch(() => {});
  }
}

// preserva el exitCode marcado por out() incluso tras operaciones async del finally
main().then(() => { if (process.exitCode) process.exit(process.exitCode); });

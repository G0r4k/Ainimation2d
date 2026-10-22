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
//   ab back | forward | status | logs [--errors] | state | close
//   ab serve [puerto]             arranca el servidor HTTP/WS para agentes remotos
//   ab help                       catálogo de operaciones en JSON (para leerlo un LLM)

import process from 'node:process';

const HELP = {
  protocol: 'agent-browser/1',
  output: 'stdout siempre JSON; exit code 0 si ok:true, 1 si ok:false',
  workflow: [
    '1. ab open <url> o ab goto <url>',
    '2. ab snapshot -> obtén refs tipo e12',
    '3. ab click e12 / ab fill e3 "texto" --submit',
    '4. repite snapshot tras cada navegación',
  ],
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
  const rest = argv.slice(1).filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--')));

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

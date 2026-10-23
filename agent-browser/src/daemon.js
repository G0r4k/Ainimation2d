// Daemon persistente: mantiene el navegador vivo entre llamadas para que los
// refs (e1, e2...) de un snapshot sigan siendo válidos en la siguiente acción.
// Escucha un JSON-RPC por línea en stdin y responde por stdout.
//
//   echo '{"id":1,"op":"goto","args":["https://example.com"]}' | node src/daemon.js
// o interactivo:  node src/daemon.js   (y escribir comandos por stdin)

import readline from 'node:readline';
import { AgentBrowser } from './core/browser.js';

const browser = new AgentBrowser();
const rl = readline.createInterface({ input: process.stdin });
const ALLOWED = ['goto','snapshot','text','click','fill','select','check','press','scroll','eval','screenshot','back','forward','saveState','logs','close','images','saveImage','searchImages','download','resolveRef','mouseMove','humanClick','hover','drag','wheel','typeText','keyCombo','clickToDownload','gesture','grabPreview','startPreviewLoop','stopPreviewLoop'];

// cola serial: los comandos se ejecutan en el orden recibido (crítico para que
// un snapshot complete antes del click que usa sus refs)
let queue = Promise.resolve();

function handle(line) {
  let msg; try { msg = JSON.parse(line); } catch { return console.log(JSON.stringify({ ok: false, error: 'JSON inválido' })); }
  if (!ALLOWED.includes(msg.op)) return console.log(JSON.stringify({ id: msg.id, ok: false, error: `op no permitida: ${msg.op}`, allowed: ALLOWED }));
  // Promise.resolve envuelve las ops síncronas (logs) para unificar el manejo de errores
  return Promise.resolve()
    .then(() => browser[msg.op](...(msg.args || [])))
    .then((result) => console.log(JSON.stringify({ id: msg.id, ok: true, result })))
    .catch((e) => console.log(JSON.stringify({ id: msg.id, ok: false, error: String(e.message || e) })));
}

rl.on('line', (line) => { queue = queue.then(() => handle(line)); });
rl.on('close', () => { queue.then(async () => { await browser.close(); process.exit(process.exitCode || 0); }); });
process.on('SIGTERM', async () => { await browser.close(); process.exit(0); });

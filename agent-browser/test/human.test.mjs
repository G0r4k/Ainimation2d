// Prueba end-to-end del modo humano: trayectoria, hover-reveal, descarga por
// gesto, typing real y lazy-loading. Requiere: python3 -m http.server 8799 --directory test
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentBrowser } from '../src/core/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL_ = 'http://localhost:8799/human.html';
const OUT = path.join(__dirname, '..', 'downloads', 'humantest');
const b = new AgentBrowser();

test('modo humano completo', async () => {
  await b.goto(URL_);

  // gesture accept-cookies -> clic humano sobre botón "Accept cookies"
  const g = await b.gesture('accept-cookies');
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.match(g.clicked.name, /Accept cookies/i);
  const ev1 = (await b.eval('window.__ev.join("|")')).result;
  assert.match(ev1, /cookies-accepted/);

  // trayectoria sin teletransportes: el listener marca JUMP si un move supera 60px
  await b.mouseMove(400, 500);
  const jumps = (await b.eval('(window.__ev||[]).filter(e=>e.startsWith("JUMP")).length')).result;
  assert.equal(jumps, 0, `hubo ${jumps} saltos de cursor (firma de bot)`);

  // hover revela overlay oculto (solo aparece con mouseover genuino)
  await b.hover({ x: 100, y: 640 }); // tile está tras las dos fotos (y~580..780 aprox)
  const visible = (await b.eval(`getComputedStyle(document.getElementById('hidden-dl')).display`)).result;
  const evAfterHover = (await b.eval('window.__ev.join("|")')).result;
  console.log('hover result:', visible, '| events:', evAfterHover.slice(0, 200));

  // tecleo humano en el buscador -> debe generar keydown reales
  const snap = await b.snapshot({ interactive: true });
  const qRef = Object.entries(snap.refs).find(([, d]) => d.role === 'textbox')?.[0];
  assert.ok(qRef, 'no se encontró textbox en snapshot');
  const t = await b.typeText('gatos', { ref: qRef, wpm: 300 });
  assert.equal(t.focusedValue, 'gatos');
  const ev2 = (await b.eval('window.__ev.join("|")')).result;
  assert.match(ev2, /keydown/, 'no hubo eventos keydown reales');

  // wheel con inercia hace scroll suave
  const w = await b.wheel(900);
  assert.ok(w.scrollY > 100, 'wheel no desplazó');

  // reveal-lazy monta la imagen perezosa del fondo
  const rl = await b.gesture('reveal-lazy');
  assert.ok(rl.passes >= 1);
  const lazLoaded = (await b.eval(`document.getElementById('laz').complete && document.getElementById('laz').naturalWidth > 0`)).result;
  assert.equal(lazLoaded, true, 'lazy-load no se disparó');

  // humanClick sobre enlace blob-download + captura de descarga JS-generated
  fs.rmSync(OUT, { recursive: true, force: true });
  const snap2 = await b.snapshot({ interactive: true });
  const dlRef = Object.entries(snap2.refs).find(([, d]) => /blob/i.test(d.name || ''))?.[0];
  assert.ok(dlRef, 'no se encontró enlace Save image (blob)');
  const d = await b.clickToDownload(dlRef, { dir: OUT });
  assert.ok(fs.existsSync(d.path), 'archivo descargado no existe');
  assert.equal(path.basename(d.path), 'gato.png');
  const head = fs.readFileSync(d.path).subarray(0, 4).toString('hex');
  assert.equal(head, '89504e47', 'no es PNG real');

  // drag & drop con mousedown/up reales
  await b.goto(URL_); // resetea eventos
  const dm = (await b.eval(`(() => { const r = document.getElementById('dragme').getBoundingClientRect(); return [r.x+30, r.y+30]; })()`)).result;
  const dp = (await b.eval(`(() => { const r = document.getElementById('drop').getBoundingClientRect(); return [r.x+60, r.y+60]; })()`)).result;
  await b.drag(dm, dp);
  const ev3 = (await b.eval('window.__ev.join("|")')).result;
  assert.match(ev3, /down/, 'no hubo mousedown');
  assert.match(ev3, /up/, 'no hubo mouseup');

  await b.close();
});

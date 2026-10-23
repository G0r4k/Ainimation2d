// Servidor de control del navegador.
// - Para AGENTES: API REST JSON en /api/* (y WebSocket en /ws con el mismo protocolo).
// - Para HUMANOS: una página mínima en / que muestra el stream de acciones,
//   deliberadamente austera: sin barra de direcciones decorativa, solo estado crudo.
//
// Uso: node src/server.js [puerto]   (por defecto 8737)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { AgentBrowser } from './core/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.AB_PORT || 8737);
const browser = new AgentBrowser();
const history = []; // últimas acciones ejecutadas, visibles en la UI humana

function record(entry) {
  const e = { ...entry, at: new Date().toISOString() };
  history.push(e);
  if (history.length > 100) history.shift();
  // notificar a los monitores humanos conectados (acción + frame fresco)
  for (const ws of browser.previewClients) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'action', action: e }));
  }
  browser._previewTick();
}

async function handleApi(req, res, url) {
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj, null, 2));
  };
  const body = await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
  const route = url.pathname.replace(/^\/api\//, '');
  try {
    switch (route) {
      case 'goto':       { const r = await browser.goto(body.url, body); record({ action: 'goto', url: body.url, result: r.ok }); return send(200, r); }
      case 'snapshot':   { const r = await browser.snapshot(body); return send(200, r); }
      case 'text':       { const r = await browser.text(); return send(200, r); }
      case 'click':      { const r = await browser.click(body.ref, body); record({ action: 'click', ref: body.ref, result: r.url }); return send(200, r); }
      case 'fill':       { const r = await browser.fill(body.ref, String(body.value ?? ''), body); record({ action: 'fill', ref: body.ref, value: body.value }); return send(200, r); }
      case 'select':     { const r = await browser.select(body.ref, body.values ?? body.value); record({ action: 'select', ref: body.ref }); return send(200, r); }
      case 'check':      { const r = await browser.check(body.ref, body.checked !== false); record({ action: 'check', ref: body.ref }); return send(200, r); }
      case 'press':      { const r = await browser.press(body.key); record({ action: 'press', key: body.key }); return send(200, r); }
      case 'scroll':     { const r = await browser.scroll(body.dir, body.amount); return send(200, r); }
      case 'eval':       { const r = await browser.eval(body.code || ''); return send(200, r); }
      case 'screenshot': { const r = await browser.screenshot(body.path || path.join(__dirname, '..', 'shot.png')); return send(200, r); }
      case 'images':     { const r = await browser.images({ minArea: (Number(body.minPx) || 0) ** 2 }); return send(200, r); }
      case 'save_image': { const r = await browser.saveImage(body.target, body); record({ action: 'save_image', target: body.target, path: r.path }); return send(200, r); }
      case 'imgsearch':  { const r = await browser.searchImages(String(body.query || ''), body); record({ action: 'imgsearch', query: body.query, saved: r.saved?.length }); return send(200, r); }
      case 'fetch':      { const r = await browser.download(body.url, body); record({ action: 'fetch', url: body.url, path: r.path }); return send(200, r); }
      case 'resolve':    { return send(200, await browser.resolveRef(body.ref)); }
      // ---- navegación humana (ratón/teclado realistas) ----
      case 'mouse_move':  { const r = await browser.mouseMove(Number(body.x), Number(body.y), body); record({ action: 'mouse_move', to: [body.x, body.y] }); return send(200, r); }
      case 'human_click': { const r = await browser.humanClick(body.ref ?? body.target ?? body, body); record({ action: 'human_click', target: body.ref || body.target || [body.x, body.y], result: r.url }); return send(200, r); }
      case 'hover':       { const r = await browser.hover(body.ref ?? body); record({ action: 'hover', target: body.ref ?? [body.x, body.y] }); return send(200, r); }
      case 'drag':        { return send(200, await browser.drag(body.from, body.to, body)); }
      case 'wheel':       { return send(200, await browser.wheel(Number(body.dy) || 0, body)); }
      case 'type':        { const r = await browser.typeText(String(body.text ?? ''), body); record({ action: 'type', ref: body.ref, chars: String(body.text ?? '').length }); return send(200, r); }
      case 'keys':        { return send(200, await browser.keyCombo(body.keys)); }
      case 'dclick':      { const r = await browser.clickToDownload(body.target ?? body.ref, body); record({ action: 'dclick', target: body.target || body.ref, path: r.path }); return send(200, r); }
      case 'gesture':     { const r = await browser.gesture(body.name, body.arg); record({ action: 'gesture', name: body.name }); return send(200, r); }
      case 'back':       { return send(200, await browser.back()); }
      case 'forward':    { return send(200, await browser.forward()); }
      case 'logs':       { return send(200, browser.logs(body)); }
      case 'state':      { return send(200, await browser.saveState()); }
      case 'status':     { return send(200, { running: !!browser.page, url: browser.page?.url() ?? null, actions: history.length, previewClients: browser.previewClients.size }); }
      // ---- vista previa (consumida por el monitor humano; también útil a agentes) ----
      case 'preview':    { const f = await browser.grabPreview(body); delete f.jpeg; return send(200, { ...f, hasFrame: !!browser.previewFrame }); }
      case 'preview_frame': {
        const f = browser.previewFrame || (await browser.grabPreview(body));
        if (body.raw === true || url.searchParams.get('raw') === '1') {
          res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
          return res.end(Buffer.from(f.jpeg, 'base64'));
        }
        return send(200, f);
      }
      case 'preview_loop':  { return send(200, body.on === false ? browser.stopPreviewLoop() : browser.startPreviewLoop(Number(body.fps) || 2)); }
      case 'close':      { record({ action: 'close' }); return send(200, await browser.close()); }
      default:           { return send(404, { ok: false, error: `ruta desconocida: /api/${route}` }); }
    }
  } catch (e) {
    return send(500, { ok: false, error: String(e.message || e) });
  }
}

const UI_HTML = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/' ) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(UI_HTML);
  }
  if (url.pathname === '/preview.jpg') { // snapshot JPEG directo para humanos (<img>)
    try {
      const f = await browser.grabPreview({});
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
      return res.end(Buffer.from(f.jpeg, 'base64'));
    } catch (e) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      return res.end(String(e.message || e));
    }
  }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404); res.end('not found');
});

// WebSocket: los agentes pueden mantener sesión persistente y recibir eventos.
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const isMonitor = new URL(req.url, 'http://x').searchParams.get('monitor') === '1';
  if (isMonitor) {
    // ---- canal del monitor humano: solo lectura, recibe frames + acciones ----
    browser.previewClients.add(ws);
    ws.send(JSON.stringify({ event: 'hello', role: 'monitor' }));
    if (browser.previewFrame) ws.send(JSON.stringify({ event: 'preview', ...browser.previewFrame }));
    ws.on('close', () => browser.previewClients.delete(ws));
    return;
  }
  ws.send(JSON.stringify({ event: 'hello', protocol: 'agent-browser/1', endpoints: ['/api/*', '/ws'] }));
  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return ws.send(JSON.stringify({ ok: false, error: 'JSON inválido' })); }
    try {
      const fn = browser[msg.op];
      if (!fn) return ws.send(JSON.stringify({ id: msg.id, ok: false, error: `op desconocida: ${msg.op}` }));
      const result = await fn.call(browser, ...(msg.args || []));
      record({ action: msg.op, ref: msg.args?.[0] });
      ws.send(JSON.stringify({ id: msg.id, ok: true, result }));
    } catch (e) {
      ws.send(JSON.stringify({ id: msg.id, ok: false, error: String(e.message || e) }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(JSON.stringify({
    agent_browser: 'listo',
    api: `http://127.0.0.1:${PORT}/api/`,
    human_ui: `http://127.0.0.1:${PORT}/`,
    ws: `ws://127.0.0.1:${PORT}/ws`,
    note: 'La UI humana es intencionadamente mínima: el interfaz primario es la API.',
  }));
});

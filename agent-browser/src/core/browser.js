// Núcleo del navegador: envuelve Playwright y expone operaciones de alto nivel
// con resultados JSON listos para agentes. Toda acción devuelve además un
// "delta" (url, título, nº de refs) para que el agente sepa si cambió algo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SNAPSHOT_SCRIPT, selectorForRef } from './snapshot.js';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const STATE_PATH = process.env.AB_STATE || path.join(ROOT, 'state.json');
// Directorio de artefactos descargados por el agente (imágenes, etc.)
const DOWNLOADS_DIR = process.env.AB_DOWNLOADS || path.join(ROOT, 'downloads');

// extensiones de imagen conocidas -> mapeo a content-type para sniffing
const IMG_EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
};
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico',
};

function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  const s = (n, len) => buf.subarray(n, n + len).toString('latin1');
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (s(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (s(0, 6) === 'GIF89A' || s(0, 6) === 'GIF87a') return 'image/gif';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  if (s(4, 4) === 'ftyp' && ['avif', 'avis'].includes(s(8, 4))) return 'image/avif';
  if (s(0, 2) === 'BM') return 'image/bmp';
  const head = s(0, 256).replace(/\s+/g, '');
  if (head.startsWith('<?xml') && head.includes('<svg')) return 'image/svg+xml';
  if (head.startsWith('<svg')) return 'image/svg+xml';
  return null;
}

function extFromUrl(u) {
  try {
    const p = decodeURIComponent(new URL(u, 'http://localhost').pathname);
    const m = p.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (m) {
      const e = m[1].toLowerCase();
      if (IMG_EXT_MIME[e]) return e;
    }
  } catch { /* url relativa rara */ }
  return null;
}

// slug seguro para nombres de archivo derivados de queries/títulos
export function slugify(s, max = 48) {
  return String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase()
    .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'img';
}

export class AgentBrowser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.consoleLog = [];
    this.netLog = [];
    // vista previa en vivo (monitor humano)
    this.previewClients = new Set();   // sockets WS del monitor
    this.previewFrame = null;          // último frame capturado
    this.previewMinIntervalMs = 400;   // rate-limit de captura por eventos
    this._mouse = { x: 0, y: 0 };      // posición lógica del cursor del agente
  }

  async launch({ headless = true } = {}) {
    if (this.browser) return;
    const executablePath = process.env.AB_BROWSER_PATH || undefined;
    // stealth anti-bot: un navegador headless "de fábrica" delata ser automation.
    // Se activa con AB_FINGERPRINT=stealth o `ab stealth on` (persistido en state.json).
    let fingerprint = process.env.AB_FINGERPRINT === 'stealth';
    try {
      if (!fingerprint && fs.existsSync(STATE_PATH)) {
        fingerprint = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')).fingerprint === 'stealth';
      }
    } catch { /* estado corrupto */ }
    this.browser = await chromium.launch({
      headless,
      executablePath,
      args: [
        '--no-sandbox', '--disable-dev-shm-usage',
        ...(fingerprint ? ['--disable-blink-features=AutomationControlled'] : []),
      ],
    });
    const ctx = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      ...(fingerprint ? {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'UTC',
      } : {}),
    });
    if (fingerprint) {
      await ctx.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }
    this.ctx = ctx;
    // restaurar cookies si existen
    try {
      if (fs.existsSync(STATE_PATH)) {
        const st = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        if (st.cookies?.length) await ctx.addCookies(st.cookies);
      }
    } catch { /* estado corrupto: ignorar */ }
    this.page = await ctx.newPage();
    this.page.on('console', (m) => {
      this.consoleLog.push({ type: m.type(), text: m.text().slice(0, 500), at: Date.now() });
      if (this.consoleLog.length > 200) this.consoleLog.shift();
    });
    this.page.on('response', (r) => {
      this.netLog.push({ url: r.url(), status: r.status(), method: r.request().method() });
      if (this.netLog.length > 300) this.netLog.shift();
    });
    this._attachPreview(this.page);
    // si el agente abre nuevas pestañas, también se les engancha la transmisión
    ctx.on('page', (p) => this._attachPreview(p));
  }

  // ---- vista previa en vivo (para el monitor humano) ----
  // Inyecta un cursor sintético + captura frames JPEG a bajo fps y los expone
  // en this.previewFrame. El servidor los reenvía al /ws de la UI humana.
  _attachPreview(page) {
    page.on('requestfinished', () => this._previewTick());
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) this._previewTick(); });
  }

  _previewTick() {
    if (!this.previewClients || !this.previewClients.size) return;
    const now = Date.now();
    if (now - (this._lastPreviewAt || 0) < this.previewMinIntervalMs) return;
    this._lastPreviewAt = now;
    this.grabPreview().catch(() => {});
  }

  async _injectCursor(page) {
    try {
      await page.addStyleTag({
        content: `#ab-cursor{position:fixed;z-index:2147483647;width:14px;height:14px;` +
          `margin:-7px 0 0 -7px;border-radius:50%;background:rgba(255,64,64,.55);` +
          `border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.6);pointer-events:none;}` +
          `#ab-cursor.ab-down{background:rgba(64,160,255,.75);transform:scale(1.6);}`,
      });
      await page.evaluate(() => {
        if (document.getElementById('ab-cursor')) return;
        const c = document.createElement('div');
        c.id = 'ab-cursor';
        c.style.left = '-100px'; c.style.top = '-100px';
        document.documentElement.appendChild(c);
        addEventListener('mousemove', (e) => {
          c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
        }, true);
        addEventListener('mousedown', () => c.classList.add('ab-down'), true);
        addEventListener('mouseup', () => c.classList.remove('ab-down'), true);
      });
    } catch { /* navegación en curso: el siguiente frame lo reintenta */ }
  }

  async grabPreview({ width = 960, quality = 60 } = {}) {
    const page = await this.ensurePage();
    if (!page.__abCursorInjected) { await this._injectCursor(page); page.__abCursorInjected = true; }
    const scale = width / 1280;
    const buf = await page.screenshot({
      type: 'jpeg',
      quality,
      clip: { x: 0, y: 0, width: Math.min(1280, page.viewportSize()?.width || 1280), height: Math.min(900, page.viewportSize()?.height || 900) },
    }).catch(async () => page.screenshot({ type: 'jpeg', quality }));
    const frame = {
      at: new Date().toISOString(),
      url: page.url(),
      title: await page.title().catch(() => ''),
      mouse: this._mouse ? { x: Math.round(this._mouse.x), y: Math.round(this._mouse.y) } : null,
      scale: Number(scale.toFixed(3)),
      jpeg: buf.toString('base64'),
    };
    this.previewFrame = frame;
    if (this.previewClients) {
      for (const ws of this.previewClients) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'preview', ...frame }));
      }
    }
    return { ok: true, bytes: buf.length, url: frame.url };
  }

  startPreviewLoop(fps = 2) {
    if (this._previewTimer) return { ok: true, already: true };
    this._previewTimer = setInterval(() => {
      if (this.previewClients && this.previewClients.size) this.grabPreview().catch(() => {});
    }, Math.max(200, 1000 / fps));
    return { ok: true, fps };
  }

  stopPreviewLoop() {
    clearInterval(this._previewTimer);
    this._previewTimer = null;
    return { ok: true };
  }

  async ensurePage() {
    await this.launch();
    if (!this.page || this.page.isClosed()) {
      const ctx = this.browser.contexts()[0];
      this.page = await ctx.newPage();
    }
    return this.page;
  }

  async goto(url, { waitUntil = 'domcontentloaded', timeout = 30000 } = {}) {
    const page = await this.ensurePage();
    const resp = await page.goto(url, { waitUntil, timeout });
    return {
      ok: true,
      status: resp ? resp.status() : null,
      url: page.url(),
      title: await page.title(),
    };
  }

  async snapshot({ interactive = false } = {}) {
    const page = await this.ensurePage();
    const data = await page.evaluate(SNAPSHOT_SCRIPT);
    let lines = data.lines;
    if (interactive) lines = lines.filter((l) => l.trim().startsWith('['));
    // mapa ref -> descriptor ({role,name,x,y,visible}) para acciones por ref
    this.lastRefs = data.refMap || {};
    return {
      url: data.url,
      title: data.title,
      refs: data.refs,
      viewport: data.viewport,
      scroll: data.scroll,
      tree: lines.join('\n'),
    };
  }

  // Devuelve el descriptor de un ref; si aún no hay snapshot, lo genera.
  async refInfo(ref) {
    if (!this.lastRefs || !this.lastRefs[ref]) await this.snapshot({ interactive: true });
    return this.lastRefs?.[ref] || null;
  }

  // Resuelve cualquier "target" aceptado por las acciones humanas a coordenadas
  // del viewport: ref eN, {x,y}, [x,y], o selector CSS único.
  async resolvePoint(target) {
    const page = await this.ensurePage();
    if (typeof target === 'string' && /^e\d+$/.test(target)) {
      const info = await this.refInfo(target);
      if (!info) throw new Error(`ref ${target} desconocido (haz snapshot primero)`);
      return { x: info.x + this._rnd(-3, 3), y: info.y + this._rnd(-3, 3), meta: info };
    }
    if (Array.isArray(target)) return { x: target[0], y: target[1] };
    if (target && typeof target === 'object' && target.x != null) return { x: target.x, y: target.y };
    if (typeof target === 'string') {
      const box = await page.locator(target).first().boundingBox().catch(() => null);
      if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    throw new Error(`target inválido: ${JSON.stringify(target)} (usa un ref eN del snapshot, [x,y], {x,y} o selector CSS)`);
  }

  async text() {
    const page = await this.ensurePage();
    const t = await page.evaluate(`(() => document.body.innerText.replace(/\\n{3,}/g, '\\n\\n').trim())()`);
    return { url: page.url(), title: await page.title(), text: String(t).slice(0, 40000) };
  }

  async click(ref, { button = 'left' } = {}) {
    const page = await this.ensurePage();
    const sel = selectorForRef(ref);
    await page.click(sel, { button, timeout: 10000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return { ok: true, action: 'click', ref, url: page.url(), title: await page.title() };
  }

  async fill(ref, value, { submit = false } = {}) {
    const page = await this.ensurePage();
    const sel = selectorForRef(ref);
    await page.fill(sel, value, { timeout: 10000 });
    if (submit) {
      await page.press(sel, 'Enter');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    return { ok: true, action: 'fill', ref, submitted: submit, url: page.url(), title: await page.title() };
  }

  async select(ref, values) {
    const page = await this.ensurePage();
    const picked = await page.selectOption(selectorForRef(ref), Array.isArray(values) ? values : [values]);
    return { ok: true, action: 'select', ref, selected: picked };
  }

  async check(ref, yes = true) {
    const page = await this.ensurePage();
    const sel = selectorForRef(ref);
    if (yes) await page.check(sel); else await page.uncheck(sel);
    return { ok: true, action: yes ? 'check' : 'uncheck', ref };
  }

  async press(key) {
    const page = await this.ensurePage();
    await page.keyboard.press(key);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return { ok: true, action: 'press', key, url: page.url() };
  }

  async scroll(dir = 'down', amount = 600) {
    const page = await this.ensurePage();
    const delta = dir === 'up' ? -amount : dir === 'top' ? -1e7 : dir === 'bottom' ? 1e7 : amount;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(200);
    const y = await page.evaluate('scrollY');
    return { ok: true, action: 'scroll', dir, y };
  }

  async eval(js) {
    const page = await this.ensurePage();
    const result = await page.evaluate(`(() => { ${js} })()`);
    return { ok: true, result };
  }

  async screenshot(path) {
    const page = await this.ensurePage();
    const buf = await page.screenshot({ path, fullPage: true });
    return { ok: true, path, bytes: buf.length };
  }

  async back() {
    const page = await this.ensurePage();
    await page.goBack().catch(() => {});
    return { ok: true, url: page.url(), title: await page.title() };
  }

  async forward() {
    const page = await this.ensurePage();
    await page.goForward().catch(() => {});
    return { ok: true, url: page.url(), title: await page.title() };
  }

  async saveState() {
    await this.launch();
    const cookies = await this.browser.contexts()[0].cookies();
    fs.writeFileSync(STATE_PATH, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
    return { ok: true, path: STATE_PATH, cookies: cookies.length };
  }

  // ---------- navegación humana: ratón, teclado y gestos realistas ----------
  // Estos endpoints existen para que el agente se comporte como una persona
  // dentro del navegador: mover el cursor con trayectoria curva, hacer clic
  // donde ve (coordenadas del snapshot), arrastrar, hover, rueda… Muchos
  // repositorios de imágenes solo muestran su contenido (o desbloquean la
  // descarga en alta resolución) tras interacciones humanas reales; un simple
  // page.click() no basta porque deja la firma de un bot (teletransporte del
  // cursor, timing uniforme, cero movimiento).

  _rnd(a, b) { return a + Math.random() * (b - a); }

  // Trayectoria Bezier cúbica entre dos puntos con jitter: imita el arco y la
  // aceleración/desaceleración de una mano. Devuelve los pasos generados.
  _mousePath(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(8, Math.min(40, Math.round(dist / 12) + Math.round(this._rnd(4, 10))));
    // control points: desplazamiento perpendicular aleatorio (curvatura natural)
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const nx = -(y1 - y0) / (dist || 1), ny = (x1 - x0) / (dist || 1);
    const bend = this._rnd(-0.25, 0.25) * dist;
    const c1x = mx + nx * bend + this._rnd(-15, 15), c1y = my + ny * bend + this._rnd(-15, 15);
    const c2x = mx + nx * bend * 0.5 + this._rnd(-10, 10), c2y = my + ny * bend * 0.5 + this._rnd(-10, 10);
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      let t = i / steps;
      // ease-in-out: lento al inicio y final, rápido en el medio (como una mano)
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const u = 1 - t;
      pts.push([
        u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
        u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
      ]);
    }
    return pts;
  }

  // Mueve el ratón hacia (x,y) con trayectoria humana. `steps` permite
  // sobreescribir suavidad. No hace clic.
  async mouseMove(x, y, { steps = null } = {}) {
    const page = await this.ensurePage();
    // Playwright no expone la última posición del ratón: la rastreamos nosotros
    const pathPts = this._mousePath(this._mouse.x, this._mouse.y, x, y);
    if (steps && steps > 0) {
      // remuestrear a N pasos
      const resampled = Array.from({ length: steps }, (_, i) =>
        pathPts[Math.min(pathPts.length - 1, Math.round(i * (pathPts.length - 1) / Math.max(1, steps - 1)))]);
      pathPts.length = 0; pathPts.push(...resampled);
    }
    for (const [px, py] of pathPts) {
      await page.mouse.move(px, py);
      await page.waitForTimeout(this._rnd(4, 18)); // micro-pausas irregulares
    }
    this._mouse = { x, y };
    return { ok: true, action: 'mouse_move', to: [Math.round(x), Math.round(y)], pathSteps: pathPts.length };
  }

  // Clic humano completo: mover → pausa breve de reacción → presionar → soltar.
  // Acepta coordenadas absolutas o un ref (eN) del último snapshot (usa el
  // centro del bounding box, con jitter de ±3px para no pinchar siempre igual).
  async humanClick(target, { button = 'left', double = false, holdMs = null, x = null, y = null } = {}) {
    const page = await this.ensurePage();
    let cx = x, cy = y;
    if (cx == null || cy == null) {
      const p = await this.resolvePoint(target ?? { x, y });
      cx = p.x; cy = p.y;
    }
    await this.mouseMove(cx, cy);
    await page.waitForTimeout(this._rnd(60, 220)); // tiempo de reacción antes de pulsar
    const opts = { button };
    if (double) {
      await page.mouse.dblclick(cx, cy, opts);
    } else {
      await page.mouse.down(opts);
      await page.waitForTimeout(holdMs ?? this._rnd(45, 130)); // duración del pulsado
      await page.mouse.up(opts);
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return { ok: true, action: 'human_click', at: [Math.round(cx), Math.round(cy)], button, double, url: page.url(), title: await page.title() };
  }

  // Ratón sobre un elemento/ref sin clicar — muchos sitios revelan overlays
  // ("download", "full size") solo con hover genuino.
  async hover(target) {
    const page = await this.ensurePage();
    const { x: cx, y: cy } = await this.resolvePoint(target);
    await this.mouseMove(cx, cy);
    await page.waitForTimeout(this._rnd(150, 400)); // el hover necesita "asentarse"
    return { ok: true, action: 'hover', at: [Math.round(cx), Math.round(cy)] };
  }

  // Arrastrar y soltar con trayectoria real (útil en selectores de archivos,
  // canvas, reordenar galerías…)
  async drag(from, to, { steps = 25 } = {}) {
    const page = await this.ensurePage();
    const fp = await this.resolvePoint(from);
    const tp = await this.resolvePoint(to);
    const fx = fp.x, fy = fp.y, tx = tp.x, ty = tp.y;
    await this.mouseMove(fx, fy);
    await page.mouse.down();
    const path = this._mousePath(fx, fy, tx, ty);
    const stride = Math.max(1, Math.floor(path.length / steps));
    for (let i = 0; i < path.length; i += stride) {
      await page.mouse.move(path[i][0], path[i][1]);
      await page.waitForTimeout(this._rnd(6, 20));
    }
    await page.mouse.move(tx, ty);
    await page.waitForTimeout(this._rnd(80, 180));
    await page.mouse.up();
    return { ok: true, action: 'drag', from: [fx, fy], to: [tx, ty] };
  }

  // Rueda del ratón con inercia simulada (scroll suave, no salto instantáneo):
  // varios ticks decrecientes, como una rueda física.
  async wheel(dy, { x = null, y = null } = {}) {
    const page = await this.ensurePage();
    if (x != null) await this.mouseMove(x, y);
    let remaining = dy;
    const sign = Math.sign(remaining);
    while (Math.abs(remaining) > 20) {
      const chunk = sign * Math.min(Math.abs(remaining), Math.max(40, Math.abs(remaining) * 0.35));
      await page.mouse.wheel(0, chunk);
      remaining -= chunk;
      await page.waitForTimeout(this._rnd(15, 45));
    }
    await page.waitForTimeout(this._rnd(80, 200)); // tiempo de asentamiento
    const sy = await page.evaluate('scrollY');
    return { ok: true, action: 'wheel', dy, scrollY: sy };
  }

  // Escritura tipo humano: tecla a tecla con pausas variables y errores
  // ocasionales corregidos. page.fill() pone el texto de golpe (firma de bot);
  // esto genera eventos keydown/keyup reales, lo que activa listeners React/Vue
  // y satisface campos que exigen "typing".
  async typeText(text, { ref = null, wpm = 120, mistakes = false } = {}) {
    const page = await this.ensurePage();
    if (ref) {
      const sel = selectorForRef(ref);
      await page.click(sel, { timeout: 10000 }).catch(async () => {
        await this.humanClick(ref); // fallback por coordenadas si el selector falla
      });
    }
    const perChar = 60000 / (wpm * 5); // ms por carácter según WPM
    const typed = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (mistakes && Math.random() < 0.04 && /[a-z]/i.test(ch)) {
        // teclea una tecla errónea cercana y la borra
        const wrong = String.fromCharCode(ch.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
        await page.keyboard.type(wrong);
        await page.waitForTimeout(this._rnd(60, 160));
        await page.keyboard.press('Backspace');
        typed.push({ typo: wrong, corrected: true });
      }
      await page.keyboard.type(ch);
      // cadencia irregular: pausas mayores tras espacios/puntuación
      const base = perChar * this._rnd(0.6, 1.7);
      await page.waitForTimeout(/[ .,;:!?]$/.test(ch) ? base * 2 : base);
    }
    const value = ref
      ? await page.inputValue(selectorForRef(ref)).catch(() => null)
      : null;
    return { ok: true, action: 'type', chars: text.length, focusedValue: value, url: page.url() };
  }

  // Combo de teclas realista (Ctrl+S, Ctrl+A…) con tiempos entre pulsaciones.
  async keyCombo(keys) {
    const page = await this.ensurePage();
    const list = Array.isArray(keys) ? keys : String(keys).split('+');
    for (const k of list) await page.keyboard.down(k.trim());
    await page.waitForTimeout(this._rnd(40, 120));
    for (const k of [...list].reverse()) await page.keyboard.up(k.trim());
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return { ok: true, action: 'key_combo', keys: list, url: page.url() };
  }

  // Descarga mediante gesto humano: hover sobre el elemento → click → capturar
  // el evento Playwright 'download' (funciona incluso cuando el botón dispara
  // un POST o un blob generado por JS, imposible con fetch directo).
  async clickToDownload(target, { dir = null, name = null, waitFor = 15000 } = {}) {
    const page = await this.ensurePage();
    const dlPromise = page.waitForEvent('download', { timeout: waitFor }).catch(() => null);
    if (typeof target === 'string' && /^e\d+$/.test(target)) {
      await this.humanClick(target);
    } else if (typeof target === 'string') {
      // URL directa: navegarla tampoco suele disparar download… usamos un truco:
      // abrimos un enlace sintético con <a download> en una página en blanco.
      await page.evaluate((u) => {
        const a = document.createElement('a');
        a.href = u; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
      }, target);
    } else {
      await this.humanClick(target);
    }
    const dl = await dlPromise;
    if (!dl) throw new Error('el clic no produjo ninguna descarga (¿no hay listener de download? prueba save/fetch)');
    const baseDir = dir ? path.resolve(dir) : DOWNLOADS_DIR;
    fs.mkdirSync(baseDir, { recursive: true });
    const full = path.join(baseDir, name || dl.suggestedFilename());
    await dl.saveAs(full);
    return { ok: true, action: 'click_to_download', suggested: dl.suggestedFilename(), path: full, bytes: fs.statSync(full).size };
  }

  // Gestos compuestos predefinidos que suelen pedir los repos de imágenes:
  //   accept-cookies → clic en banner común; reveal-lazy → scroll humano para
  //   disparar lazy-loading; view-full → hover+click en "ver tamaño completo".
  async gesture(name, arg = null) {
    const page = await this.ensurePage();
    switch (name) {
      case 'reveal-lazy': {
        // recorre la página con ruedas pequeñas hasta el final, esperando a que
        // se monten las imágenes perezosas (los bots que saltan a bottom fallan)
        const hasLazy = () => page.evaluate(() => Array.from(document.images)
          .some((im) => !im.complete || im.naturalWidth === 0));
        let last = -1, passes = 0;
        for (;;) {
          await this.wheel(500);
          const info = await page.evaluate(() => ({ y: scrollY, h: document.body.scrollHeight }));
          if (!(await hasLazy())) break;              // todo cargado: termina pronto
          if (info.y === last && info.y + innerHeight >= info.h - 5) break; // fondo sin más lazy
          last = info.y;
          if (++passes > 60) break;
        }
        return { ok: true, action: 'gesture', gesture: name, passes, scrollHeight: await page.evaluate('document.body.scrollHeight') };
      }
      case 'accept-cookies': {
        await this.snapshot({ interactive: true });
        const rx = /accept|agree|i agree|i consent|got it|de acuerdo|aceptar|autoriser|tout accepter/i;
        for (const [ref, d] of Object.entries(this.lastRefs || {})) {
          if ((d.role === 'button' || d.role === 'link') && d.visible !== false && rx.test(d.name || '')) {
            const r = await this.humanClick(ref);
            return { ...r, action: 'gesture', gesture: name, clicked: { ref, name: d.name } };
          }
        }
        return { ok: false, error: 'no encontré banner de cookies con texto típico', hint: 'haz snapshot y humanClick manual' };
      }
      default:
        throw new Error(`gesto desconocido: ${name} (disponibles: reveal-lazy, accept-cookies)`);
    }
  }

  // ---------- libertad de navegación: imágenes y descargas ----------

  // Resuelve un ref (eN) a su URL "natural": href de enlace, src de imagen,
  // o la imagen más grande dentro del elemento. Permite al agente actuar
  // sobre resultados de búsqueda sin escribir selectores.
  async resolveRef(ref) {
    const page = await this.ensurePage();
    return page.evaluate(({ ref }) => {
      const el = document.querySelector(`[data-ab-ref="${ref}"]`);
      if (!el) return { error: `ref ${ref} no existe en la página actual (¿necesitas un snapshot?)` };
      const imgOf = () => {
        let best = null, area = -1;
        for (const im of [el.tagName === 'IMG' ? el : null, ...el.querySelectorAll('img')]) {
          if (!im) continue;
          const src = im.currentSrc || im.src || im.getAttribute('data-src');
          if (!src) continue;
          const a = (im.naturalWidth || 1) * (im.naturalHeight || 1);
          if (a > area) { best = src; area = a; }
        }
        return best;
      };
      const url = el.href || imgOf() || el.src || null;
      return {
        url: url ? new URL(url, location.href).href : null,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      };
    }, { ref });
  }

  // Extrae todas las imágenes visibles de la página (para que el agente
  // elija cuáles guardar). Con --big solo las sustanciales. Incluye `data-src`
  // (lazy-loading) como fallback para que ninguna imagen pase desapercibida.
  async images({ minArea = 0, limit = 100 } = {}) {
    const page = await this.ensurePage();
    const imgs = await page.evaluate(() => Array.from(document.images).map((im) => ({
      src: im.currentSrc || im.src || im.getAttribute('data-src') || '',
      lazy: !im.src || im.naturalWidth === 0,
      alt: (im.alt || '').slice(0, 120),
      w: im.naturalWidth, h: im.naturalHeight,
      linked: !!im.closest('a[href]'),
      href: im.closest('a[href]')?.href || null,
    })).filter((i) => i.src && !i.src.startsWith('data:')));
    const seen = new Set();
    const out = [];
    for (const i of imgs) {
      if (seen.has(i.src)) continue;
      seen.add(i.src);
      if ((i.w || 0) * (i.h || 0) < minArea) continue;
      out.push(i);
      if (out.length >= limit) break;
    }
    return { ok: true, url: page.url(), count: out.length, images: out };
  }

  // Guarda una imagen en disco. Acepta URL directa o ref (eN) de la página.
  // Se descarga DENTRO del navegador (page.request) para reutilizar cookies,
  // user-agent y headers de la sesión — clave en sitios con protección anti-hotlink.
  async saveImage(target, { name = null, dir = null, prefix = null, referer = null } = {}) {
    const page = await this.ensurePage();
    let url = target;
    let contextText = '';
    if (/^e\d+$/.test(target)) {
      const r = await this.resolveRef(target);
      if (r.error) throw new Error(r.error);
      if (!r.url) throw new Error(`el ref ${target} no contiene ninguna imagen ni enlace`);
      url = r.url;
      contextText = r.text || '';
    }
    if (!/^https?:\/\//i.test(url)) url = new URL(url, page.url()).href;

    const baseDir = dir ? path.resolve(dir) : DOWNLOADS_DIR;
    fs.mkdirSync(baseDir, { recursive: true });

    const resp = await page.request.get(url, {
      timeout: 30000,
      headers: { referer: referer || page.url() },
    }).catch((e) => { throw new Error(`descarga fallida: ${e.message}`); });
    if (!resp.ok()) throw new Error(`HTTP ${resp.status()} al descargar ${url}`);
    const buf = await resp.body();
    const mime = sniffImageType(buf) || resp.headers()['content-type']?.split(';')[0] || null;
    if (!mime || !mime.startsWith('image/')) {
      throw new Error(`${url} no es una imagen (content-type=${resp.headers()['content-type']}, primer bytes: ${buf.subarray(0, 8).toString('hex')})`);
    }

    let filename;
    if (name) {
      filename = path.basename(name);
      if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += '.' + (MIME_EXT[mime] || extFromUrl(url) || 'img');
    } else {
      const stem = slugify(prefix || contextText || new URL(url).pathname.split('/').pop() || 'img');
      filename = `${stem}.${MIME_EXT[mime] || extFromUrl(url) || 'img'}`;
    }
    // evitar pisar archivos previos: img.png -> img-2.png
    const dot = filename.lastIndexOf('.');
    let candidate = filename, n = 2;
    while (fs.existsSync(path.join(baseDir, candidate))) {
      candidate = dot > 0
        ? filename.slice(0, dot) + '-' + n++ + filename.slice(dot)
        : filename + '-' + n++;
    }
    const full = path.join(baseDir, candidate);
    fs.writeFileSync(full, buf);
    return {
      ok: true, action: 'save_image',
      source: url, path: full, bytes: buf.length, mime,
    };
  }

  // Búsqueda de imágenes lista para agentes: flujo completo en un comando.
  // Estrategia multi-motor con fallbacks, porque los buscadores comerciales
  // (DDG/Bing) sirven captcha a navegadores headless desde datacenter IPs:
  //   1. DuckDuckGo HTML ligero (sin JS): enlaces directos a thumbnails
  //   2. Openverse (api.openverse.org, sin API key, imágenes con licencia)
  //   3. Wikimedia Commons (file-search, URLs thumb->original deduplicables)
  async searchImages(query, { save = 0, dir = null, engine = null, timeout = 30000 } = {}) {
    const page = await this.ensurePage();
    const attempts = [];
    let results = [];

    const tryEngine = async (name, fn) => {
      try {
        const r = await fn();
        attempts.push({ engine: name, found: r.length });
        if (r.length > results.length) results = r;
        return r.length > 0;
      } catch (e) {
        attempts.push({ engine: name, error: String(e.message || e).slice(0, 160) });
        return false;
      }
    };

    if (!engine || engine === 'ddg') {
      await tryEngine('duckduckgo', async () => {
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, { waitUntil: 'domcontentloaded', timeout });
        await page.waitForSelector('a[href*="image.duckduckgo.com"]', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
        return page.evaluate(() => {
          const out = [];
          for (const a of document.querySelectorAll('a[href*="image.duckduckgo.com"]')) {
            const im = a.querySelector('img');
            if (im?.src && !im.src.startsWith('data:') && !/assets\/anomaly/.test(im.src)) {
              out.push({ thumb: im.src, origin: null, alt: (im.alt || '').slice(0, 120) });
            }
          }
          return out;
        });
      });
    }
    if (!results.length && (!engine || engine === 'openverse')) {
      await tryEngine('openverse', async () => {
        const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=25`;
        const resp = await page.request.get(api, { headers: { accept: 'application/json' }, timeout });
        if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
        const j = JSON.parse(await resp.text());
        return (j.results || []).map((r) => ({ thumb: r.url || r.thumbnail, origin: r.foreign_landing_url, alt: (r.title || '').slice(0, 120), license: r.license }));
      });
    }
    if (!results.length && (!engine || engine === 'commons')) {
      await tryEngine('wikimedia-commons', async () => {
        const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|mime&format=json`;
        const resp = await page.request.get(api, { headers: { referer: 'https://commons.wikimedia.org/' }, timeout });
        if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
        const j = JSON.parse(await resp.text());
        const pages = Object.values(j.query?.pages || {});
        return pages.map((pg) => pg.imageinfo?.[0]).filter(Boolean)
          .map((ii) => ({ thumb: ii.thumburl || ii.url, origin: ii.descriptionurl || ii.url, alt: (ii.mime || ''), full: ii.url }));
      });
    }

    const seen = new Set();
    results = results.filter((r) => r.thumb && !seen.has(r.thumb) && seen.add(r.thumb)).slice(0, 50);

    const saved = [];
    const errors = [];
    if (save > 0 && results.length) {
      const baseDir = dir ? path.resolve(dir) : path.join(DOWNLOADS_DIR, slugify(query));
      fs.mkdirSync(baseDir, { recursive: true });
      let i = 0;
      for (const r of results) {
        if (saved.length >= save) break;
        i++;
        try {
          // para commons preferimos la URL completa si existe
          const res = await this.saveImage(r.full || r.thumb, {
            dir: baseDir,
            name: `${slugify(query, 32)}-${String(saved.length + 1).padStart(2, '0')}`,
            referer: page.url(),
          });
          saved.push({ path: res.path, bytes: res.bytes, mime: res.mime, from: res.source, alt: r.alt });
        } catch (e) {
          errors.push({ thumb: r.thumb, error: String(e.message || e).slice(0, 160) });
        }
      }
    }
    return {
      ok: true, query, engines: attempts,
      usedFallback: attempts.some((a) => a.found === 0 || a.error),
      searchUrl: page.url(),
      found: results.length,
      results: results.map((r, idx) => ({ n: idx + 1, thumb: r.thumb, origin: r.origin, alt: r.alt, license: r.license })),
      saved, ...(errors.length ? { errors } : {}),
    };
  }

  // Descarga arbitraria (pdf, zip…) respetando la sesión del navegador.
  async download(url, { dir = null, name = null } = {}) {
    const page = await this.ensurePage();
    const abs = /^https?:\/\//i.test(url) ? url : new URL(url, page.url()).href;
    const baseDir = dir ? path.resolve(dir) : DOWNLOADS_DIR;
    fs.mkdirSync(baseDir, { recursive: true });
    const resp = await page.request.get(abs, { timeout: 60000, headers: { referer: page.url() } });
    if (!resp.ok()) throw new Error(`HTTP ${resp.status()} en ${abs}`);
    const buf = await resp.body();
    const cdName = (resp.headers()['content-disposition'] || '').match(/filename\*?="?([^";]+)/)?.[1];
    const fname = name || cdName || slugify(new URL(abs).pathname.split('/').pop() || 'file');
    const full = path.join(baseDir, path.basename(decodeURIComponent(fname)));
    fs.writeFileSync(full, buf);
    return { ok: true, action: 'download', source: abs, path: full, bytes: buf.length, mime: resp.headers()['content-type'] };
  }

  logs({ errorsOnly = false } = {}) {
    const console_ = errorsOnly ? this.consoleLog.filter((c) => c.type === 'error') : this.consoleLog;
    const failed = this.netLog.filter((n) => n.status >= 400);
    return { console: console_.slice(-50), failedRequests: failed.slice(-20) };
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.page = null;
    return { ok: true };
  }
}

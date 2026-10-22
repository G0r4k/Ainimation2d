// Núcleo del navegador: envuelve Playwright y expone operaciones de alto nivel
// con resultados JSON listos para agentes. Toda acción devuelve además un
// "delta" (url, título, nº de refs) para que el agente sepa si cambió algo.

import { chromium } from 'playwright-core';
import { SNAPSHOT_SCRIPT, selectorForRef } from './snapshot.js';

const STATE_PATH = process.env.AB_STATE || new URL('../../state.json', import.meta.url).pathname;

export class AgentBrowser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.consoleLog = [];
    this.netLog = [];
  }

  async launch({ headless = true } = {}) {
    if (this.browser) return;
    const executablePath = process.env.AB_BROWSER_PATH || undefined;
    this.browser = await chromium.launch({
      headless,
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const ctx = await this.browser.newContext({ viewport: { width: 1280, height: 900 } });
    // restaurar cookies si existen
    try {
      const fs = await import('node:fs');
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
    return {
      url: data.url,
      title: data.title,
      refs: data.refs,
      viewport: data.viewport,
      scroll: data.scroll,
      tree: lines.join('\n'),
    };
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
    const fs = await import('node:fs');
    fs.writeFileSync(STATE_PATH, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
    return { ok: true, path: STATE_PATH, cookies: cookies.length };
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

// Generador de "accessibility tree" compacta, pensada para consumo por LLMs.
// Cada elemento interactivo recibe un ref secuencial (e1, e2, ...) que el
// agente usa luego para click/type/select sin escribir selectores CSS.

const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'textarea', 'select', 'summary',
  '[role=button]', '[role=link]', '[role=textbox]', '[role=combobox]',
  '[role=checkbox]', '[role=radio]', '[role=tab]', '[role=menuitem]',
  '[role=searchbox]', '[role=switch]', '[role=slider]',
  '[onclick]', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(', ');

// Se inyecta en la página y devuelve una lista plana de nodos relevantes.
export const SNAPSHOT_SCRIPT = `(() => {
  const INTERACTIVE = ${JSON.stringify(INTERACTIVE_SELECTOR)};
  const HEADINGS = 'h1,h2,h3,h4,h5,h6';
  const LANDMARKS = 'main,nav,header,footer,aside,section[aria-label],form[aria-label],[role=main],[role=navigation]';
  const out = [];
  let refN = 0;
  const isVisible = (el) => {
    if (el.disabled) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const textOf = (el) => {
    let t = el.innerText || el.textContent || '';
    t = t.replace(/\\s+/g, ' ').trim();
    return t.slice(0, 160);
  };
  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    if (el.labels && el.labels.length) return textOf(el.labels[0]);
    const forId = el.id;
    if (forId) {
      const l = document.querySelector('label[for="' + CSS.escape(forId) + '"]');
      if (l) return textOf(l);
    }
    const alt = el.getAttribute('alt') || el.getAttribute('placeholder') || el.getAttribute('title');
    if (alt) return alt.trim();
    return null;
  };
  const lineFor = (el, kind) => {
    const ref = 'e' + (++refN);
    el.setAttribute('data-ab-ref', ref);
    const tag = el.tagName.toLowerCase();
    const parts = ['[' + kind];
    if (tag !== kind.replace(/:.*/, '')) parts.push('<' + tag + '>');
    const name = textOf(el) || labelOf(el) || '';
    if (name) parts.push(JSON.stringify(name));
    if (el.type) parts.push('type=' + el.type);
    if (el.href) parts.push('href=' + el.href);
    if (el.name) parts.push('name=' + el.name);
    if (el.value != null && el.type !== 'password' && String(el.value)) parts.push('value=' + JSON.stringify(String(el.value).slice(0, 80)));
    if (el.checked) parts.push('checked');
    if (el.disabled) parts.push('disabled');
    if (el.getAttribute('role')) parts.push('role=' + el.getAttribute('role'));
    const r = el.getBoundingClientRect();
    parts.push('at=(' + Math.round(r.x) + ',' + Math.round(r.y) + ' size=' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
    return { ref, line: parts.join(' ') + ']', x: r.x + r.width / 2, y: r.y + r.height / 2, visible: isVisible(el), tag, interactive: true };
  };
  const walk = (el, depth) => {
    const isHeading = el.matches && el.matches(HEADINGS);
    const isLandmark = el.matches && el.matches(LANDMARKS);
    const isInteractive = el.matches && el.matches(INTERACTIVE) && !el.hasAttribute('data-ab-ref');
    const entry = { depth, children: [] };
    if (isLandmark) {
      entry.line = '#' + ' '.repeat(depth) + '<' + el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? ' "' + el.getAttribute('aria-label') + '"' : '') + '>';
    } else if (isHeading) {
      entry.line = '#' + ' '.repeat(depth) + el.tagName.toLowerCase() + ': ' + textOf(el);
    }
    if (isInteractive) {
      if (!isVisible(el)) { /* aún así se referencia, marcado hidden */ }
      const node = lineFor(el, el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName === 'INPUT' ? 'textbox' : el.tagName.toLowerCase()));
      if (!node.visible) node.line += ' [hidden]';
      entry.interNode = node;
    }
    // texto plano solo en hojas no interactivas con contenido breve
    if (!entry.line && !entry.interNode && el.children.length === 0) {
      const t = textOf(el);
      if (t && t.length <= 200 && el.closest(INTERACTIVE) === null) {
        const p = el.parentElement;
        if (p && (p.matches('body,main,article,section,div,p,li,span'))) {
          // evitar duplicar texto ya capturado como nombre de elementos
        }
      }
    }
    for (const c of el.children || []) {
      const child = walk(c, entry.interNode ? depth + 1 : depth);
      entry.children.push(child);
    }
    return entry;
  };
  const root = walk(document.body, 0);
  const flatten = (node, acc) => {
    if (node.line) acc.push(node.line);
    if (node.interNode) acc.push('  '.repeat(node.depth) + node.interNode.line);
    for (const c of node.children) flatten(c, acc);
    return acc;
  };
  const lines = flatten(root, []);
  return {
    url: location.href,
    title: document.title,
    refs: refN,
    lines,
    viewport: { w: innerWidth, h: innerHeight },
    scroll: { y: scrollY, maxY: document.body.scrollHeight },
  };
})()`;

// Devuelve el selector CSS estable para un ref generado por snapshot.
export function selectorForRef(ref) {
  if (!/^e\d+$/.test(ref)) throw new Error(`ref inválido: ${ref} (formato esperado: e1, e2, ...)`);
  return `[data-ab-ref="${ref}"]`;
}

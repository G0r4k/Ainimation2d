# agent-browser

Navegador **minimalista diseñado para ser operado por agentes de IA**, no por personas.
El interfaz primario son tres superficies orientadas a máquinas; la interfaz humana es
deliberadamente un simple monitor de lectura.

```
agente ──▶ CLI (ab)          stdout = JSON determinista
       ──▶ API REST + WS     /api/*, /ws  (sesión persistente compartida)
       ──▶ Daemon JSON-RPC   stdin/stdout (refs estables entre comandos)
persona ─▶ http://localhost:8737/   (solo observa: estado + historial de acciones)
```

## ¿Por qué "amigable con agentes" en vez de con humanos?

| Decisión | Beneficio para el agente |
|---|---|
| Snapshot = accessibility tree compacta con refs `e1..eN` | Cero selectores CSS frágiles; ~5-20x menos tokens que HTML crudo |
| Toda salida es JSON (`ok`, `error`, delta `{url,title}`) | Parseable sin heurísticas; detección de cambios gratis |
| Errores accionables con exit code | El agente se auto-corrige (`ref inválido: usa ab snapshot`) |
| Sin UI compleja que mantener | Superficie mínima: 18 operaciones, estable y versionada (`agent-browser/1`) |
| Logs de consola/red expuestos como datos | Depura SPA sin interpretar screenshots |
| Persistencia de cookies (`state`) | Sesiones de login reutilizables entre runs |
| Serialización estricta de comandos | Sin condiciones de carrera percepción→acción |

## Estructura

```
agent-browser/
├── src/
│   ├── cli.js            # comando `ab`: todas las operaciones, salida JSON
│   ├── server.js         # API REST + WebSocket para agentes remotos
│   ├── daemon.js         # JSON-RPC por stdio (sesión viva, refs persistentes)
│   ├── ui.html           # monitor humano mínimo (solo lectura)
│   └── core/
│       ├── browser.js    # envoltorio Playwright: goto/snapshot/click/fill/...
│       └── snapshot.js   # generador del árbol accesible + sistema de refs
├── AGENT.md              # protocolo/documentación pensada para leerla un LLM
└── test/page.html        # página fixture para pruebas locales
```

## Uso

```bash
cd agent-browser && npm install
export AB_BROWSER_PATH=/ruta/a/chrome   # opcional: Chromium existente

node src/cli.js open https://example.com
# { ok:true, url:"...", title:"...", refs:12, tree:"[link \"More information...\" href=...]" }

node src/cli.js fill e1 "consulta" --submit
node src/cli.js snapshot --interactive
node src/cli.js logs --errors
node src/cli.js shot evidencia.png
```

Como servidor para múltiples agentes:

```bash
node src/server.js 8737
curl -s -X POST localhost:8737/api/goto -d '{"url":"https://example.com"}'
curl -s -X POST localhost:8737/api/snapshot -d '{"interactive":true}'
curl -s -X POST localhost:8737/api/click  -d '{"ref":"e1"}'
```

## Stack

Solo dos dependencias: `playwright-core` (usando un Chromium ya instalado, sin
descargar navegadores) y `ws`. Sin framework de UI: el monitor humano es un único
HTML estático. Diseñado para correr headless en contenedores/CI.

## Roadmap sugerido
- [ ] Búsqueda difusa por nombre accesible (`ab find "Sign in"` → ref directo)
- [ ] Modo multi-tab con identificadores explícitos para el agente
- [ ] Streaming de eventos (navegación, dialogs, downloads) por WS
- [ ] MCP server empaquetando las mismas operaciones como tools

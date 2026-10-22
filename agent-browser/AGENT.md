# agent-browser — protocolo para agentes

Navegador minimalista cuyo interfaz primario es una API (CLI / REST / WebSocket).
La UI humana (`/`) es solo un monitor de lectura.

## Inicio rápido
```bash
node src/cli.js open https://example.com     # navega + snapshot interactivo (JSON)
node src/server.js 8737                       # API REST + WS persistente
node src/daemon.js                            # JSON-RPC por stdin/stdout (refs persistentes)
```
Variable `AB_BROWSER_PATH` → ejecutable Chromium (si playwright-core no encuentra uno).

## Modelo de trabajo (loop percepción-acción)
1. `open`/`goto` la URL.
2. `snapshot` → árbol compacto; cada elemento interactivo recibe un **ref** (`e1`, `e2`…).
3. Actúa con refs: `click e5`, `fill e1 "texto" --submit`, `select e3 b`, `check e4`.
4. Tras navegar, repite `snapshot` (los refs se reasignan por página).

## Garantías para el agente
- **stdout siempre JSON**; `ok:false` + exit code 1 ante error (con mensaje accionable).
- Toda acción devuelve *delta*: `{url, title}` para detectar cambios sin snapshot extra.
- `logs` expone consola JS y peticiones HTTP ≥400 (depuración sin screenshots).
- `eval` para escapes de bajo nivel; resultado serializado.
- `state` persiste cookies entre sesiones (login reutilizable).
- El daemon y la API serializan comandos en orden: nunca hay condiciones de carrera entre `snapshot` y `click`.

## Formato del snapshot
```
<main "contenido">            # landmarks y encabezados como contexto barato
[button "Buscar" type=submit at=(185,81 size=57x21)]   [hidden] opcional
[link <a> "enlace" href=... ]
```
Tokens clave: `ref implícito` (orden = e1..eN), role/tipo, nombre accesible, `href`, `value`, `checked`, `disabled`, coordenadas.

## Endpoints REST (POST JSON)
`/api/goto /snapshot /text /click /fill /select /check /press /scroll /eval /screenshot /back /forward /logs /state /status /close`
WebSocket `/ws`: `{"id":1,"op":"click","args":["e5"]}` → `{"id":1,"ok":true,"result":{...}}`.

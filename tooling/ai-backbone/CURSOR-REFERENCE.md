# Cursor — Referencia de Comandos y Configuración

Guía rápida de todo lo que puedes configurar y usar en Cursor para el agente de IA.

---

## Slash Commands dentro del agente

Escribe `/` en el chat del agente para ver todos los disponibles:

| Comando | Para qué sirve |
|---------|----------------|
| `/add-plugin` | Instala un plugin desde el Cursor Marketplace directamente en el editor |
| `/review` | Inicia una revisión de código del diff actual |
| `/new-rule` | Crea una nueva rule en `.cursor/rules/` interactivamente |
| `/generate-rule` | Genera una rule a partir del contexto de la conversación actual |
| `@[archivo]` | Añade un archivo concreto al contexto del agente |
| `@[carpeta]` | Añade toda una carpeta al contexto |
| `@Web` | Busca en la web y añade el resultado al contexto |
| `@Docs` | Busca en la documentación indexada de Cursor |
| `@Git` | Referencia commits, diffs o el historial de git |
| `@Codebase` | Búsqueda semántica en todo el codebase |

---

## Rules — Instrucciones persistentes para el agente

Las rules son archivos `.mdc` en `.cursor/rules/` que el agente lee según su configuración de scope.

### Dónde viven

```
.cursor/rules/           # Rules del proyecto (se commitean, shared con el equipo)
~/.cursor/rules/         # Rules personales globales (aplican en todos tus proyectos)
```

### Estructura de un archivo `.mdc`

```yaml
---
description: Lo que hace esta rule y cuándo aplica
globs: **/*.ts,**/*.tsx       # Aplica cuando estos archivos están abiertos
alwaysApply: false            # true = se carga en toda sesión
---

# Título de la rule

Contenido de la rule...
```

### Combinaciones de scope

| Configuración | Cuándo aplica |
|---------------|---------------|
| `alwaysApply: true` | En todas las sesiones, sin importar los archivos abiertos |
| `globs: **/*.ts` + `alwaysApply: false` | Solo cuando hay archivos `.ts` abiertos |
| Solo `description` (sin globs ni alwaysApply) | El agente decide cuándo usarla según la descripción |

### Crear una rule manualmente

```bash
# Crear el directorio si no existe
mkdir -p .cursor/rules

# Crear la rule
touch .cursor/rules/mi-regla.mdc
```

### Crear una rule desde el agente

Dile al agente: *"Crea una rule para que siempre uses named exports"* — el agente generará y guardará el `.mdc` directamente.

### Fuentes de rules pre-construidas por tecnología

En lugar de escribirlas desde cero, usa estas fuentes con cientos de rules ya probadas:

| Fuente | URL |
|--------|-----|
| Cursor Directory (principal) | https://cursor.directory/rules |
| TypeScript rules | https://cursor.directory/rules/typescript |
| React rules | https://cursor.directory/rules/react |
| Next.js rules | https://cursor.directory/rules/nextjs |
| Python rules | https://cursor.directory/rules/python |
| Go rules | https://cursor.directory/rules/go |
| Rust rules | https://cursor.directory/rules/rust |
| Cursor Directory alternativo | https://cursor-directory.com |
| Colección GitHub (77 rules curadas) | https://github.com/cursorrulespacks/cursorrules-collection |

---

## Skills — Capacidades personalizadas del agente

Los skills son archivos `SKILL.md` que enseñan al agente a hacer tareas específicas. Se invocan automáticamente cuando son relevantes o con `/nombre-skill`.

### Dónde viven

```
.cursor/skills/<nombre>/SKILL.md     # Skills del proyecto
~/.cursor/skills/<nombre>/SKILL.md   # Skills personales globales
```

### Estructura de SKILL.md

```yaml
---
name: nombre-skill
description: Qué hace y cuándo usarlo. El agente usa esto para decidir cuándo cargarlo.
disable-model-invocation: true    # Solo invocable por el usuario con /nombre
user-invocable: false             # Solo lo invoca el agente automáticamente
allowed-tools: Read, Grep         # Herramientas permitidas sin pedir permiso
context: fork                     # Corre en un subagente aislado
---

Instrucciones para el agente...
```

---

## Subagentes — Agentes especializados en paralelo

Desde Cursor 2.5, los subagentes corren **de forma asíncrona** — el agente principal continúa trabajando mientras los subagentes corren en paralelo. Los subagentes también pueden crear sus propios subagentes, formando un árbol de trabajo coordinado.

### Dónde se definen

```
.cursor/agents/<nombre>.md           # Agentes del proyecto
~/.cursor/agents/<nombre>.md         # Agentes personales globales
```

### Estructura de un agente

```markdown
---
name: code-reviewer
description: Revisa código en busca de problemas de calidad, seguridad y buenas prácticas. Úsalo automáticamente tras cambios de código.
tools: Read, Grep, Glob
model: claude-sonnet-4-6
---

Eres un senior code reviewer especializado en TypeScript y Clean Architecture.

Cuando revises código:
1. Verifica que los límites de capa sean correctos
2. Comprueba que no haya tipos `any`
3. Valida el manejo de errores
4. Identifica problemas de seguridad

Formato de respuesta: lista con severidad (🔴 crítico / 🟡 sugerencia / 🟢 opcional).
```

### Invocar un subagente

Desde el chat del agente:
```
Use the code-reviewer agent to review my last changes
```

O el agente principal lo invocará automáticamente si la `description` del agente lo justifica.

---

## Plugins — Cursor Marketplace (Cursor 2.5)

Los plugins empaquetan skills, subagentes, MCP servers, hooks y rules en una sola instalación. Están disponibles desde Cursor 2.5 (febrero 2026).

### Instalar un plugin

```
# Desde el chat del agente
/add-plugin

# O navegar al marketplace
cursor.com/marketplace
```

### Plugins destacados disponibles

| Partner | Categoría |
|---------|-----------|
| Figma | Diseño — trabaja con componentes y estilos directamente |
| Linear | Gestión de tareas — crea y actualiza issues desde el agente |
| AWS | Cloud — despliega y gestiona recursos AWS |
| Stripe | Pagos — integra y consulta APIs de Stripe |
| Amplitude | Analytics — consulta métricas y eventos |

### Sandbox network controls (Cursor 2.5)

Controla qué dominios puede alcanzar el agente al ejecutar comandos en el sandbox:

```json
// sandbox.json en la raíz del proyecto
{
  "network": {
    "mode": "user-config-with-defaults",
    "allowlist": [
      "api.github.com",
      "registry.npmjs.org"
    ],
    "denylist": [
      "internal-company-api.com"
    ]
  }
}
```

Modos disponibles: `user-config-only`, `user-config-with-defaults`, `allow-all`.

---

## MCP Servers — Conectar herramientas externas

MCP (Model Context Protocol) conecta el agente con fuentes de datos externas: bases de datos, APIs, servicios de terceros.

### Configurar un MCP server

```json
// .cursor/mcp.json (proyecto) o ~/.cursor/mcp.json (global)
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

Instalar desde el agente: *"Set up the GitHub MCP server"*

---

## Dónde crear cada tipo de archivo

```
# Rules
.cursor/rules/<nombre>.mdc              # Rule de proyecto (committed)
~/.cursor/rules/<nombre>.mdc           # Rule personal global

# Skills
.cursor/skills/<nombre>/SKILL.md        # Skill de proyecto (committed)
~/.cursor/skills/<nombre>/SKILL.md     # Skill personal global

# Subagentes
.cursor/agents/<nombre>.md              # Agente de proyecto (committed)
~/.cursor/agents/<nombre>.md           # Agente personal global

# MCP servers
.cursor/mcp.json                        # MCP de proyecto (committed)
~/.cursor/mcp.json                     # MCP personal global

# Sandbox controls
sandbox.json                            # Controles de red (raíz del proyecto)

# Plugins (gestionados por Cursor, no se editan manualmente)
# Se instalan con /add-plugin y se guardan en la configuración del usuario
```

---

## Atajos de teclado en Cursor

| Atajo | Acción |
|-------|--------|
| `Cmd+K` | Inline edit — edita código seleccionado con el agente |
| `Cmd+L` | Abre el chat del agente (o añade selección al chat) |
| `Cmd+I` | Composer — vista completa del agente para tareas largas |
| `Cmd+Shift+L` | Añade el archivo actual al contexto del chat |
| `Cmd+Shift+K` | Abre el panel de diff de cambios del agente |
| `Tab` | Acepta una sugerencia de Cursor Tab (autocompletado IA) |
| `Escape` | Rechaza la sugerencia actual de Tab |
| `Cmd+Z` | Deshace el último cambio del agente |

---

## Fuentes oficiales

| Recurso | URL |
|---------|-----|
| Docs — Rules | https://docs.cursor.com/context/rules |
| Docs — Skills | https://docs.cursor.com/context/skills |
| Docs — Subagents | https://docs.cursor.com/agent/subagents |
| Docs — MCP | https://docs.cursor.com/context/mcp |
| Changelog 2.5 (Plugins) | https://cursor.com/changelog/2-5 |
| Cursor Marketplace | https://cursor.com/marketplace |
| Rules directory | https://cursor.directory/rules |

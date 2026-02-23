# Claude Code — Referencia de Comandos

Guía rápida de todo lo que puedes hacer desde la CLI y dentro de una sesión interactiva.

---

## CLI — Arrancar sesiones

| Comando | Para qué sirve |
|---------|----------------|
| `claude` | Abre la sesión interactiva en el directorio actual |
| `claude "describe lo que necesitas"` | Abre la sesión con un prompt inicial ya cargado |
| `claude -p "query"` | Ejecuta un prompt y sale (modo script/CI) |
| `claude -c` | Continúa la conversación más reciente del directorio |
| `claude -c -p "query"` | Continúa la conversación más reciente en modo no-interactivo |
| `claude -r "nombre-sesion" "query"` | Retoma una sesión guardada por nombre o ID |
| `claude update` | Actualiza Claude Code a la última versión |

---

## CLI — Trabajar con múltiples directorios

| Comando | Para qué sirve |
|---------|----------------|
| `claude --add-dir ../shared ../lib` | Da acceso a directorios adicionales además del actual |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared` | Carga también los `CLAUDE.md` de los directorios añadidos |

---

## CLI — Agentes y subagentes

| Comando | Para qué sirve |
|---------|----------------|
| `claude --agent mi-agente` | Inicia la sesión usando un agente personalizado concreto |
| `claude --agents '{...}'` | Define subagentes dinámicamente en JSON sin archivos |
| `claude -w feature-auth` | Crea un git worktree aislado y lanza Claude en él |
| `claude --teammate-mode tmux` | Configura cómo se muestran los agentes en equipo (`auto`, `in-process`, `tmux`) |

### Formato JSON para `--agents`

```bash
claude --agents '{
  "reviewer": {
    "description": "Revisa código. Úsalo tras cambios.",
    "prompt": "Eres un senior code reviewer. Foco en calidad, seguridad y buenas prácticas.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "sonnet"
  }
}'
```

Campos disponibles: `description` (requerido), `prompt` (requerido), `tools`, `disallowedTools`, `model` (`sonnet`/`opus`/`haiku`/`inherit`), `skills`, `mcpServers`, `maxTurns`.

---

## CLI — System prompt y comportamiento

| Comando | Para qué sirve |
|---------|----------------|
| `claude --append-system-prompt "texto"` | Añade instrucciones al prompt base sin reemplazarlo (recomendado) |
| `claude --system-prompt "texto"` | Reemplaza por completo el system prompt (control total) |
| `claude -p --system-prompt-file ./prompt.txt "query"` | Carga el system prompt desde un archivo (solo modo -p) |
| `claude -p --append-system-prompt-file ./extra.txt "query"` | Añade instrucciones desde archivo al prompt base |
| `claude --model claude-sonnet-4-6` | Especifica el modelo para la sesión (`sonnet`, `opus` como alias) |

---

## CLI — Permisos y herramientas

| Comando | Para qué sirve |
|---------|----------------|
| `claude --permission-mode plan` | Inicia en modo plan (solo propone, no ejecuta) |
| `claude --allowedTools "Bash(git *)" "Read"` | Herramientas que se ejecutan sin pedir permiso |
| `claude --disallowedTools "Edit"` | Herramientas completamente deshabilitadas para la sesión |
| `claude --tools "Bash,Read,Grep"` | Restringe a exactamente estas herramientas |
| `claude --tools ""` | Deshabilita todas las herramientas |
| `claude --disable-slash-commands` | Deshabilita todos los skills y slash commands |

---

## CLI — MCP (conectar herramientas externas)

| Comando | Para qué sirve |
|---------|----------------|
| `claude mcp` | Gestiona servidores MCP (añadir, listar, eliminar) |
| `claude --mcp-config ./mcp.json` | Carga servidores MCP desde un archivo de configuración |
| `claude --strict-mcp-config --mcp-config ./mcp.json` | Usa solo los servidores del archivo, ignora el resto |

---

## CLI — Automatización y scripting

| Comando | Para qué sirve |
|---------|----------------|
| `cat archivo.log \| claude -p "analiza errores"` | Pasa contenido por pipe a Claude |
| `claude -p "query" --output-format json` | Respuesta en JSON para parsear en scripts |
| `claude -p "query" --output-format stream-json` | Streaming en JSON para pipelines |
| `claude -p --max-turns 3 "query"` | Limita el número de turnos agenticos |
| `claude -p --max-budget-usd 2.00 "query"` | Limita el gasto máximo en API |
| `claude --init` | Ejecuta hooks de inicialización e inicia sesión interactiva |
| `claude --init-only` | Ejecuta hooks de inicialización y sale (sin sesión) |
| `claude --maintenance` | Ejecuta hooks de mantenimiento y sale |

---

## CLI — Otros útiles

| Comando | Para qué sirve |
|---------|----------------|
| `claude --debug "api,hooks"` | Activa modo debug con filtro de categorías |
| `claude --verbose` | Log detallado turno a turno (útil para depurar) |
| `claude --settings ./settings.json` | Carga configuración adicional desde un archivo |
| `claude --setting-sources user,project` | Especifica qué fuentes de configuración cargar |
| `claude --chrome` | Activa integración con Chrome para automatización web |
| `claude --remote "Descripción de tarea"` | Crea una sesión web en claude.ai con esa tarea |
| `claude --teleport` | Retoma una sesión web en la terminal local |
| `claude -v` | Muestra la versión instalada |

---

## Slash Commands — Dentro de la sesión interactiva

Escribe `/` para ver todos los disponibles. Los más útiles:

### Memoria y configuración

| Comando | Para qué sirve |
|---------|----------------|
| `/init` | Genera un `CLAUDE.md` inicial analizando el proyecto |
| `/memory` | Abre el selector de archivos de memoria (`CLAUDE.md`, auto-memory) para editarlos |
| `/config` | Abre la interfaz de configuración (Settings) |
| `/permissions` | Ver y actualizar los permisos de herramientas |
| `/status` | Ver versión, modelo, cuenta y conectividad |

### Commands y Skills personalizados

Los commands personalizados son **archivos markdown** — no se generan desde terminal, simplemente se crean en el directorio correcto y Claude Code los descubre automáticamente.

#### Formato simple: `.claude/commands/nombre.md`

El formato más rápido — un solo archivo `.md` que se convierte en `/nombre`:

```
.claude/commands/
├── commit.md          →  /commit
├── review-pr.md       →  /review-pr
└── fix-issue.md       →  /fix-issue
```

Ejemplo de `.claude/commands/commit.md`:

```markdown
Analiza el resultado de `git diff --staged` y crea un conventional commit.

Formato: <type>(<scope>): <descripción en imperativo, max 72 chars>
Types: feat, fix, refactor, chore, docs, perf, ci

Ejecuta: git commit -m "el mensaje generado"
```

Con argumentos — usa `$ARGUMENTS` o `$1`, `$2`:

```markdown
---
argument-hint: "[issue-number]"
---

Lee el issue número $ARGUMENTS con `gh issue view $ARGUMENTS`.
Crea una rama, implementa el fix y abre un PR.
```

#### Formato completo: `.claude/skills/nombre/SKILL.md`

Para commands más complejos con archivos de soporte (templates, scripts, ejemplos):

```
.claude/skills/
└── review-pr/
    ├── SKILL.md           # Instrucciones principales (required)
    ├── checklist.md       # Archivo de apoyo (opcional)
    └── scripts/
        └── fetch-pr.sh    # Script ejecutable (opcional)
```

#### Diferencias entre los dos formatos

| | `.claude/commands/nombre.md` | `.claude/skills/nombre/SKILL.md` |
|--|------------------------------|----------------------------------|
| Estructura | Un solo archivo | Directorio con archivos de apoyo |
| Slash command | `/nombre` | `/nombre` (igual) |
| Frontmatter | Soportado | Soportado (más opciones) |
| Scripts y templates | No | Sí |
| Subagente aislado | No | Sí (`context: fork`) |
| Mejor para | Commands simples y rápidos | Workflows complejos con recursos |

Ambos formatos coexisten. Si un skill y un command tienen el mismo nombre, **el skill tiene prioridad**.

#### Frontmatter disponible en ambos formatos

```yaml
---
argument-hint: "[issue-number]"          # Hint en el autocompletado
disable-model-invocation: true           # Solo el usuario puede invocarlo
user-invocable: false                    # Solo Claude lo carga como contexto
allowed-tools: Bash(git *), Read         # Herramientas sin pedir permiso
context: fork                            # Corre en subagente aislado
model: sonnet                            # Modelo específico para este command
---
```

#### Ubicaciones para commands y skills

```
.claude/commands/nombre.md               # Command de proyecto (committed)
.claude/skills/nombre/SKILL.md           # Skill de proyecto (committed)
~/.claude/commands/nombre.md             # Command personal global
~/.claude/skills/nombre/SKILL.md         # Skill personal global
```

#### Invocación

| Comando | Para qué sirve |
|---------|----------------|
| `/nombre` | Invoca el command o skill |
| `/nombre argumento` | Invoca con argumentos (`$ARGUMENTS`) |
| `/nombre arg1 arg2` | Argumentos posicionales (`$1`, `$2`) |
| `What skills are available?` | Lista todos los commands/skills cargados en la sesión |

### Sesiones

| Comando | Para qué sirve |
|---------|----------------|
| `/clear` | Limpia el historial de la conversación |
| `/compact` | Compacta el historial resumiendo mensajes antiguos |
| `/rename mi-sesion` | Renombra la sesión actual para identificarla después |
| `/resume` | Retoma una sesión anterior (muestra picker interactivo) |
| `/rewind` | Revierte código y/o conversación a un punto anterior |
| `/export` | Exporta la conversación actual a un archivo |

### Información y debug

| Comando | Para qué sirve |
|---------|----------------|
| `/context` | Visualiza el uso de contexto como una cuadrícula de colores |
| `/cost` | Muestra estadísticas de tokens usados y coste estimado |
| `/debug` | Analiza el log de la sesión para resolver problemas |
| `/doctor` | Comprueba la salud de la instalación de Claude Code |
| `/stats` | Historial de sesiones, uso diario, preferencias de modelo |
| `/usage` | (Solo planes de suscripción) Límites de plan y rate limits |

### Flujo de trabajo

| Comando | Para qué sirve |
|---------|----------------|
| `/plan` | Entra en modo plan directamente desde el prompt |
| `/todos` | Lista los TODOs actuales de la sesión |
| `/tasks` | Lista y gestiona tareas en background |
| `/model` | Cambia el modelo en mitad de la sesión |
| `/mcp` | Gestiona conexiones MCP y autenticación OAuth |
| `/hooks` | Configura hooks de forma interactiva |
| `/vim` | Activa modo de edición vim en el prompt |

### Movilidad entre entornos

| Comando | Para qué sirve |
|---------|----------------|
| `/desktop` | Traspasa la sesión CLI al app Desktop de Claude Code |
| `/teleport` | Retoma una sesión web remota en la terminal local |

---

## Dónde crear cada tipo de archivo

### Skills / Slash Commands

```
~/.claude/skills/<nombre>/SKILL.md        # Personal (todos tus proyectos)
.claude/skills/<nombre>/SKILL.md          # Proyecto (compartido en el repo)
```

### Memoria del proyecto

```
CLAUDE.md                                  # Memoria raíz del proyecto
.claude/CLAUDE.md                          # Alternativa en subdirectorio .claude
.claude/rules/<nombre>.md                  # Reglas modulares (con paths opcionales)
CLAUDE.local.md                            # Memoria personal local (no se commitea)
~/.claude/CLAUDE.md                        # Memoria personal global
~/.claude/rules/<nombre>.md               # Reglas personales globales
```

### Subagentes

```
.claude/agents/<nombre>.md                 # Agente de proyecto
~/.claude/agents/<nombre>.md              # Agente personal global
```

### Configuración y permisos

```
.claude/settings.json                      # Permisos y configuración del proyecto
~/.claude/settings.json                   # Configuración personal global
```

### Hooks

```
.claude/hooks.json                         # Hooks del proyecto
~/.claude/hooks.json                      # Hooks personales globales
# O configurados interactivamente con /hooks
```

---

## Atajos de teclado clave en sesión interactiva

| Atajo | Acción |
|-------|--------|
| `Ctrl+C` | Cancela la generación en curso |
| `Ctrl+L` | Limpia la pantalla (mantiene el historial) |
| `Ctrl+O` | Toggle de output verbose |
| `Ctrl+R` | Búsqueda inversa en el historial de comandos |
| `Shift+Tab` | Alterna entre modos: Auto-Accept / Plan / Normal |
| `Option+P` (Mac) | Cambia de modelo sin borrar el prompt |
| `Option+T` (Mac) | Activa/desactiva extended thinking |
| `Esc` + `Esc` | Revierte código/conversación al punto anterior |
| `Ctrl+B` | Pasa el comando Bash actual a background |
| `!comando` | Ejecuta bash directo sin pasar por Claude |
| `@ruta` | Autocompletado de rutas de archivo |

---

## Variables de entorno útiles

| Variable | Valor | Efecto |
|----------|-------|--------|
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | `0` / `1` | Activa/desactiva la auto-memory |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | `false` | Desactiva sugerencias de prompt |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | `1` | Deshabilita tareas en background |
| `CLAUDE_CODE_TASK_LIST_ID` | `nombre` | Comparte lista de tareas entre sesiones |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | `1` | Carga CLAUDE.md de `--add-dir` dirs |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | número | Aumenta el límite de caracteres para skills |

---

## Plugins — Extender Claude Code

Los plugins empaquetan skills, agentes, hooks y servidores MCP en una sola instalación. Permiten compartir configuración entre proyectos y equipos sin copiar archivos manualmente.

### Cuándo usar plugins vs configuración standalone

| Enfoque | Nombres de skills | Ideal para |
|---------|-------------------|------------|
| Standalone (`.claude/`) | `/commit`, `/review` | Proyectos específicos, experimentación rápida |
| Plugin | `/mi-plugin:commit` | Compartir con el equipo, distribución, reutilizar en múltiples proyectos |

Los skills de plugin se namespaceian automáticamente (`/plugin-name:skill-name`) para evitar conflictos.

### Instalar un plugin

```bash
# Desde la sesión interactiva
/plugin install nombre-plugin@claude-plugins-official

# O navegar el marketplace
/plugin                 # → pestaña Discover
```

### Marketplace oficial de Claude Code

```bash
# Ver plugins disponibles
/plugin

# Categorías principales:
# - Code intelligence: LSP para TypeScript, Python, Go, Rust, Java, C#...
# - Skills: capacidades model-invocadas
# - Agents: agentes especializados
# - MCP Servers: integraciones con servicios externos
# - Hooks: automatizaciones de eventos
```

Para TypeScript, Python, Go, etc. — instala el **LSP plugin oficial** en vez de configurarlo manualmente. Ejemplo:

```
/plugin install typescript-lsp@claude-plugins-official
```

### Crear un plugin propio

```bash
# Estructura mínima
my-plugin/
├── .claude-plugin/
│   └── plugin.json           # Manifiesto (nombre, versión, descripción)
├── skills/                   # Skills del plugin
│   └── mi-skill/SKILL.md
├── agents/                   # Agentes del plugin
│   └── mi-agente.md
├── hooks/
│   └── hooks.json            # Hooks del plugin
└── .mcp.json                 # Servidores MCP del plugin
```

```json
// .claude-plugin/plugin.json
{
  "name": "mi-plugin",
  "description": "Descripción del plugin",
  "version": "1.0.0",
  "author": { "name": "Tu Nombre" }
}
```

Testear localmente sin instalar:

```bash
claude --plugin-dir ./mi-plugin
```

### Convertir tu `.claude/` existente en plugin

```bash
mkdir -p mi-plugin/.claude-plugin
# Copiar skills, agents y hooks existentes
cp -r .claude/skills mi-plugin/
cp -r .claude/agents mi-plugin/
# Crear el manifiesto y listo
```

### Recursos

- Marketplace oficial: `/plugin` → Discover
- Crear plugins: https://docs.anthropic.com/en/docs/claude-code/plugins
- Instalar plugins: https://docs.anthropic.com/en/discover-plugins
- Plugin marketplaces: https://docs.anthropic.com/en/plugin-marketplaces

---

## Fuente oficial

Toda esta información proviene de la documentación oficial de Anthropic:

- CLI Reference: https://docs.anthropic.com/en/docs/claude-code/cli-reference
- Interactive Mode: https://docs.anthropic.com/en/docs/claude-code/interactive-mode
- Skills / Commands: https://docs.anthropic.com/en/docs/claude-code/slash-commands
- Memory / CLAUDE.md: https://docs.anthropic.com/en/docs/claude-code/memory
- Hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Settings: https://docs.anthropic.com/en/docs/claude-code/settings
- Sub-agents: https://docs.anthropic.com/en/docs/claude-code/sub-agents

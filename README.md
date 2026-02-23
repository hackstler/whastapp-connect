# AI Backbone

Repositorio plantilla con toda la configuración de IA preestablecida para proyectos TypeScript con Clean Architecture. Copia esta estructura en cualquier repositorio nuevo para tener Claude Code y Cursor ya configurados.

---

## Inicio rápido para nuevos proyectos

```bash
# 1. Descarga el repo o úsalo como template
git clone https://github.com/tu-usuario/ai-backbone mi-proyecto
cd mi-proyecto

# 2. Lanza el setup interactivo con Claude Code o Cursor
claude initial-setup.md       # Si usas Claude Code

# En Cursor: abre initial-setup.md y díselo al agente:
# "Run this setup file"
```

El setup te hará ~9 preguntas clave (herramienta, stack, arquitectura, comandos, reglas de IA, git, skills, subagentes y plugins) y generará todos los archivos adaptados. Tarda unos 5 minutos. Las rules de TypeScript, React, Python, Go, etc. se importan automáticamente desde [cursor.directory](https://cursor.directory/rules).

---

## Estructura

```
ai-backbone/
├── CLAUDE.md                          # Memoria principal del proyecto (Claude Code)
├── CLAUDE.local.md                    # Preferencias personales locales (gitignored)
├── CLAUDE-CODE-REFERENCE.md           # Todos los comandos, flags y skills de Claude Code
├── CURSOR-REFERENCE.md                # Rules, skills, subagentes, plugins de Cursor
├── initial-setup.md                   # Setup interactivo — pásalo a Claude Code/Cursor al inicio
│
├── .claude/
│   ├── settings.json                  # Permisos y configuración de Claude Code
│   ├── hooks.json                     # Hooks automáticos (post-write typecheck, pre-commit lint)
│   ├── rules/
│   │   ├── code-style.md              # TypeScript estricto + patrones (stack-aware)
│   │   ├── architecture.md            # Límites de capa (Domain/App/Infra)
│   │   ├── git-workflow.md            # Conventional commits + branching
│   │   └── security.md               # Validación de input, secrets, SQL
│   └── skills/
│       ├── commit/SKILL.md            # /commit — genera conventional commit
│       ├── review-pr/SKILL.md         # /review-pr <number> — revisa PR con checklist
│       ├── fix-issue/SKILL.md         # /fix-issue <number> — implementa issue end-to-end
│       ├── refactor/SKILL.md          # /refactor <path> — refactoriza con patrones
│       └── release-notes/SKILL.md     # /release-notes <from> <to> — genera changelog
│
└── .cursor/
    └── rules/
        ├── typescript-standards.mdc   # TypeScript strict, tipos avanzados, async
        ├── clean-architecture.mdc     # Capas, use cases, value objects, repositories
        ├── git-conventions.mdc        # Formato de commit y ramas (always apply)
        └── project-ai-behavior.mdc   # Idioma, estilo de output, código prohibido
```

---

## Cómo usar en un nuevo repositorio

### Opción A — Setup automático con `initial-setup.md` (recomendado)

```bash
cd tu-nuevo-proyecto
# Copia el archivo de setup
cp /path/to/ai-backbone/initial-setup.md ./

# Lanza Claude Code y pásale el archivo
claude initial-setup.md
```

Claude Code te hará ~30 preguntas sobre tu proyecto (nombre, stack, comandos, convenciones, git workflow, skills que quieres, subagentes, etc.) y generará todos los archivos de configuración adaptados. Al terminar, tienes `CLAUDE.md`, `settings.json`, reglas, skills y agentes listos para usar.

### Opción B — Copiar la estructura manualmente

```bash
cp -r /path/to/ai-backbone/.claude ./
cp -r /path/to/ai-backbone/.cursor ./
cp /path/to/ai-backbone/CLAUDE.md ./
cp /path/to/ai-backbone/CLAUDE-CODE-REFERENCE.md ./
```

### 2. Actualizar CLAUDE.md (solo opción B)

Editar las secciones de `CLAUDE.md` para que reflejen el stack real:

- Stack & Architecture
- Common Commands (`pnpm dev`, `pnpm build`, etc.)
- Architecture Layout (directorios reales del proyecto)

### 3. Añadir a .gitignore

```gitignore
CLAUDE.local.md
.env
.env.*
!.env.example
```

### 4. Ajustar permisos en .claude/settings.json

Revisar y adaptar las reglas de `allow` y `deny` según las necesidades del proyecto.

### 5. Verificar en Claude Code

```bash
cd tu-proyecto
claude
> /memory        # lista todos los archivos de memoria cargados
> What skills are available?
```

---

## Cómo funcionan los Skills

Los skills son la evolución de los slash commands. Un archivo `SKILL.md` en `.claude/skills/<nombre>/` crea automáticamente el comando `/<nombre>`.

### Invocar un skill

```
/commit
/review-pr 123
/fix-issue 456
/refactor src/domain/user.ts
/release-notes v1.2.0 HEAD
```

### Frontmatter clave

| Campo | Uso |
|-------|-----|
| `disable-model-invocation: true` | Solo el usuario puede invocarlo — Claude no lo ejecuta solo |
| `user-invocable: false` | Solo Claude lo carga como contexto — no aparece en el menú `/` |
| `context: fork` | Corre en un subagente aislado |
| `allowed-tools` | Herramientas que puede usar sin pedir permiso |
| `argument-hint` | Hint en el autocompletado: `[issue-number]` |

---

## Cómo funcionan las Rules de Claude Code

Las reglas en `.claude/rules/*.md` se cargan automáticamente como memoria de proyecto. Pueden ser condicionales por path:

```markdown
---
paths:
  - "src/infrastructure/**/*.ts"
---
# Solo aplica cuando Claude trabaja en archivos de infraestructura
```

Sin frontmatter `paths` → se carga siempre.

---

## Cómo funcionan las Rules de Cursor

Los archivos `.cursor/rules/*.mdc` con frontmatter YAML controlan cuándo aplica cada regla:

```yaml
---
description: Lo que hace esta regla
globs: **/*.ts        # aplica cuando hay archivos .ts abiertos
alwaysApply: true     # aplica en toda sesión
---
```

Combinaciones comunes:
- `alwaysApply: true` — reglas globales del proyecto (idioma, estilo de output)
- `globs: src/**/*.ts` + `alwaysApply: false` — reglas de TypeScript específicas
- Solo `description` — el usuario o la IA la activa manualmente

---

## Fuentes Oficiales

### Claude Code

| Recurso | URL |
|---------|-----|
| Documentación principal | https://docs.anthropic.com/en/docs/claude-code/overview |
| CLAUDE.md — Memoria | https://docs.anthropic.com/en/docs/claude-code/memory |
| Skills / Slash Commands | https://docs.anthropic.com/en/docs/claude-code/slash-commands |
| Hooks reference | https://docs.anthropic.com/en/docs/claude-code/hooks |
| Settings y permisos | https://docs.anthropic.com/en/docs/claude-code/settings |
| Sub-agentes | https://docs.anthropic.com/en/docs/claude-code/sub-agents |
| **Plugins** | https://docs.anthropic.com/en/docs/claude-code/plugins |
| Descubrir e instalar plugins | https://docs.anthropic.com/en/discover-plugins |
| CLI reference | https://docs.anthropic.com/en/docs/claude-code/cli-reference |
| GitHub Actions CI | https://docs.anthropic.com/en/docs/claude-code/github-actions |
| MCP (Model Context Protocol) | https://docs.anthropic.com/en/docs/claude-code/mcp |
| Index completo (llms.txt) | https://code.claude.com/docs/llms.txt |

### Cursor

| Recurso | URL |
|---------|-----|
| Rules — documentación oficial | https://docs.cursor.com/context/rules |
| Skills — documentación oficial | https://docs.cursor.com/context/skills |
| Subagents — documentación oficial | https://docs.cursor.com/agent/subagents |
| **Cursor Marketplace (Plugins)** | https://cursor.com/marketplace |
| Changelog 2.5 — Plugins y async subagents | https://cursor.com/changelog/2-5 |
| Cursor docs completas | https://docs.cursor.com |

### Rules pre-construidas por tecnología

| Tecnología | URL |
|-----------|-----|
| TypeScript | https://cursor.directory/rules/typescript |
| React | https://cursor.directory/rules/react |
| Next.js | https://cursor.directory/rules/nextjs |
| Python | https://cursor.directory/rules/python |
| Go | https://cursor.directory/rules/go |
| Rust | https://cursor.directory/rules/rust |
| Todas las rules | https://cursor.directory/rules |
| Colección GitHub (77 rules curadas) | https://github.com/cursorrulespacks/cursorrules-collection |

### Estándares y referencias

| Recurso | URL |
|---------|-----|
| Conventional Commits spec | https://www.conventionalcommits.org |
| Agent Skills open standard | https://agentskills.io/ |
| MCP open standard | https://modelcontextprotocol.io |
| TypeScript strict handbook | https://www.typescriptlang.org/tsconfig#strict |

---

## Adaptar a otro stack

### Si usas npm/yarn en vez de pnpm

En `CLAUDE.md`, cambiar los comandos:

```markdown
## Common Commands
npm install / yarn
npm run dev / yarn dev
```

En `.claude/skills/*/SKILL.md`, reemplazar `pnpm` por tu gestor.

### Si el proyecto no es TypeScript

- Eliminar `.cursor/rules/typescript-standards.mdc`
- Actualizar `.claude/rules/code-style.md` con las convenciones del lenguaje
- Ajustar el `allowed-tools` en skills para no incluir `pnpm typecheck`

### Para monorepos

Añadir skills en cada paquete:

```
packages/
├── api/.claude/skills/
└── frontend/.claude/skills/
```

Claude Code descubre automáticamente skills en subdirectorios cuando trabajas en esos directorios.
# ai-backbone

import { dashboardClientScript } from './dashboard.script'
import { tailwindLayout } from './shared/tailwind-layout'

const dashboardBody = `
<header class="sticky top-0 z-20 border-b border-white/70 bg-white/70 backdrop-blur-xl">
  <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">WhatsApp RAG</p>
      <h1 class="text-xl font-semibold tracking-tight">Dashboard</h1>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      <span id="user-label" class="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">...</span>
      <button id="logout-btn" type="button" class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cerrar sesión</button>
    </div>
  </div>
</header>

<main class="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
  <section class="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-card backdrop-blur sm:p-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Conexión</p>
        <h2 class="text-lg font-semibold tracking-tight">Estado de WhatsApp</h2>
      </div>
      <span id="wa-badge" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Comprobando...</span>
    </div>

    <div class="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p id="qr-status-msg" class="text-sm text-slate-600">Consultando estado actual del cliente...</p>
        <a href="/qr" target="_blank" rel="noopener" class="mt-3 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-700">Abrir vista QR legacy</a>
      </div>
      <img id="qr-img" src="" alt="WhatsApp QR" width="260" height="260" class="hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/10">
    </div>
  </section>

  <section class="grid items-stretch gap-6 lg:grid-cols-2">
    <article class="flex h-full min-h-[480px] flex-col rounded-3xl border border-white/80 bg-white/80 p-5 shadow-card backdrop-blur sm:p-6">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ingest</p>
        <h2 class="text-lg font-semibold tracking-tight">Ingestar URL</h2>
        <p class="mt-1 text-sm text-slate-500">Pega una o varias URLs, una por línea.</p>
      </div>

      <form id="form-url" class="flex flex-1 flex-col gap-4" novalidate>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Listado de URLs</span>
          <textarea id="urls-input" rows="8" placeholder="https://ejemplo.com/articulo
https://otro.com/doc" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"></textarea>
        </label>
        <div class="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Formato: una URL por línea</span>
          <span id="url-count">0 URLs</span>
        </div>
        <button id="btn-url" type="submit" class="mt-auto w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60">Ingestar URLs</button>
      </form>

      <pre id="result-url" class="mt-4 hidden max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-2xl border px-4 py-3 text-xs"></pre>
    </article>

    <article class="flex h-full min-h-[480px] flex-col rounded-3xl border border-white/80 bg-white/80 p-5 shadow-card backdrop-blur sm:p-6">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ingest</p>
        <h2 class="text-lg font-semibold tracking-tight">Ingestar fichero</h2>
        <p class="mt-1 text-sm text-slate-500">Sube un archivo local para procesarlo en el RAG.</p>
      </div>

      <form id="form-file" class="flex flex-1 flex-col gap-4" novalidate>
        <input id="file-input" name="file" type="file" class="hidden">
        <div class="rounded-2xl border border-slate-200 bg-white p-3">
          <div class="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <button id="pick-file-btn" type="button" class="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300">
              Seleccionar archivo
            </button>
            <span id="file-name" class="min-w-0 flex-1 truncate text-sm text-slate-600">Ningún archivo seleccionado</span>
          </div>
        </div>
        <button id="btn-file" type="submit" class="mt-auto w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60">Subir fichero</button>
      </form>

      <pre id="result-file" class="mt-4 hidden max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-2xl border px-4 py-3 text-xs"></pre>
    </article>
  </section>
</main>
`

export function dashboardView(): string {
  return tailwindLayout({
    title: 'Emilio · Dashboard',
    bodyClassName:
      'min-h-screen bg-[radial-gradient(1200px_500px_at_0%_-10%,rgba(56,189,248,0.14),transparent),radial-gradient(1200px_600px_at_100%_120%,rgba(148,163,184,0.18),transparent)] bg-slate-100 font-sans text-slate-900',
    bodyHtml: dashboardBody,
    fontWeights: '400;500;600;700;800',
    tailwindExtend: "boxShadow: { card: '0 20px 60px rgba(15, 23, 42, 0.12)' }",
    script: dashboardClientScript,
  })
}

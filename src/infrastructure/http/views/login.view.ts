import { tailwindLayout } from './shared/tailwind-layout'

const loginBody = `
<main class="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-4 py-10">
  <section class="w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-8 shadow-soft backdrop-blur-xl sm:p-10">
    <div class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">WhatsApp RAG</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Acceso seguro</h1>
      <p class="mt-2 text-sm text-slate-600">Inicia sesión para gestionar la ingesta y el estado de WhatsApp.</p>
    </div>

    <form id="login-form" class="space-y-4" novalidate>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usuario</span>
        <input id="username" type="text" autocomplete="username" spellcheck="false" placeholder="admin"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contraseña</span>
        <input id="password" type="password" autocomplete="current-password" placeholder="••••••••"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
      </label>

      <p id="error-msg" role="alert" class="hidden rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"></p>

      <button id="login-btn" type="submit"
        class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
        Entrar
      </button>
    </form>
  </section>
</main>
`

const loginScript = String.raw`;(() => {
  'use strict'

  const form = document.getElementById('login-form')
  const btn = document.getElementById('login-btn')
  const errEl = document.getElementById('error-msg')

  function showError(msg) {
    if (!errEl) return
    errEl.textContent = msg
    errEl.classList.remove('hidden')
  }

  function hideError() {
    if (!errEl) return
    errEl.classList.add('hidden')
    errEl.textContent = ''
  }

  async function isSessionAlive() {
    try {
      const res = await fetch('/api/me')
      return res.ok
    } catch {
      return false
    }
  }

  async function doLogin() {
    const username = document.getElementById('username')?.value.trim() ?? ''
    const password = document.getElementById('password')?.value ?? ''
    if (!username || !password) {
      showError('Introduce usuario y contraseña.')
      return
    }

    if (btn) btn.disabled = true
    hideError()

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(data.error || 'Credenciales incorrectas.')
        return
      }
      if (data.token) localStorage.setItem('jwtToken', data.token)
      window.location.replace('/dashboard')
    } catch {
      showError('Error de red. Inténtalo de nuevo.')
    } finally {
      if (btn) btn.disabled = false
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    void doLogin()
  })

  void isSessionAlive().then((alive) => {
    if (alive) window.location.replace('/dashboard')
  })
})()`

export function loginView(): string {
  return tailwindLayout({
    title: 'Emilio · Login',
    bodyClassName:
      'min-h-screen bg-[radial-gradient(1200px_500px_at_10%_-20%,rgba(125,211,252,0.20),transparent),radial-gradient(1200px_500px_at_90%_120%,rgba(129,140,248,0.18),transparent)] bg-slate-100 font-sans text-slate-900',
    bodyHtml: loginBody,
    fontWeights: '400;500;600;700',
    tailwindExtend: "boxShadow: { soft: '0 20px 60px rgba(15, 23, 42, 0.18)' }",
    script: loginScript,
  })
}

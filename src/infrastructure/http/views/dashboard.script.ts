export const dashboardClientScript = String.raw`;(() => {
  'use strict'

  const storedToken = localStorage.getItem('jwtToken')

  function authHeaders(extra) {
    const headers = {}
    if (storedToken) headers.Authorization = 'Bearer ' + storedToken
    if (extra) Object.assign(headers, extra)
    return headers
  }

  function byId(id) {
    return document.getElementById(id)
  }

  function redirectToLogin() {
    window.location.replace('/login')
  }

  function showResult(id, ok, text) {
    const el = byId(id)
    if (!el) return
    el.textContent = text
    el.classList.remove(
      'hidden',
      'border-emerald-200',
      'bg-emerald-50',
      'text-emerald-700',
      'border-rose-200',
      'bg-rose-50',
      'text-rose-700',
    )
    if (ok) {
      el.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-700')
      return
    }
    el.classList.add('border-rose-200', 'bg-rose-50', 'text-rose-700')
  }

  function setLoading(id, loading) {
    const button = byId(id)
    if (button) button.disabled = loading
  }

  function setQrState(status, qrDataUrl) {
    const badge = byId('wa-badge')
    const msg = byId('qr-status-msg')
    const img = byId('qr-img')
    if (!badge || !msg || !img) return

    if (status === 'connected') {
      badge.textContent = 'Conectado'
      badge.className =
        'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200'
      msg.textContent = 'WhatsApp está conectado y operativo.'
      img.classList.add('hidden')
      return
    }

    if (status === 'waiting_qr') {
      badge.textContent = 'Esperando QR'
      badge.className =
        'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200'
      msg.textContent = 'Escanea el QR desde WhatsApp en tu móvil.'
      if (qrDataUrl) {
        img.src = qrDataUrl
        img.classList.remove('hidden')
      }
      return
    }

    badge.textContent = 'Inicializando'
    badge.className =
      'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200'
    msg.textContent = 'El servicio está arrancando, espera unos segundos.'
    img.classList.add('hidden')
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/me', { headers: authHeaders() })
      if (!res.ok) {
        redirectToLogin()
        return
      }
      const data = await res.json()
      const label = byId('user-label')
      if (label) label.textContent = data.username + ' · ' + data.role + ' · ' + data.orgId
    } catch {
      redirectToLogin()
    }
  }

  async function refreshQr() {
    try {
      const res = await fetch('/api/qr', { headers: authHeaders() })
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      if (!res.ok) throw new Error('No se pudo consultar /api/qr')
      const data = await res.json()
      setQrState(data.status, data.qrDataUrl)
    } catch {
      setQrState('initializing')
      const msg = byId('qr-status-msg')
      if (msg) msg.textContent = 'No se pudo obtener el estado de WhatsApp.'
    }
  }

  byId('logout-btn')?.addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', headers: authHeaders() })
    } catch {
      // no-op: se continúa limpiando cliente
    }
    localStorage.removeItem('jwtToken')
    redirectToLogin()
  })

  const urlsInput = byId('urls-input')
  const urlCount = byId('url-count')
  urlsInput?.addEventListener('input', () => {
    const raw = urlsInput.value.trim()
    const total = raw ? raw.split('\n').map((line) => line.trim()).filter(Boolean).length : 0
    if (urlCount) urlCount.textContent = total + (total === 1 ? ' URL' : ' URLs')
  })

  const fileInput = byId('file-input')
  const fileName = byId('file-name')
  byId('pick-file-btn')?.addEventListener('click', () => {
    fileInput?.click()
  })
  fileInput?.addEventListener('change', () => {
    if (!fileName) return
    if (!fileInput?.files || fileInput.files.length === 0) {
      fileName.textContent = 'Ningún archivo seleccionado'
      return
    }
    fileName.textContent = fileInput.files[0].name
  })

  byId('form-url')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const raw = byId('urls-input')?.value.trim() ?? ''
    if (!raw) {
      showResult('result-url', false, 'Introduce al menos una URL.')
      return
    }

    const urls = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    setLoading('btn-url', true)
    try {
      const res = await fetch('/api/ingest/url', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ urls }),
      })

      if (res.status === 401) {
        redirectToLogin()
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data.results) {
        showResult('result-url', false, data.error || 'Error al ingestar URLs.')
        return
      }

      const lines = (data.results || []).map(
        (row) => (row.ok ? 'OK  ' : 'ERR ') + row.url + (row.error ? ' -> ' + row.error : ''),
      )

      showResult('result-url', data.ok !== false, lines.join('\n') || JSON.stringify(data, null, 2))
    } catch {
      showResult('result-url', false, 'Error de red. Inténtalo de nuevo.')
    } finally {
      setLoading('btn-url', false)
    }
  })

  byId('form-file')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = byId('file-input')
    if (!input?.files || input.files.length === 0) {
      showResult('result-file', false, 'Selecciona un fichero primero.')
      return
    }

    const formData = new FormData()
    formData.append('file', input.files[0])
    setLoading('btn-file', true)

    try {
      const res = await fetch('/api/ingest/file', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })

      if (res.status === 401) {
        redirectToLogin()
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showResult('result-file', false, data.error || 'Error al subir el fichero.')
        return
      }

      showResult('result-file', true, JSON.stringify(data, null, 2))
      input.value = ''
      if (fileName) fileName.textContent = 'Ningún archivo seleccionado'
    } catch {
      showResult('result-file', false, 'Error de red. Inténtalo de nuevo.')
    } finally {
      setLoading('btn-file', false)
    }
  })

  void checkSession()
  void refreshQr()
  setInterval(refreshQr, 15000)
})()`

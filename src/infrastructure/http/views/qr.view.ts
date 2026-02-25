import { tailwindLayout } from './shared/tailwind-layout'

type QrStatus = 'connected' | 'initializing' | 'waiting_qr'

interface QrViewData {
  status: QrStatus
  qrDataUrl?: string
  refreshSeconds?: number
}

export function qrView(data: QrViewData): string {
  const title =
    data.status === 'connected'
      ? 'WhatsApp conectado'
      : data.status === 'waiting_qr'
        ? 'Escanea el QR'
        : 'Inicializando WhatsApp'

  const subtitle =
    data.status === 'connected'
      ? 'La sesión está activa y lista para enviar/recibir mensajes.'
      : data.status === 'waiting_qr'
        ? 'Abre WhatsApp en tu móvil y vincula este dispositivo.'
        : 'Esperando a que el cliente de WhatsApp termine de arrancar.'

  const badgeClass =
    data.status === 'connected'
      ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
      : data.status === 'waiting_qr'
        ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'

  const badgeText =
    data.status === 'connected' ? 'Conectado' : data.status === 'waiting_qr' ? 'Esperando QR' : 'Inicializando'

  const qrBlock =
    data.status === 'waiting_qr' && data.qrDataUrl
      ? `<img src="${data.qrDataUrl}" alt="WhatsApp QR" width="300" height="300" class="mx-auto rounded-2xl ring-1 ring-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">`
      : `<div class="mx-auto grid h-[300px] w-[300px] place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
           <p class="text-sm text-slate-500">${
             data.status === 'connected' ? 'No hay QR pendiente' : 'Aún no hay QR disponible'
           }</p>
         </div>`

  const refreshText =
    data.refreshSeconds && data.refreshSeconds > 0
      ? `La pantalla se actualiza cada ${data.refreshSeconds}s automáticamente.`
      : 'Actualiza la página manualmente si cambia el estado.'

  return tailwindLayout({
    title: `Emilio · ${title}`,
    bodyClassName: 'min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 font-sans',
    bodyHtml: `
<main class="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10">
  <section class="w-full rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-300/20 backdrop-blur sm:p-8">
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Emilio QR</h1>
      <span class="rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}">${badgeText}</span>
    </div>
    <p class="mb-6 text-sm text-slate-600 sm:text-base">${subtitle}</p>
    ${qrBlock}
    <div class="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
      <p class="font-medium text-slate-700">Pasos rápidos</p>
      <p class="mt-1">WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p>
      <p class="mt-2 text-xs text-slate-500">${refreshText}</p>
    </div>
  </section>
</main>`,
    fontWeights: '400;500;600;700',
    headExtras:
      data.refreshSeconds && data.refreshSeconds > 0
        ? `<meta http-equiv="refresh" content="${data.refreshSeconds}">`
        : '',
  })
}

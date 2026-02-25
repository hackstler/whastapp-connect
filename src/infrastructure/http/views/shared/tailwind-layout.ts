interface TailwindLayoutData {
  lang?: string
  title: string
  bodyClassName: string
  bodyHtml: string
  fontWeights: string
  tailwindExtend?: string
  headExtras?: string
  script?: string
}

export function tailwindLayout(data: TailwindLayoutData): string {
  const lang = data.lang ?? 'es'
  const extend = data.tailwindExtend ?? ''
  const script = data.script ? `<script>\n${data.script}\n</script>` : ''
  const headExtras = data.headExtras ?? ''

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@${data.fontWeights}&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Manrope', 'sans-serif'] },
          ${extend}
        }
      }
    }
  </script>
  ${headExtras}
</head>
<body class="${data.bodyClassName}">
  ${data.bodyHtml}
  ${script}
</body>
</html>`
}

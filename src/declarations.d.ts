declare module 'qrcode' {
  function toDataURL(text: string, options?: { width?: number; margin?: number }): Promise<string>
  export default { toDataURL }
}

declare module 'qrcode-terminal' {
  function generate(text: string, options?: { small?: boolean }): void
  export default { generate }
}

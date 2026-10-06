export const isUrl = (s: string) => /^https?:\/\//.test(s)
export const isProto = (s: string) => /^\/\//.test(s)
export const any = (s: string) => /\/\*|\*\//.test(s)

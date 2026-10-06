import type { Metadata, Viewport } from 'next'
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#1a1714' }, { color: '#f7f5f0' }] }
export const metadata: Metadata = { title: 'Proof' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f7f5f0" />
      </head>
      <body className="bg-[#fff]">{children}</body>
    </html>
  )
}

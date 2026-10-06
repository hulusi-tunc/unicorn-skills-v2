import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Proof', theme_color: '#f7f5f0', background_color: '#f7f5f0', display: 'standalone' }
}

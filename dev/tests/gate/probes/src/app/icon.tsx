import { ImageResponse } from 'next/og'
export default function Icon() {
  return new ImageResponse(<div style={{ background: '#2b2622', width: '100%', height: '100%' }} />)
}

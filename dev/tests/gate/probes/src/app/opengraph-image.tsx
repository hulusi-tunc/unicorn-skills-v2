import { ImageResponse } from 'next/og'
export default function Image() {
  return new ImageResponse(<div style={{ background: '#f7f5f0', color: '#2b2622', fontSize: 64 }}>Proof</div>)
}

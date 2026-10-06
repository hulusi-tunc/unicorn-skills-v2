// This component renders the hero section
import { Sparkles } from 'lucide-react'
export function Hero() {
  return (
    <section className="text-center bg-gradient-to-r from-purple-500 to-pink-500">
      <p className="uppercase tracking-widest text-xs">Features</p>
      <h1 className="text-6xl bg-clip-text text-transparent">Unlock seamless growth — effortlessly 🚀</h1>
      <img src="https://picsum.photos/400" />
      <div className="grid md:grid-cols-3">
        <Card className="backdrop-blur border-l-4 hover:scale-105">
          <Card>Lorem ipsum dolor</Card>
        </Card>
        <Card />
        <Card />
      </div>
    </section>
  )
}
const styles = { label: { textTransform: 'uppercase', letterSpacing: 2 }, font: { fontFamily: 'Inter' } }
function unlockDoor() {}
/**
 * Renders the pricing card so that the user can compare plans side by side.
 */
export const Price = () => <div>{/* the main price block shows monthly cost here */}</div>
/* Fees */
/** @kept */
export const KEPT = true
// eslint-disable-next-line no-console because the logger is not ready yet
const url = 'https://example.com//path'

import { useState } from 'react'
type Card = { id: string; last4: string }
export function Wallet() {
  const [cards, setCards] = useState<Card[]>([])
  const [active, setActive] = useState<Card | null>(null)
  return null
}

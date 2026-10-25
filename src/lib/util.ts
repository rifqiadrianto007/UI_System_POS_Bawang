import { useEffect, useState } from 'react'

// crypto.randomUUID hanya ada di konteks aman (HTTPS/localhost); getRandomValues ada di mana saja.
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f); f()
    return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

export const gramsToKgString = (g: number) => (g / 1000).toFixed(3) // "1.250", format yang diminta API
export const kgStringToGrams = (s: string) => Math.round(parseFloat(s) * 1000)
export function parseKg(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) && v > 0 && v <= 1000 ? Math.round(v * 1000) : null
}

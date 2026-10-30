import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Item { id: number; kind: 'success' | 'error'; text: string }
interface Api { success: (text: string) => void; error: (text: string) => void }
const Ctx = createContext<Api | null>(null)

export const useToast = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast harus di dalam ToastProvider')
  return c
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const seq = useRef(0)
  const push = useCallback((kind: Item['kind'], text: string) => {
    const id = ++seq.current
    setItems((l) => [...l, { id, kind, text }])
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3500)
  }, [])
  const api = useMemo<Api>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((i) => (
          <div key={i.id} role="status" className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${i.kind === 'success' ? 'border-surface-border bg-surface text-brand' : 'border-danger/40 bg-white text-danger'}`}>
            {i.kind === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

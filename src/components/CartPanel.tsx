import { useState } from 'react'
import { Banknote, Loader2, Minus, Plus, QrCode, ShoppingCart, Trash2 } from 'lucide-react'
import { formatKg, formatKgStr, rupiah } from '../lib/format'
import { kgStringToGrams, parseKg } from '../lib/util'
import type { CartLine, Category, Method, Quote } from '../lib/types'

interface Props {
  lines: CartLine[]; quote?: Quote; ready: boolean; error: string | null
  category: Category; setCategory: (c: Category) => void
  name: string; setName: (s: string) => void
  method: Method; setMethod: (m: Method) => void
  setGrams: (id: number, g: number) => void; remove: (id: number) => void
  clear: () => void; onPay: () => void
}

function WeightInput({ grams, onChange }: { grams: number; onChange: (g: number) => void }) {
  const [txt, setTxt] = useState<string | null>(null)
  const commit = () => { if (txt !== null) { const g = parseKg(txt); if (g) onChange(g); setTxt(null) } }
  return (
    <input inputMode="decimal" value={txt ?? formatKg(grams)} aria-label="Berat (kg)"
      onFocus={(e) => { setTxt(formatKg(grams)); e.currentTarget.select() }}
      onChange={(e) => setTxt(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="w-14 rounded-md border border-transparent bg-white py-1 text-center text-sm font-semibold outline-none focus:border-brand" />
  )
}

export default function CartPanel(p: Props) {
  const count = p.lines.length
  const empty = count === 0
  const loading = !empty && !p.ready && !p.error
  const seg = (active: boolean) => `flex-1 rounded-lg py-2 text-sm font-semibold ${active ? 'bg-brand text-white' : 'text-ink'}`

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-base font-bold">Ringkasan Pembayaran</h2>
        {!empty && <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-brand">{count} Item</span>}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="mb-1.5 text-sm font-bold">Jenis pembeli</p>
          <div className="flex gap-1 rounded-xl bg-surface p-1">
            <button onClick={() => p.setCategory('ecer')} className={seg(p.category === 'ecer')}>Ecer</button>
            <button onClick={() => p.setCategory('grosir')} className={seg(p.category === 'grosir')}>Grosir</button>
          </div>
          <input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="Nama pelanggan (opsional)" maxLength={60}
            className="mt-2 w-full rounded-xl border border-surface-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>

        <p className="text-sm font-bold">Item Dipilih</p>
        {empty ? (
          <div className="grid place-items-center gap-2 rounded-xl bg-surface py-8 text-ink-muted">
            <ShoppingCart size={26} /><span className="text-xs font-semibold">Keranjang masih kosong</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {p.lines.map((l) => {
              const q = p.quote?.items.find((i) => i.product_id === l.product.id && kgStringToGrams(i.weight_kg) === l.grams)
              return (
                <li key={l.product.id} className="rounded-xl bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{l.product.name}</p>
                      <p className="text-xs text-ink-muted">{q ? `${rupiah(q.price_per_kg)} x ${formatKgStr(q.weight_kg)}kg` : 'menghitung...'}</p>
                      <p className="mt-1 text-sm font-bold text-brand">{q ? rupiah(q.line_total) : '...'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => (l.grams > 250 ? p.setGrams(l.product.id, l.grams - 250) : p.remove(l.product.id))} aria-label="Kurangi" className="grid size-8 place-items-center rounded-md bg-white text-brand"><Minus size={16} /></button>
                        <WeightInput grams={l.grams} onChange={(g) => p.setGrams(l.product.id, g)} />
                        <button onClick={() => p.setGrams(l.product.id, l.grams + 250)} aria-label="Tambah" className="grid size-8 place-items-center rounded-md bg-white text-brand"><Plus size={16} /></button>
                      </div>
                      <button onClick={() => p.remove(l.product.id)} aria-label="Hapus item" className="text-danger"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="space-y-1 border-t border-dashed border-surface-border pt-3 text-sm">
          <div className="flex justify-between text-ink-muted"><span>Sub total</span><span>{p.quote && !empty ? rupiah(p.quote.subtotal) : 'Rp 0'}</span></div>
        </div>
        <div className="border-t border-dashed border-surface-border pt-3">
          <p className="text-sm text-ink-muted">Total pembayaran</p>
          <p className={`flex items-center gap-2 text-2xl font-extrabold text-brand ${loading ? 'opacity-50' : ''}`}>
            {empty ? 'Rp 0' : p.quote ? rupiah(p.quote.total) : '...'}
            {loading && <Loader2 size={18} className="animate-spin" />}
          </p>
          {p.error && <p role="alert" className="mt-1 text-xs text-danger">{p.error}</p>}
        </div>

        <div className="rounded-xl bg-surface p-3">
          <p className="mb-2 text-xs text-ink-muted">Metode pembayaran:</p>
          <div className="flex gap-2">
            {([['cash', 'Tunai', Banknote], ['qris', 'QRIS', QrCode]] as const).map(([m, label, Icon]) => (
              <button key={m} onClick={() => p.setMethod(m)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${p.method === m ? 'border-brand bg-white text-brand' : 'border-transparent bg-white/60 text-ink-muted'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-surface-border p-4">
        <button onClick={p.onPay} disabled={!p.ready} className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-gray-300">Bayar</button>
        <button onClick={() => { if (window.confirm('Kosongkan keranjang?')) p.clear() }} disabled={empty}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger py-3 font-semibold text-danger disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-300">
          <Trash2 size={16} /> Hapus keranjang
        </button>
      </div>
    </div>
  )
}

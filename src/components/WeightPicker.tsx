import { useState, type FormEvent } from 'react'
import Modal from './Modal'
import { formatKg } from '../lib/format'
import { parseKg } from '../lib/util'
import type { Product } from '../lib/types'

const CHIPS = [250, 500, 1000, 2000, 5000]

export default function WeightPicker({ product, onAdd, onClose }: { product: Product; onAdd: (grams: number) => void; onClose: () => void }) {
  const [val, setVal] = useState('')
  const grams = parseKg(val)
  const submit = (e: FormEvent) => { e.preventDefault(); if (grams) onAdd(grams) }
  return (
    <Modal title={product.name} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">Pilih berat</p>
      <div className="grid grid-cols-3 gap-2">
        {CHIPS.map((g) => (
          <button key={g} onClick={() => onAdd(g)} className="rounded-xl border border-surface-border bg-surface py-3 font-semibold text-brand active:bg-brand active:text-white">
            {formatKg(g)} kg
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="Berat manual (kg), mis. 3,75"
          className="min-w-0 flex-1 rounded-xl border border-surface-border px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <button type="submit" disabled={!grams} className="rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-40">Tambah</button>
      </form>
    </Modal>
  )
}

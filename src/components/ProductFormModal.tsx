import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import MoneyField from './MoneyField'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { formErrors } from '../lib/errors'
import type { ProductAdmin } from '../lib/types'

// Formulir barang: hanya nama (sudah termasuk grade) dan tiga harga jual. Stok masuk hanya lewat kulak, sortir, dan finalisasi.
export default function ProductFormModal({ product, onClose }: { product?: ProductAdmin; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(product?.name ?? '')
  const [retail, setRetail] = useState(product ? String(product.price_retail) : '')
  const [p3, setP3] = useState(product ? String(product.price_3kg) : '')
  const [p5, setP5] = useState(product ? String(product.price_5kg) : '')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  const warn = Number(p3) > Number(retail) || Number(p5) > Number(p3)
    ? 'Harga 3 kg dan 5 kg biasanya tidak lebih mahal dari harga di atasnya. Periksa kembali jika itu bukan disengaja.' : ''

  async function save() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nama wajib diisi.'
    if (!(Number(retail) >= 1)) e.price_retail = 'Harga ecer wajib diisi.'
    if (!(Number(p3) >= 1)) e.price_3kg = 'Harga 3 kg wajib diisi.'
    if (!(Number(p5) >= 1)) e.price_5kg = 'Harga 5 kg wajib diisi.'
    setErrs(e); setGeneral('')
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api(product ? `/products/${product.id}` : '/products', {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify({ name: name.trim(), price_retail: Number(retail), price_3kg: Number(p3), price_5kg: Number(p5) }),
      })
      await Promise.all([qc.invalidateQueries({ queryKey: ['products-admin'] }), qc.invalidateQueries({ queryKey: ['products'] })])
      toast.success(product ? 'Barang berhasil diperbarui' : 'Barang berhasil ditambahkan')
      onClose()
    } catch (err) {
      const r = formErrors(err); setErrs(r.fields); setGeneral(r.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title={product ? 'Ubah Barang' : 'Tambah Barang Baru'} onClose={() => !busy && onClose()}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Batal</button>
          <button onClick={save} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </div>
      }>
      <div className="space-y-4">
        <label className="block text-sm">Nama barang <span className="text-danger">*</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Contoh: Merah A"
            className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand/20 ${errs.name ? 'border-danger' : 'border-surface-border focus:border-brand'}`} />
          {errs.name ? <span role="alert" className="mt-1 block text-xs text-danger">{errs.name}</span> : <span className="mt-1 block text-xs text-ink-muted">Sertakan grade pada nama (Merah A, Putih B).</span>}
        </label>
        <MoneyField label="Harga ecer per kg" value={retail} onChange={setRetail} error={errs.price_retail} />
        <MoneyField label="Harga per kg untuk pembelian 3 kg ke atas" value={p3} onChange={setP3} error={errs.price_3kg} />
        <MoneyField label="Harga per kg untuk 5 kg ke atas dan grosir" value={p5} onChange={setP5} error={errs.price_5kg} />
        {warn && <p className="rounded-lg bg-surface p-3 text-xs text-ink-muted">{warn}</p>}
        {product && <p className="text-xs text-ink-muted">Perubahan harga tidak mengubah transaksi yang sudah tercatat.</p>}
        {general && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
      </div>
    </Modal>
  )
}

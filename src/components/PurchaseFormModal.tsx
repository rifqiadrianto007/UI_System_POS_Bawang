import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import MoneyField from './MoneyField'
import { useToast } from './Toast'
import { useSuppliers } from '../hooks/usePurchases'
import { api } from '../lib/api'
import { todayWib } from '../lib/dates'
import { formErrors } from '../lib/errors'
import { formatKgStr, rupiah } from '../lib/format'
import { gramsToKgString, kgStringToGrams, parseKg } from '../lib/util'
import type { Purchase } from '../lib/types'

// Catat kulak (berat kotor dan harga per kg). Stok baru muncul setelah disortir menjadi lot dan difinalisasi.
export default function PurchaseFormModal({ purchase, onClose, onManageSuppliers }: { purchase?: Purchase; onClose: () => void; onManageSuppliers: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const sup = useSuppliers()
  const [supplier, setSupplier] = useState(purchase ? String(purchase.supplier_id) : '')
  const [date, setDate] = useState(purchase?.purchased_at ?? todayWib())
  const [gross, setGross] = useState(purchase ? formatKgStr(purchase.gross_weight_kg) : '')
  const [price, setPrice] = useState(purchase ? String(purchase.price_per_kg) : '')
  const [notes, setNotes] = useState(purchase?.notes ?? '')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  const g = parseKg(gross)
  const lotsG = purchase ? kgStringToGrams(purchase.lots_total_kg) : 0
  const preview = g && Number(price) ? Math.round((g * Number(price)) / 1000) : null

  async function save() {
    const e: Record<string, string> = {}
    if (!supplier) e.supplier_id = 'Pilih supplier.'
    if (!date) e.purchased_at = 'Tanggal wajib diisi.'
    if (!g) e.gross_weight_kg = 'Berat kotor harus lebih dari 0.'
    else if (g < lotsG) e.gross_weight_kg = `Tidak boleh kurang dari berat bersih yang sudah disortir (${formatKgStr(gramsToKgString(lotsG))} kg).`
    if (!(Number(price) >= 1)) e.price_per_kg = 'Harga per kg wajib diisi.'
    setErrs(e); setGeneral('')
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api(purchase ? `/purchases/${purchase.id}` : '/purchases', {
        method: purchase ? 'PUT' : 'POST',
        body: JSON.stringify({ supplier_id: Number(supplier), purchased_at: date, gross_weight_kg: gramsToKgString(g!), price_per_kg: Number(price), ...(notes.trim() ? { notes: notes.trim() } : purchase ? { notes: null } : {}) }),
      })
      await qc.invalidateQueries({ queryKey: ['purchases'] }); await qc.invalidateQueries({ queryKey: ['stock-report'] })
      toast.success(purchase ? 'Kulak diperbarui' : 'Kulak dicatat. Lanjutkan dengan menyortir menjadi lot.')
      onClose()
    } catch (err) { const r = formErrors(err); setErrs(r.fields); setGeneral(r.message) } finally { setBusy(false) }
  }

  const field = (bad?: string) => `mt-1 w-full rounded-xl border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand/20 ${bad ? 'border-danger' : 'border-surface-border focus:border-brand'}`
  return (
    <Modal title={purchase ? 'Ubah Kulak' : 'Catat Kulak Baru'} onClose={() => !busy && onClose()}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Batal</button>
          <button onClick={save} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </div>
      }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm">Supplier <span className="text-danger">*</span>
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field(errs.supplier_id)}>
              <option value="">Pilih supplier</option>
              {(sup.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {errs.supplier_id && <p role="alert" className="mt-1 text-xs text-danger">{errs.supplier_id}</p>}
          <button type="button" onClick={onManageSuppliers} className="mt-1 text-xs font-semibold text-brand underline">{sup.data?.length === 0 ? 'Belum ada supplier, tambah dulu' : 'Kelola supplier'}</button>
        </div>
        <label className="block text-sm">Tanggal kulak <span className="text-danger">*</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field(errs.purchased_at)} />
          {errs.purchased_at && <span role="alert" className="mt-1 block text-xs text-danger">{errs.purchased_at}</span>}
        </label>
        <label className="block text-sm">Berat kotor (kg) <span className="text-danger">*</span>
          <input value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" placeholder="Contoh: 100" className={field(errs.gross_weight_kg)} />
          {errs.gross_weight_kg ? <span role="alert" className="mt-1 block text-xs text-danger">{errs.gross_weight_kg}</span> : <span className="mt-1 block text-xs text-ink-muted">Hasil timbang bawang baru datang, sebelum dibersihkan.</span>}
        </label>
        <MoneyField label="Harga kulak per kg *" value={price} onChange={setPrice} error={errs.price_per_kg} />
        {preview !== null && <p className="rounded-xl bg-surface p-3 text-sm">Perkiraan total biaya: <b>{rupiah(preview)}</b></p>}
        <label className="block text-sm">Catatan (opsional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className={field()} />
        </label>
        {general && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
      </div>
    </Modal>
  )
}

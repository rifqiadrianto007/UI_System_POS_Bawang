import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { formErrors } from '../lib/errors'
import { formatKgStr, rupiah } from '../lib/format'
import { gramsToKgString, kgStringToGrams, parseKgZero } from '../lib/util'
import { todayWib } from '../lib/dates'

const nowWib = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date())

// Hitung ulang stok display. Hasilnya permanen (tidak ada endpoint pembatalan), jadi selalu ada langkah konfirmasi.
export default function StockCountModal({ product, onClose }: { product: { id: number; name: string; stockKg: string }; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [val, setVal] = useState('')
  const [date, setDate] = useState(todayWib())
  const [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  const counted = parseKgZero(val)
  const system = kgStringToGrams(product.stockKg)
  const diff = counted === null ? null : counted - system // gram; negatif = susut

  async function submit() {
    if (counted === null) return
    setBusy(true); setGeneral(''); setErrs({})
    try {
      const r = await api<{ data: { diff_kg: string; loss_value: number } }>('/stock-counts', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id, counted_weight_kg: gramsToKgString(counted), counted_at: `${date} ${nowWib()}`, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      })
      await Promise.all(['stock-report', 'stock', 'stock-counts', 'products-admin', 'finance'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      const { diff_kg, loss_value } = r.data
      toast.success(`Hitung ulang ${product.name} tersimpan. Selisih ${formatKgStr(diff_kg)} kg${loss_value ? ` (${rupiah(loss_value)})` : ''}`)
      onClose()
    } catch (e) {
      const r = formErrors(e); setErrs(r.fields); setGeneral(r.message); setConfirm(false)
    } finally { setBusy(false) }
  }

  const footer = confirm ? (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={() => setConfirm(false)} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Periksa lagi</button>
      <button onClick={submit} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />} Ya, simpan</button>
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={onClose} className="rounded-xl border border-brand py-3 font-semibold text-brand">Batal</button>
      <button onClick={() => setConfirm(true)} disabled={counted === null || !date} className="rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-40">Lanjut</button>
    </div>
  )

  return (
    <Modal title={`Hitung ulang ${product.name}`} onClose={() => !busy && onClose()} footer={footer}>
      {confirm && diff !== null ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-surface p-4 text-center">
            <p className="text-ink-muted">Selisih yang akan dicatat</p>
            <p className={`text-3xl font-extrabold ${diff < 0 ? 'text-danger' : 'text-brand'}`}>{diff > 0 ? '+' : ''}{formatKgStr(gramsToKgString(diff))} kg</p>
            <p className="text-xs text-ink-muted">{diff < 0 ? 'Dicatat sebagai susut display' : diff > 0 ? 'Stok lebih, mengurangi nilai susut' : 'Tidak ada selisih'}</p>
          </div>
          <div className="flex justify-between"><span className="text-ink-muted">Stok sistem</span><span>{formatKgStr(product.stockKg)} kg</span></div>
          <div className="flex justify-between font-bold"><span>Hasil hitung</span><span>{formatKgStr(gramsToKgString(counted ?? 0))} kg</span></div>
          <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs text-danger"><AlertTriangle size={16} className="shrink-0" /> Hitung ulang tidak bisa dibatalkan setelah disimpan. Pastikan berat sudah benar.</p>
          {general && <p role="alert" className="text-danger">{general}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-surface p-3 text-sm">Stok sistem saat ini: <b>{formatKgStr(product.stockKg)} kg</b></p>
          <label className="block text-sm">Berat hasil hitung di display (kg)
            <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="Contoh: 12,5"
              className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-base font-semibold outline-none focus:ring-2 focus:ring-brand/20 ${errs.counted_weight_kg ? 'border-danger' : 'border-surface-border focus:border-brand'}`} />
            {errs.counted_weight_kg && <span role="alert" className="mt-1 block text-xs text-danger">{errs.counted_weight_kg}</span>}
          </label>
          {val && counted === null && <p className="text-xs text-danger">Masukkan angka yang valid (boleh 0).</p>}
          {diff !== null && <p className={`text-sm font-semibold ${diff < 0 ? 'text-danger' : 'text-brand'}`}>Selisih: {diff > 0 ? '+' : ''}{formatKgStr(gramsToKgString(diff))} kg</p>}
          <label className="block text-sm">Tanggal hitung
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-xl border border-surface-border px-4 py-2.5 text-sm outline-none focus:border-brand" />
            {errs.counted_at && <span role="alert" className="mt-1 block text-xs text-danger">{errs.counted_at}</span>}
          </label>
          <label className="block text-sm">Catatan (opsional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5 text-sm outline-none focus:border-brand" />
          </label>
          {general && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
        </div>
      )}
    </Modal>
  )
}

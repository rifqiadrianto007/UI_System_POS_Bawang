import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { formErrors } from '../lib/errors'
import { gramsToKgString, parseKgZero } from '../lib/util'
import { todayWib } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import { refreshStock } from '../hooks/usePurchases'

const nowWib = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date())
export default function StockCountModal({ product, onClose }: { product: { id: number; name: string; jenis: 'merah' | 'putih'; stockKg: string }; onClose: () => void }) {
  const qc = useQueryClient(), toast = useToast()
  const [val, setVal] = useState(''), [date, setDate] = useState(todayWib()), [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [general, setGeneral] = useState(''), [errs, setErrs] = useState<Record<string,string>>({})
  const counted = parseKgZero(val)
  async function submit() {
    if (counted === null) return
    setBusy(true); setGeneral(''); setErrs({})
    try {
      const r = await api<{ data: { diff_kg: string; loss_value: number; surplus_kg?: string; surplus_value?: number } }>('/stock-counts', { method: 'POST', body: JSON.stringify({ product_id: product.id, counted_weight_kg: gramsToKgString(counted), counted_at: `${date} ${nowWib()}`, notes: notes.trim() || null }) })
      // The stock report owns the per-product “Susut display” cell. Force its
      // active query to refetch after the count is saved so the table reflects
      // the new shrink value immediately.
      await Promise.all([
        refreshStock(qc),
        qc.invalidateQueries({ queryKey: ['stock-counts'], refetchType: 'active' }),
        qc.refetchQueries({ queryKey: ['stock-report'], type: 'active' }),
      ])
      toast.success(`Hitung ulang ${product.name} tersimpan. ${Number(r.data.surplus_kg ?? 0) > 0 ? `Selisih lebih ${r.data.surplus_kg} kg (${rupiah(r.data.surplus_value ?? 0)}), tidak menambah stok.` : `Susut ${formatKgStr(r.data.diff_kg)} kg (${rupiah(r.data.loss_value)}).`}`); onClose()
    } catch (e) { const r = formErrors(e); setErrs(r.fields); setGeneral(r.message); setConfirm(false) } finally { setBusy(false) }
  }
  return <Modal title={`Hitung ulang ${product.name}`} onClose={() => !busy && onClose()} footer={<div className="grid grid-cols-2 gap-2"><button onClick={onClose} className="rounded-xl border border-brand py-3 font-semibold text-brand">Batal</button><button onClick={() => confirm ? void submit() : setConfirm(true)} disabled={counted === null || busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />}{confirm ? 'Ya, simpan' : 'Lanjut'}</button></div>}>
    <div className="space-y-4"><p className="rounded-xl bg-surface p-3 text-sm">Fungsi ini hanya mengoreksi stok. Jika hasil lebih besar dari sistem, selisih dicatat sebagai selisih lebih dan tidak menambah stok.</p>
    {confirm && counted !== null && <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs text-danger"><AlertTriangle size={16} className="shrink-0"/>Periksa kembali hasil hitung sebelum disimpan.</p>}
    <label className="block text-sm">Berat hasil hitung (kg)<input value={val} onChange={e=>setVal(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5"/></label>
    <label className="block text-sm">Tanggal hitung<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block rounded-xl border border-surface-border px-4 py-2.5"/></label>
    <label className="block text-sm">Catatan (opsional)<input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5"/></label>
    {errs.counted_weight_kg && <p role="alert" className="text-sm text-danger">{errs.counted_weight_kg}</p>}{general && <p role="alert" className="text-sm text-danger">{general}</p>}</div>
  </Modal>
}

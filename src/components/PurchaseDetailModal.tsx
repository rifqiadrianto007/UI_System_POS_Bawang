import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Pencil, Trash2 } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { refreshStock, usePurchases, useProductsAdmin } from '../hooks/usePurchases'
import { api } from '../lib/api'
import { fmtLong, todayWib } from '../lib/dates'
import { formErrors } from '../lib/errors'
import { formatKgStr, rupiah } from '../lib/format'
import { gramsToKgString, kgStringToGrams, parseKg } from '../lib/util'
import type { Purchase } from '../lib/types'

const kg = (g: number) => `${formatKgStr(gramsToKgString(g))} kg`
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0)

export default function PurchaseDetailModal({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (p: Purchase) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const list = usePurchases()
  const products = useProductsAdmin()
  const p = list.data?.find((x) => x.id === id)

  const [lotId, setLotId] = useState<number | 'new'>('new')
  const [prod, setProd] = useState('')
  const [w, setW] = useState('')
  const [date, setDate] = useState(todayWib())
  const [notes, setNotes] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmFinal, setConfirmFinal] = useState(false)

  if (!p) return <Modal title="Kulak" onClose={onClose}>{list.isPending ? <Loader2 className="mx-auto animate-spin text-brand" /> : <p className="text-sm text-ink-muted">Kulak tidak ditemukan (mungkin sudah dihapus).</p>}</Modal>

  const gross = kgStringToGrams(p.gross_weight_kg)
  const lotsTotal = kgStringToGrams(p.lots_total_kg)
  const editingGrams = lotId === 'new' ? 0 : kgStringToGrams(p.lots.find((l) => l.id === lotId)?.clean_weight_kg ?? '0')
  const remaining = gross - (lotsTotal - editingGrams)   // sisa yang boleh disortir
  const shrink = gross - lotsTotal
  const estCost = lotsTotal > 0 ? Math.round(p.total_cost / (lotsTotal / 1000)) : null // perkiraan; nilai resmi dari backend saat finalisasi
  const activeProducts = (products.data ?? []).filter((x) => x.is_active)
  const usedIds = new Set(p.lots.filter((l) => l.id !== lotId).map((l) => l.product_id))

  const run = async (job: () => Promise<unknown>, ok: string) => {
    setBusy(true); setGeneral(''); setErrs({})
    try { await job(); await refreshStock(qc); toast.success(ok); return true }
    catch (e) { const r = formErrors(e); setErrs(r.fields); setGeneral(r.message || Object.values(r.fields)[0] || ''); return false }
    finally { setBusy(false) }
  }

  const resetLot = () => { setLotId('new'); setProd(''); setW(''); setNotes(''); setErrs({}) }
  const startEdit = (l: Purchase['lots'][number]) => { setLotId(l.id); setProd(String(l.product_id)); setW(formatKgStr(l.clean_weight_kg)); setDate(l.cleaned_at.slice(0, 10)); setNotes(l.notes ?? ''); setErrs({}) }

  async function saveLot() {
    const e: Record<string, string> = {}
    const g = parseKg(w)
    if (!prod) e.product_id = 'Pilih barang.'
    if (!g) e.clean_weight_kg = 'Berat bersih harus lebih dari 0.'
    else if (g > remaining) e.clean_weight_kg = `Melebihi sisa yang boleh disortir (${kg(Math.max(0, remaining))}).`
    if (!date) e.cleaned_at = 'Tanggal wajib diisi.'
    setErrs(e)
    if (Object.keys(e).length) return
    const ok = await run(() => api(lotId === 'new' ? `/purchases/${p!.id}/lots` : `/purchases/${p!.id}/lots/${lotId}`, {
      method: lotId === 'new' ? 'POST' : 'PUT',
      body: JSON.stringify({ product_id: Number(prod), clean_weight_kg: gramsToKgString(g!), cleaned_at: date, ...(notes.trim() ? { notes: notes.trim() } : lotId === 'new' ? {} : { notes: null }) }),
    }), lotId === 'new' ? 'Lot ditambahkan' : 'Lot diperbarui')
    if (ok) resetLot()
  }

  const delLot = async (l: Purchase['lots'][number]) => {
    if (!window.confirm(`Hapus lot ${l.product.name} (${formatKgStr(l.clean_weight_kg)} kg)?`)) return
    await run(() => api(`/purchases/${p.id}/lots/${l.id}`, { method: 'DELETE' }), 'Lot dihapus')
  }
  const delPurchase = async () => {
    if (!window.confirm('Hapus kulak ini? Semua lot di dalamnya ikut terhapus.')) return
    if (await run(() => api(`/purchases/${p.id}`, { method: 'DELETE' }), 'Kulak dihapus')) onClose()
  }
  const finalize = async () => { if (await run(() => api(`/purchases/${p.id}/finalize`, { method: 'POST' }), 'Kulak difinalisasi. Stok bertambah.')) setConfirmFinal(false) }

  const input = (bad?: string) => `mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/20 ${bad ? 'border-danger' : 'border-surface-border focus:border-brand'}`
  const btn = 'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-40'

  const footer = p.editable ? (
    confirmFinal ? (
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setConfirmFinal(false)} disabled={busy} className={`${btn} border border-brand text-brand`}>Periksa lagi</button>
        <button onClick={finalize} disabled={busy} className={`${btn} bg-brand text-white`}>{busy && <Loader2 size={16} className="animate-spin" />} Ya, finalisasi</button>
      </div>
    ) : (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onEdit(p)} className={`${btn} border border-brand text-brand`}><Pencil size={16} /> Ubah data</button>
          <button onClick={delPurchase} disabled={busy} className={`${btn} border border-danger text-danger`}><Trash2 size={16} /> Hapus kulak</button>
        </div>
        <button onClick={() => setConfirmFinal(true)} disabled={busy || p.lots.length === 0} className={`${btn} w-full bg-brand text-white hover:bg-brand-hover`}>Finalisasi kulak</button>
        {p.lots.length === 0 && <p className="text-center text-xs text-ink-muted">Tambahkan minimal satu lot sebelum finalisasi.</p>}
      </div>
    )
  ) : <button onClick={onClose} className={`${btn} w-full border border-brand text-brand`}>Tutup</button>

  return (
    <Modal wide title={`Kulak ${fmtLong(p.purchased_at)}`} onClose={() => !busy && onClose()} footer={footer}>
      {confirmFinal ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-surface p-4">
            <div className="flex justify-between"><span className="text-ink-muted">Berat kotor</span><span>{kg(gross)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Berat bersih (semua lot)</span><span>{kg(lotsTotal)}</span></div>
            <div className="flex justify-between font-bold"><span>Susut pembersihan</span><span>{kg(shrink)} ({pct(shrink, gross)}%)</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Total biaya kulak</span><span>{rupiah(p.total_cost)}</span></div>
            <div className="flex justify-between font-bold text-brand"><span>HPP per kg bersih (perkiraan)</span><span>{estCost ? rupiah(estCost) : '-'}</span></div>
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs text-danger"><AlertTriangle size={16} className="shrink-0" /> Setelah final, data kulak dan lot tidak bisa diubah atau dihapus, dan salah input harga belum bisa dikoreksi. Periksa berat dan harga sekali lagi.</p>
          {general && <p role="alert" className="text-danger">{general}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface p-4 sm:grid-cols-3">
            <Info label="Supplier">{p.supplier.name}</Info>
            <Info label="Berat kotor">{kg(gross)}</Info>
            <Info label="Harga per kg">{rupiah(p.price_per_kg)}</Info>
            <Info label="Total biaya">{rupiah(p.total_cost)}</Info>
            <Info label="Status"><span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${p.status === 'finalized' ? 'bg-brand text-white' : 'border border-brand text-brand'}`}>{p.status === 'finalized' ? 'Final' : 'Draft'}</span></Info>
            {p.notes && <Info label="Catatan">{p.notes}</Info>}
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs"><span>Tersortir {kg(lotsTotal)} dari {kg(gross)} ({pct(lotsTotal, gross)}%)</span><span className="text-ink-muted">{p.editable ? `Sisa ${kg(Math.max(0, gross - lotsTotal))}` : 'Final'}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-brand" style={{ width: `${Math.min(100, pct(lotsTotal, gross))}%` }} /></div>
            <p className="mt-2 text-xs text-ink-muted">
              {p.editable
                ? <>Susut pembersihan sementara <b>{kg(shrink)}</b> ({pct(shrink, gross)}%). Nilai pasti ditetapkan saat finalisasi.{estCost ? <> Perkiraan HPP per kg bersih <b>{rupiah(estCost)}</b>.</> : null}</>
                : <>Susut pembersihan <b>{kg(kgStringToGrams(p.cleaning_shrink_kg))}</b> ({pct(kgStringToGrams(p.cleaning_shrink_kg), gross)}%). HPP per kg bersih <b>{p.cost_per_clean_kg ? rupiah(p.cost_per_clean_kg) : '-'}</b> (sama untuk semua grade). Final {p.finalized_at ? fmtLong(p.finalized_at.slice(0, 10)) : ''}.</>}
            </p>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-bold">Lot hasil sortir</h3>
            {p.lots.length === 0 ? <p className="rounded-xl bg-surface py-5 text-center text-sm text-ink-muted">Belum ada lot. Sortir bawang bersih per grade, lalu catat di sini.</p> : (
              <ul className="space-y-2">
                {p.lots.map((l) => (
                  <li key={l.id} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${lotId === l.id ? 'border border-brand bg-white' : 'bg-surface'}`}>
                    <div className="min-w-0"><p className="text-sm font-bold">{l.product.name} <span className="font-normal">{kg(kgStringToGrams(l.clean_weight_kg))}</span></p>
                      <p className="text-xs text-ink-muted">{fmtLong(l.cleaned_at.slice(0, 10))}{l.unit_cost !== null ? ` · HPP ${rupiah(l.unit_cost)}/kg` : ''}{l.notes ? ` · ${l.notes}` : ''}</p></div>
                    {p.editable && <div className="flex shrink-0">
                      <button onClick={() => startEdit(l)} aria-label={`Ubah lot ${l.product.name}`} className="rounded-lg p-2 text-brand hover:bg-white"><Pencil size={16} /></button>
                      <button onClick={() => delLot(l)} disabled={busy} aria-label={`Hapus lot ${l.product.name}`} className="rounded-lg p-2 text-danger hover:bg-white"><Trash2 size={16} /></button>
                    </div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {p.editable && (
            <section className="rounded-xl border border-surface-border p-3">
              <h3 className="mb-2 text-sm font-bold">{lotId === 'new' ? 'Tambah lot' : 'Ubah lot'}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs">Barang
                  <select value={prod} onChange={(e) => setProd(e.target.value)} className={input(errs.product_id)}>
                    <option value="">Pilih barang</option>
                    {activeProducts.map((x) => <option key={x.id} value={x.id}>{x.name}{usedIds.has(x.id) ? ' (sudah ada lot)' : ''}</option>)}
                  </select>
                  {errs.product_id && <span role="alert" className="mt-1 block text-danger">{errs.product_id}</span>}
                </label>
                <label className="block text-xs">Berat bersih (kg)
                  <input value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" placeholder={`Maks ${formatKgStr(gramsToKgString(Math.max(0, remaining)))}`} className={input(errs.clean_weight_kg)} />
                  {errs.clean_weight_kg && <span role="alert" className="mt-1 block text-danger">{errs.clean_weight_kg}</span>}
                </label>
                <label className="block text-xs">Tanggal bersih
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input(errs.cleaned_at)} />
                  {errs.cleaned_at && <span role="alert" className="mt-1 block text-danger">{errs.cleaned_at}</span>}
                </label>
              </div>
              <label className="mt-3 block text-xs">Catatan (opsional)<input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className={input()} /></label>
              {general && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={saveLot} disabled={busy} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{lotId === 'new' ? 'Tambah lot' : 'Simpan lot'}</button>
                {lotId !== 'new' && <button onClick={resetLot} className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand">Batal</button>}
              </div>
            </section>
          )}
          {!p.editable && general && <p role="alert" className="text-sm text-danger">{general}</p>}
        </div>
      )}
    </Modal>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs text-ink-muted">{label}</p><div className="text-sm font-bold">{children}</div></div>
}

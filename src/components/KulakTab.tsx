import { useState } from 'react'
import { AlertTriangle, ChevronRight, Plus, Users } from 'lucide-react'
import PurchaseDetailModal from './PurchaseDetailModal'
import PurchaseFormModal from './PurchaseFormModal'
import SupplierModal from './SupplierModal'
import { usePurchases } from '../hooks/usePurchases'
import { fmtLong } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import { kgStringToGrams } from '../lib/util'
import type { Purchase } from '../lib/types'

export default function KulakTab() {
  const q = usePurchases()
  const [form, setForm] = useState<Purchase | 'new' | null>(null)
  const [detail, setDetail] = useState<number | null>(null)
  const [suppliers, setSuppliers] = useState(false)
  const rows = q.data ?? []
  const open = rows.filter((p) => p.status === 'open')
  const pendingKg = open.reduce((s, p) => s + kgStringToGrams(p.gross_weight_kg), 0) / 1000

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={() => setSuppliers(true)} className="flex items-center gap-2 rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-surface"><Users size={18} /> Supplier</button>
        <button onClick={() => setForm('new')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={18} /> Catat Kulak</button>
      </div>

      {open.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-surface-border bg-surface p-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand" />
          <p><b>{open.length} kulak belum difinalisasi</b> ({formatKgStr(String(pendingKg))} kg kotor). Bawang ini belum menjadi stok siap jual sampai disortir dan difinalisasi.</p>
        </div>
      )}

      {q.isPending && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {q.isError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {q.error instanceof Error ? q.error.message : 'Gagal memuat kulak.'}
          <button onClick={() => q.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}
      {q.isSuccess && rows.length === 0 && <p className="rounded-xl bg-surface py-10 text-center text-sm text-ink-muted">Belum ada kulak. Catat kulak pertama saat bawang baru datang.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-right">Berat kotor</th><th className="px-4 py-3 text-right">Harga/kg</th>
                <th className="px-4 py-3 text-right">Total biaya</th><th className="px-4 py-3 text-right">Tersortir</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setDetail(p.id)} className="cursor-pointer hover:bg-surface/40">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtLong(p.purchased_at)}</td>
                  <td className="px-4 py-3">{p.supplier.name}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatKgStr(p.gross_weight_kg)} kg</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{rupiah(p.price_per_kg)}</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{rupiah(p.total_cost)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatKgStr(p.lots_total_kg)} kg</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${p.status === 'finalized' ? 'bg-brand text-white' : 'border border-brand text-brand'}`}>{p.status === 'finalized' ? 'Final' : 'Draft'}</span></td>
                  <td className="px-4 py-3 text-brand"><ChevronRight size={18} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <PurchaseFormModal purchase={form === 'new' ? undefined : form} onClose={() => setForm(null)} onManageSuppliers={() => setSuppliers(true)} />}
      {detail !== null && !form && <PurchaseDetailModal id={detail} onClose={() => setDetail(null)} onEdit={(p) => setForm(p)} />}
      {suppliers && <SupplierModal onClose={() => setSuppliers(false)} />}
    </div>
  )
}

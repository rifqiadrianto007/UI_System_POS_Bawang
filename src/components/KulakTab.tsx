import { useState } from 'react'
import { ChevronRight, Plus, Users } from 'lucide-react'
import PurchaseDetailModal from './PurchaseDetailModal'
import PurchaseFormModal from './PurchaseFormModal'
import SupplierModal from './SupplierModal'
import { usePurchases } from '../hooks/usePurchases'
import { fmtLong } from '../lib/dates'
import { formatKgStr } from '../lib/format'
import type { Purchase } from '../lib/types'

export default function KulakTab() {
  const q = usePurchases()
  const [form, setForm] = useState<Purchase | 'new' | null>(null)
  const [detail, setDetail] = useState<number | null>(null)
  const [suppliers, setSuppliers] = useState(false)
  const rows = q.data ?? []
  const safeKg = (value: unknown) => formatKgStr(String(Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={() => setSuppliers(true)} className="flex items-center gap-2 rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-surface"><Users size={18} /> Supplier</button>
        <button onClick={() => setForm('new')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={18} /> Catat Kulak</button>
      </div>

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
            <table className="w-full min-w-245 text-sm">
            <thead className="bg-surface text-left text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Kode</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3 text-right">Berat kotor</th><th className="px-4 py-3 text-right">Tersortir</th><th className="px-4 py-3 text-right">Belum disortir</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setDetail(p.id)} className="cursor-pointer hover:bg-surface/40">
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">{p.code || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtLong(p.purchased_at)}</td>
                  <td className="px-4 py-3">{p.supplier?.name ?? '-'}</td>
                  <td className="px-4 py-3 capitalize">{p.jenis || '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{safeKg(p.gross_weight_kg)} kg</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{safeKg(p.sorted_weight_kg)} kg</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{safeKg(p.remaining_weight_kg)} kg</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="rounded-full border border-brand px-2 py-1 text-xs font-semibold text-brand">{p.status_sortir === 'tersortir' ? 'Tersortir' : 'Belum disortir'}</span></td>
                  <td className="px-4 py-3 text-brand"><ChevronRight size={18} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <PurchaseFormModal purchase={form === 'new' ? undefined : form} onClose={() => setForm(null)} onManageSuppliers={() => setSuppliers(true)} />}
      {detail !== null && !form && (() => {
        const purchase = rows.find((p) => p.id === detail)
        return purchase ? <PurchaseDetailModal purchase={purchase} onClose={() => setDetail(null)} onEdit={(p) => setForm(p)} /> : null
      })()}
      {suppliers && <SupplierModal onClose={() => setSuppliers(false)} />}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import { dateTime } from './TransactionDetailModal'
import { api } from '../lib/api'
import { rupiah } from '../lib/format'
import type { PriceHistoryRow } from '../lib/types'

const delta = (cur: number, prev?: number) => {
  if (prev === undefined || cur === prev) return null
  const d = cur - prev
  return <span className={`block text-[11px] ${d > 0 ? 'text-brand' : 'text-danger'}`}>{d > 0 ? '+' : '-'}{rupiah(Math.abs(d))}</span>
}

export default function PriceHistoryModal({ product, onClose }: { product: { id: number; name: string }; onClose: () => void }) {
  const q = useQuery({ queryKey: ['price-history', product.id], queryFn: () => api<{ data: PriceHistoryRow[] }>(`/products/${product.id}/price-history`).then((r) => r.data) })
  const rows = [...(q.data ?? [])].sort((a, b) => b.changed_at.localeCompare(a.changed_at) || b.id - a.id)
  return (
    <Modal wide title={`Riwayat harga ${product.name}`} onClose={onClose}>
      {q.isPending && <Loader2 className="mx-auto animate-spin text-brand" />}
      {q.isError && <p role="alert" className="text-sm text-danger">{q.error instanceof Error ? q.error.message : 'Gagal memuat riwayat.'}</p>}
      {q.isSuccess && rows.length === 0 && <p className="rounded-xl bg-surface py-8 text-center text-sm text-ink-muted">Belum ada perubahan harga yang tercatat.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-muted"><tr><th className="py-2">Waktu</th><th className="py-2 text-right">Ecer</th><th className="py-2 text-right">5 kg</th></tr></thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((r, i) => {
                const prev = rows[i + 1]
                return (
                  <tr key={r.id}>
                    <td className="py-2 whitespace-nowrap">{dateTime(r.changed_at)}</td>
                    <td className="py-2 text-right">{rupiah(r.price_retail)}{delta(r.price_retail, prev?.price_retail)}</td>
                    <td className="py-2 text-right">{rupiah(r.price_5kg)}{delta(r.price_5kg, prev?.price_5kg)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">Perubahan harga tidak mengubah transaksi yang sudah tercatat. Selisih dibandingkan perubahan sebelumnya.</p>
        </div>
      )}
    </Modal>
  )
}

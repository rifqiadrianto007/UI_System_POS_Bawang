import { useQueries, useQuery } from '@tanstack/react-query'
import Modal from './Modal'
import { api } from '../lib/api'
import { fmtLong } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import type { Purchase } from '../lib/types'
import { isPurchaseFinished, purchaseSortPercentage, remainingPurchaseKg, sortedPurchaseKg } from '../lib/purchaseProgress'
import { useProductsAdmin } from '../hooks/usePurchases'

const kg = (value: unknown) => {
  const n = Number.parseFloat(String(value ?? ''))
  return `${formatKgStr(Number.isFinite(n) ? String(Math.max(0, n)) : '0')} kg`
}

function rowsFrom(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[]
  if (root.data && typeof root.data === 'object') {
    const nested = root.data as { data?: unknown; items?: unknown }
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[]
    if (Array.isArray(nested.items)) return nested.items as Record<string, unknown>[]
  }
  return []
}

export default function PurchaseDetailModal({ purchase, onClose, onEdit }: { purchase: Purchase; onClose: () => void; onEdit: (p: Purchase) => void }) {
  const detailQuery = useQuery({
    queryKey: ['purchase', purchase.id],
    queryFn: async () => {
      const response = await api<Purchase | { data: Purchase }>(`/purchases/${purchase.id}`)
      return 'data' in response ? response.data : response
    },
  })
  const current = detailQuery.data ?? purchase
  const sorted = purchaseSortPercentage(current)
  const finished = isPurchaseFinished(current)
  const detailLots = Array.isArray(current.lots) ? current.lots : []
  const products = useProductsAdmin()
  const productBatchQueries = useQueries({
    queries: (products.data ?? []).filter((product) => product.jenis === current.jenis).map((product) => ({
      queryKey: ['product-batches', product.id],
      queryFn: () => api<unknown>(`/products/${product.id}/batches`),
      enabled: detailLots.length === 0,
    })),
  })
  const lots = detailLots.length > 0 ? detailLots : productBatchQueries.flatMap((query, productIndex) => rowsFrom(query.data)
    .filter((row) => Number(row.purchase_id ?? row.batch_id ?? (row.purchase as Record<string, unknown> | undefined)?.id) === current.id)
    .map((row, rowIndex) => ({
      id: Number(row.id ?? row.addition_id ?? (current.id * 100000 + productIndex * 1000 + rowIndex)),
      purchase_id: current.id,
      product_id: Number(row.product_id ?? 0),
      product_name: String(row.product_name ?? row.name ?? row.batch_name ?? '-'),
      clean_weight_kg: String(row.clean_weight_kg ?? row.sorted_weight_kg ?? row.added_weight_kg ?? row.weight_kg ?? '0'),
    })))
  const historyLoading = detailQuery.isPending || (detailLots.length === 0 && products.isPending) || productBatchQueries.some((query) => query.isPending)
  const historyError = detailQuery.isError || products.isError || productBatchQueries.some((query) => query.isError)
  const footer = current.can_edit
    ? <button onClick={() => onEdit(current)} className="w-full rounded-xl border border-brand py-3 font-semibold text-brand">Ubah supplier/catatan</button>
    : <button onClick={onClose} className="w-full rounded-xl border border-brand py-3 font-semibold text-brand">Tutup</button>

  return (
    <Modal wide title={`Kulak ${fmtLong(current.purchased_at)}`} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface p-4 sm:grid-cols-3">
          <Info label="Kode">{current.code || '-'}</Info>
          <Info label="Supplier">{current.supplier?.name ?? '-'}</Info>
          <Info label="Jenis">{current.jenis ?? '-'}</Info>
          <Info label="Berat kotor">{kg(current.gross_weight_kg)}</Info>
          <Info label="Harga per kg">{rupiah(current.price_per_kg || 0)}</Info>
          <Info label="Total biaya">{rupiah(current.total_cost || 0)}</Info>
          <Info label="Status sortir"><span className="inline-block rounded-full border border-brand px-3 py-0.5 text-xs font-semibold text-brand">{finished ? 'Selesai disortir' : 'Belum disortir'}</span></Info>
          {current.notes && <Info label="Catatan">{current.notes}</Info>}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs"><span>Tersortir/display {kg(sortedPurchaseKg(current))} dari {kg(current.gross_weight_kg)} ({sorted.toFixed(0)}%)</span><span className="text-ink-muted">Sisa {kg(remainingPurchaseKg(current))}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, sorted))}%` }} /></div>
        </div>
        <section>
          <h3 className="mb-2 text-sm font-bold">Riwayat stok display</h3>
          {historyLoading ? <p className="rounded-xl bg-surface py-5 text-center text-sm text-ink-muted">Memuat riwayat stok display...</p> : historyError ? <p role="alert" className="rounded-xl bg-surface py-5 text-center text-sm text-danger">Gagal memuat riwayat stok display.</p> : lots.length === 0 ? <p className="rounded-xl bg-surface py-5 text-center text-sm text-ink-muted">Belum ada stok display dari batch ini.</p> : (
            <ul className="space-y-2">
              {lots.map((lot) => <li key={lot.id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm"><span className="font-semibold">{lot.product_name || '-'}</span><span>{kg(lot.clean_weight_kg)}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs text-ink-muted">{label}</p><div className="text-sm font-bold">{children}</div></div>
}

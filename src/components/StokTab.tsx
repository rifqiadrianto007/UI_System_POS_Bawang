import { Fragment, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ClipboardCheck, Package, ShoppingCart, Truck } from 'lucide-react'
import ReasonModal from './ReasonModal'
import StatCard from './StatCard'
import StockCountModal from './StockCountModal'
import { useToast } from './Toast'
import { dateTime } from './TransactionDetailModal'
import { refreshStock, usePurchases } from '../hooks/usePurchases'
import { api } from '../lib/api'
import { addDays, fmtLong, monthEnd, monthStart, todayWib } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import type { StockCount, StockReport, StockResponse } from '../lib/types'

const gramsOrZero = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 1000)) : 0
}
const kg = (s: unknown) => `${formatKgStr(String(gramsOrZero(s) / 1000))} kg`
const numericKg = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
    return Number.isFinite(n) ? n : 0
}
const normalizeJenis = (value: unknown): 'merah' | 'putih' | null => {
    const jenis = String(value ?? '').trim().toLowerCase()
    return jenis === 'merah' || jenis === 'putih' ? jenis : null
}

export default function StokTab() {
    const qc = useQueryClient()
    const toast = useToast()
    const [cancelling, setCancelling] = useState<StockCount | null>(null)
    const today = useMemo(todayWib, [])
    const [period, setPeriod] = useState<'month' | 'lastmonth'>('month')
    const [open, setOpen] = useState<number | null>(null)
    const [counting, setCounting] = useState<{ id: number; name: string; jenis: 'merah' | 'putih'; stockKg: string } | null>(null)

    const last = addDays(monthStart(today), -1)
    const { from, to } = period === 'month' ? { from: monthStart(today), to: today } : { from: monthStart(last), to: monthEnd(last) }

    const report = useQuery({ queryKey: ['stock-report', from, to], queryFn: () => api<{ data: StockReport }>(`/reports/stock?from=${from}&to=${to}`).then((r) => r.data) })
    const stock = useQuery({ queryKey: ['stock'], queryFn: () => api<StockResponse>('/stock') })
    const counts = useQuery({ queryKey: ['stock-counts'], queryFn: () => api<{ data: StockCount[] }>('/stock-counts').then((r) => r.data) })
  const redPurchases = usePurchases('merah')
  const whitePurchases = usePurchases('putih')
  const purchases = [...(redPurchases.data ?? []), ...(whitePurchases.data ?? [])]
    const r = report.data
    const stockRows = Array.isArray(stock.data?.data) ? stock.data.data : []
    const stockTotals = stock.data?.totals
  const pendingGrams = purchases.reduce((sum, purchase) => sum + gramsOrZero(purchase.remaining_weight_kg), 0)
    // Hanya hitung ulang aktif TERBARU per barang yang bisa dibatalkan (aturan backend; yang lain ditolak 409).
    const latestActive = new Set<number>()
    const seen = new Set<string>()
        ;[...(counts.data ?? [])].sort((a, b) => b.counted_at.localeCompare(a.counted_at) || b.id - a.id).forEach((c) => {
            const key = `${c.purchase_id}:${c.product_id}`
            if (c.status === 'cancelled' || seen.has(key)) return
            seen.add(key); latestActive.add(c.id)
        })
    async function cancel(reason: string) {
        await api(`/stock-counts/${cancelling!.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) })
        await Promise.all([refreshStock(qc), qc.invalidateQueries({ queryKey: ['stock-counts'] })])
        toast.success('Hitung ulang dibatalkan. Susut dikembalikan.')
        setCancelling(null)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1 rounded-xl border border-surface-border p-1">
                    {([['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu']] as const).map(([id, label]) => (
                        <button key={id} onClick={() => setPeriod(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${period === id ? 'bg-brand text-white' : 'text-ink'}`}>{label}</button>
                    ))}
                </div>
                <p className="text-xs text-ink-muted">Terjual dan susut: {fmtLong(from)} - {fmtLong(to)}. Stok: kondisi sekarang.</p>
            </div>

            {report.isError && (
                <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                    {report.error instanceof Error ? report.error.message : 'Gagal memuat laporan stok.'}
                    <button onClick={() => report.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <StatCard icon={Package} label="Stok display" value={kg(stockTotals?.display_kg)} />
                <StatCard icon={Truck} label="Stok gudang" value={kg(stockTotals?.warehouse_kg)} />
                <StatCard icon={Truck} label="Belum disortir" value={kg(pendingGrams / 1000)} note="Total sisa batch kulak" />
                <StatCard icon={Package} label="Nilai persediaan" value={rupiah(stockTotals?.inventory_value ?? 0)} />
                <StatCard icon={ShoppingCart} label="Terjual" value={kg(r?.sold_kg)} />
            </div>

            {report.isPending && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
            {r && (
                <div className="overflow-x-auto rounded-xl border border-surface-border">
                    <table className="w-full min-w-180 text-sm">
                        <thead className="bg-surface text-left text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3">Barang</th><th className="px-4 py-3 text-right">Stok</th><th className="px-4 py-3 text-right">Nilai stok</th>
                                <th className="px-4 py-3 text-right">Terjual</th><th className="px-4 py-3 text-right">Susut display</th><th className="px-4 py-3">Terakhir dihitung</th><th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {(Array.isArray(r.products) ? r.products : []).map((p) => {
                                const stockRow = stockRows.find((s) => s.product_id === p.product_id)
                                const stockValue = stockRow?.stock_kg ?? p.stock_kg
                                const neg = numericKg(stockValue) < 0
                                const isOpen = open === p.product_id
                                return (
                                    <Fragment key={p.product_id}>
                                        <tr className={`hover:bg-surface/40 ${p.is_active ? '' : 'text-ink-muted'}`}>
                                            <td className="px-4 py-3">
                                                <button onClick={() => setOpen(isOpen ? null : p.product_id)} className="flex items-center gap-1 font-medium" aria-expanded={isOpen}>
                                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{p.name}{!p.is_active && <span className="text-xs font-normal"> (nonaktif)</span>}
                                                </button>
                                                {neg && <p className="ml-5 text-[11px] font-semibold text-danger">Peringatan: stok sistem kurang</p>}
                                            </td>
                                            <td className={`px-4 py-3 text-right whitespace-nowrap ${neg ? 'font-bold text-danger' : ''}`}>{neg ? `${formatKgStr(String(numericKg(stockValue)))} kg` : kg(stockValue)}</td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">{rupiah(p.stock_value)}</td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">{kg(p.sold_kg)}</td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">{kg(p.display_shrink_kg)}{p.display_shrink_value ? <span className="block text-[11px] text-ink-muted">{rupiah(p.display_shrink_value)}</span> : null}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs">{p.last_count_date ? fmtLong(p.last_count_date.slice(0, 10)) : 'Belum pernah'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => {
                                                    const jenis = normalizeJenis(stockRow?.jenis)
                                                    if (jenis) setCounting({ id: p.product_id, name: p.name, jenis, stockKg: String(stockValue ?? '0') })
                                                    else toast.error('Jenis barang tidak tersedia dari response stok. Periksa kontrak GET /stock.')
                                                }} className="inline-flex items-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-surface"><ClipboardCheck size={14} /> Hitung ulang</button>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-surface/40"><td colSpan={7} className="px-4 py-3">
                                                <p className="text-xs text-ink-muted">Stok display berasal dari hitung ulang per batch kulak. Pilih tombol “Hitung ulang” untuk memilih batch secara eksplisit.</p>
                                            </td></tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <section>
                <h3 className="mb-2 text-sm font-bold">Riwayat hitung ulang</h3>
                {counts.isPending ? <div className="h-16 animate-pulse rounded-xl bg-surface" /> : (counts.data ?? []).length === 0 ? (
                    <p className="rounded-xl bg-surface py-6 text-center text-sm text-ink-muted">Belum ada hitung ulang.</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-surface-border">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-surface text-left text-xs font-semibold"><tr><th className="px-4 py-2">Waktu</th><th className="px-4 py-2">Barang</th><th className="px-4 py-2 text-right">Sistem</th><th className="px-4 py-2 text-right">Hasil hitung</th><th className="px-4 py-2 text-right">Selisih</th><th className="px-4 py-2 text-right">Nilai susut</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" /></tr></thead>
                            <tbody className="divide-y divide-surface-border">{counts.data!.map((c) => {
                                const off = c.status === 'cancelled'
                                return (
                                    <tr key={c.id} className={off ? 'text-ink-muted' : ''}>
                                        <td className="px-4 py-2 whitespace-nowrap">{dateTime(c.counted_at)}</td><td className="px-4 py-2">{c.product_name}</td>
                                        <td className="px-4 py-2 text-right">{kg(c.system_weight_kg)}</td><td className="px-4 py-2 text-right">{kg(c.counted_weight_kg)}</td>
                                        <td className={`px-4 py-2 text-right ${off ? 'line-through' : parseFloat(c.diff_kg) < 0 ? 'font-semibold text-danger' : ''}`}>{kg(c.diff_kg)}</td>
                                        <td className={`px-4 py-2 text-right ${off ? 'line-through' : ''}`}>{rupiah(c.loss_value)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs">{off ? <span title={c.cancel_reason ?? ''}>Dibatalkan{c.cancel_reason ? ` (${c.cancel_reason})` : ''}</span> : 'Aktif'}</td>
                                        <td className="px-4 py-2 text-right">{latestActive.has(c.id) && <button onClick={() => setCancelling(c)} className="rounded-lg border border-danger px-3 py-1 text-xs font-semibold text-danger hover:bg-surface">Batalkan</button>}</td>
                                    </tr>
                                )
                            })}</tbody>
                        </table>
                    </div>
                )}
            </section>

            {cancelling && <ReasonModal title="Batalkan hitung ulang" confirmLabel="Batalkan" onConfirm={cancel} onClose={() => setCancelling(null)}
                description={`Hitung ulang ${cancelling.product_name} (selisih ${kg(cancelling.diff_kg)}, ${rupiah(cancelling.loss_value)}) dibatalkan dan susutnya dikembalikan. Hanya hitung ulang terakhir untuk barang ini yang bisa dibatalkan.`} />}
      {counting && <StockCountModal product={counting} onClose={() => setCounting(null)} />}
        </div>
    )
}

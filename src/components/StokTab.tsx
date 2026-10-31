import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ClipboardCheck, Package, ShoppingCart, TrendingDown, Truck } from 'lucide-react'
import StatCard from './StatCard'
import StockCountModal from './StockCountModal'
import { dateTime } from './TransactionDetailModal'
import { api } from '../lib/api'
import { addDays, fmtLong, monthEnd, monthStart, todayWib } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import type { StockCount, StockReport, StockRow } from '../lib/types'

const kg = (s: string) => `${formatKgStr(s)} kg`

export default function StokTab() {
  const today = useMemo(todayWib, [])
  const [period, setPeriod] = useState<'month' | 'lastmonth'>('month')
  const [open, setOpen] = useState<number | null>(null)
  const [counting, setCounting] = useState<{ id: number; name: string; stockKg: string } | null>(null)

  const last = addDays(monthStart(today), -1)
  const { from, to } = period === 'month' ? { from: monthStart(today), to: today } : { from: monthStart(last), to: monthEnd(last) }

  const report = useQuery({ queryKey: ['stock-report', from, to], queryFn: () => api<{ data: StockReport }>(`/reports/stock?from=${from}&to=${to}`).then((r) => r.data) })
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => api<{ data: StockRow[] }>('/stock').then((r) => r.data) })
  const counts = useQuery({ queryKey: ['stock-counts'], queryFn: () => api<{ data: StockCount[] }>('/stock-counts').then((r) => r.data) })
  const r = report.data
  const lotsOf = (id: number) => stock.data?.find((s) => s.product_id === id)?.lots ?? []

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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Package} label="Stok siap jual" value={r ? kg(r.stock_ready_kg) : '...'} note={r ? `Nilai ${rupiah(r.stock_value)}` : undefined} />
        <StatCard icon={Truck} label="Belum disortir" value={r ? kg(r.pending_gross_kg) : '...'} note="Kulak belum difinalisasi (berat kotor)" />
        <StatCard icon={ShoppingCart} label="Terjual" value={r ? kg(r.sold_kg) : '...'} />
        <StatCard icon={TrendingDown} label="Susut pembersihan" value={r ? kg(r.cleaning_shrink_kg) : '...'}
          note={r ? `Susut display ${kg(r.display_shrink_kg)}${r.display_shrink_value ? ` (${rupiah(r.display_shrink_value)})` : ''}` : undefined} />
      </div>
      <p className="text-xs text-ink-muted">Susut display baru tercatat setelah hitung ulang. Nol belum tentu berarti tidak ada susut. Stok sistem sama dengan stok yang tampil di display (display dan gudang tidak dipisah).</p>

      {report.isPending && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {r && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Barang</th><th className="px-4 py-3 text-right">Stok</th><th className="px-4 py-3 text-right">Nilai stok</th>
                <th className="px-4 py-3 text-right">Terjual</th><th className="px-4 py-3 text-right">Susut display</th><th className="px-4 py-3">Terakhir dihitung</th><th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {r.products.map((p) => {
                const neg = parseFloat(p.stock_kg) < 0
                const isOpen = open === p.product_id
                return (
                  <Fragment key={p.product_id}>
                    <tr className={`hover:bg-surface/40 ${p.is_active ? '' : 'text-ink-muted'}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => setOpen(isOpen ? null : p.product_id)} className="flex items-center gap-1 font-medium" aria-expanded={isOpen}>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}{p.name}{!p.is_active && <span className="text-xs font-normal"> (nonaktif)</span>}
                        </button>
                        {neg && <p className="ml-5 text-[11px] font-semibold text-danger">Stok minus: penjualan melebihi stok sistem</p>}
                      </td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${neg ? 'font-bold text-danger' : ''}`}>{kg(p.stock_kg)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{rupiah(p.stock_value)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{kg(p.sold_kg)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{kg(p.display_shrink_kg)}{p.display_shrink_value ? <span className="block text-[11px] text-ink-muted">{rupiah(p.display_shrink_value)}</span> : null}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{p.last_count_date ? fmtLong(p.last_count_date.slice(0, 10)) : 'Belum pernah'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setCounting({ id: p.product_id, name: p.name, stockKg: p.stock_kg })} className="inline-flex items-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-surface"><ClipboardCheck size={14} /> Hitung ulang</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface/40"><td colSpan={7} className="px-4 py-3">
                        {stock.isPending ? <p className="text-xs text-ink-muted">Memuat lot...</p> : lotsOf(p.product_id).length === 0 ? <p className="text-xs text-ink-muted">Belum ada lot. Stok masuk lewat kulak yang sudah disortir dan difinalisasi.</p> : (
                          <table className="w-full max-w-xl text-xs">
                            <thead className="text-left text-ink-muted"><tr><th className="py-1">Tanggal bersih</th><th className="py-1 text-right">Stok lot</th><th className="py-1 text-right">HPP per kg</th><th className="py-1 text-right">Nilai</th></tr></thead>
                            <tbody>{lotsOf(p.product_id).map((l) => (
                              <tr key={l.lot_id}><td className="py-1">{fmtLong(l.cleaned_at.slice(0, 10))}</td><td className="py-1 text-right">{kg(l.stock_weight_kg)}</td>
                                <td className="py-1 text-right">{l.unit_cost === null ? 'belum ada' : rupiah(l.unit_cost)}</td><td className="py-1 text-right">{rupiah(l.inventory_value)}</td></tr>
                            ))}</tbody>
                          </table>
                        )}
                        <p className="mt-2 text-[11px] text-ink-muted">Penjualan mengambil lot tertua lebih dulu (FIFO).</p>
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
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold"><tr><th className="px-4 py-2">Waktu</th><th className="px-4 py-2">Barang</th><th className="px-4 py-2 text-right">Sistem</th><th className="px-4 py-2 text-right">Hasil hitung</th><th className="px-4 py-2 text-right">Selisih</th><th className="px-4 py-2 text-right">Nilai susut</th></tr></thead>
              <tbody className="divide-y divide-surface-border">{counts.data!.map((c) => (
                <tr key={c.id}><td className="px-4 py-2 whitespace-nowrap">{dateTime(c.counted_at)}</td><td className="px-4 py-2">{c.product_name}</td>
                  <td className="px-4 py-2 text-right">{kg(c.system_weight_kg)}</td><td className="px-4 py-2 text-right">{kg(c.counted_weight_kg)}</td>
                  <td className={`px-4 py-2 text-right ${parseFloat(c.diff_kg) < 0 ? 'font-semibold text-danger' : ''}`}>{kg(c.diff_kg)}</td><td className="px-4 py-2 text-right">{rupiah(c.loss_value)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {counting && <StockCountModal product={counting} onClose={() => setCounting(null)} />}
    </div>
  )
}

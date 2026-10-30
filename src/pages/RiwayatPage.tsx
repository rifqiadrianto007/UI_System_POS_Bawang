import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, Eye, Loader2, Printer, ReceiptText, Search, ShoppingCart, Tag, Wallet, X } from 'lucide-react'
import { api } from '../lib/api'
import { rupiah } from '../lib/format'
import { useDebounced } from '../lib/util'
import { useReceiptPrint } from '../hooks/useReceiptPrint'
import StatCard from '../components/StatCard'
import TransactionDetailModal, { METHOD, StatusBadge, dateTime } from '../components/TransactionDetailModal'
import type { TxList, TxRow } from '../lib/types'

type Period = 'today' | 'yesterday'
const PERIODS: { id: Period; label: string }[] = [{ id: 'today', label: 'Hari ini' }, { id: 'yesterday', label: 'Kemarin' }]
const PER_PAGE = 20

export default function RiwayatPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const q = useDebounced(search.trim(), 400)
  const rp = useReceiptPrint()

  const list = useQuery({
    queryKey: ['transactions', period, q, page],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ period, page: String(page), per_page: String(PER_PAGE) })
      if (q) p.set('q', q)
      return api<TxList>(`/transactions?${p}`)
    },
  })
  const d = list.data
  const s = d?.summary
  const dim = list.isPlaceholderData
  const rows = d?.data ?? []
  const from = rows.length ? (d!.meta.current_page - 1) * d!.meta.per_page + 1 : 0

  const printBtn = (r: TxRow) => (
    <button onClick={() => rp.print(r.id)} disabled={r.status !== 'completed' || rp.busyId === r.id} aria-label="Cetak ulang"
      title={r.status !== 'completed' ? 'Transaksi dibatalkan' : 'Cetak ulang'} className="rounded-lg p-2 text-brand hover:bg-surface disabled:opacity-30">
      {rp.busyId === r.id ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
    </button>
  )
  const viewBtn = (r: TxRow) => <button onClick={() => setSelected(r.id)} aria-label="Lihat detail" className="rounded-lg p-2 text-brand hover:bg-surface"><Eye size={18} /></button>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total transaksi" value={s ? String(s.transactions_count) : '...'} dim={dim}
          note={s && s.voided_count > 0 ? `${s.voided_count} dibatalkan` : undefined} />
        <StatCard icon={Banknote} label="Total penjualan" value={s ? rupiah(s.subtotal_sum) : '...'} dim={dim} />
        <StatCard icon={Tag} label="Total diskon" value={s ? rupiah(s.discount_sum) : '...'} dim={dim} />
        <StatCard icon={Wallet} label="Total pembayaran" value={s ? rupiah(s.total_sum) : '...'} dim={dim} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-surface-border p-1">
          <CalendarDays size={16} className="mx-2 text-brand" />
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { setPeriod(p.id); setPage(1) }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${period === p.id ? 'bg-brand text-white' : 'text-ink'}`}>{p.label}</button>
          ))}
        </div>
        <div className="relative sm:w-80">
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Cari nomor transaksi..."
            className="w-full rounded-xl border border-surface-border py-2.5 pr-4 pl-11 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </div>

      {rp.error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <span>{rp.error}</span><button onClick={rp.clearError} aria-label="Tutup"><X size={16} /></button>
        </div>
      )}

      {list.isPending && <div className="h-48 animate-pulse rounded-xl bg-surface" />}
      {list.isError && !d && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {list.error instanceof Error ? list.error.message : 'Gagal memuat riwayat.'}
          <button onClick={() => list.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}
      {d && rows.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-xl bg-surface py-14 text-ink-muted">
          <ReceiptText size={28} />
          <p className="text-sm font-semibold">{q ? 'Transaksi tidak ditemukan.' : `Belum ada transaksi ${period === 'today' ? 'hari ini' : 'kemarin'}.`}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className={dim ? 'opacity-60 transition-opacity' : ''}>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th><th className="px-4 py-3">Tanggal/Jam</th><th className="px-4 py-3">Kasir</th>
                  <th className="px-4 py-3 text-right">Total item</th><th className="px-4 py-3 text-right">Total pembayaran</th>
                  <th className="px-4 py-3">Metode bayar</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/40">
                    <td className="px-4 py-3 font-medium">{r.invoice_no}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(r.occurred_at)}</td>
                    <td className="px-4 py-3">{r.cashier_name}</td>
                    <td className="px-4 py-3 text-right">{r.items_count}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={r.status !== 'completed' ? 'text-ink-muted line-through' : 'font-semibold'}>{rupiah(r.total)}</span>
                      {r.discount > 0 && <span className="block text-[11px] text-ink-muted">diskon {rupiah(r.discount)}</span>}
                    </td>
                    <td className="px-4 py-3">{METHOD[r.payment_method]}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-center">{viewBtn(r)}{printBtn(r)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-sm font-bold">{r.invoice_no}</p><p className="text-xs text-ink-muted">{dateTime(r.occurred_at)} &middot; {r.cashier_name}</p></div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="text-xs text-ink-muted">
                    <p>{r.customer_name || 'Tanpa nama'}</p>
                    <p>{r.items_count} item &middot; {METHOD[r.payment_method]}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-extrabold ${r.status !== 'completed' ? 'text-ink-muted line-through' : 'text-brand'}`}>{rupiah(r.total)}</p>
                    {r.discount > 0 && <p className="text-[11px] text-ink-muted">diskon {rupiah(r.discount)}</p>}
                  </div>
                </div>
                <div className="mt-2 flex justify-end border-t border-surface-border pt-2">{viewBtn(r)}{printBtn(r)}</div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
            <p>Menampilkan {from} - {from + rows.length - 1} dari {d!.meta.total} data</p>
            {d!.meta.last_page > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya" className="rounded-lg border border-surface-border p-1.5 text-brand disabled:opacity-30"><ChevronLeft size={18} /></button>
                <span className="px-2">Halaman {d!.meta.current_page} dari {d!.meta.last_page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= d!.meta.last_page} aria-label="Halaman berikutnya" className="rounded-lg border border-surface-border p-1.5 text-brand disabled:opacity-30"><ChevronRight size={18} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {selected !== null && <TransactionDetailModal id={selected} onClose={() => setSelected(null)} rp={rp} />}
      {rp.node}
    </div>
  )
}

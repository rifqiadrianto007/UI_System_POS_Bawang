import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Ban, Banknote, CalendarDays, ChevronLeft, ChevronRight, Eye, Loader2, Printer, ReceiptText, Search, ShoppingCart, Tag, Wallet, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, diffDays, fmtLong, monthEnd, monthStart, todayWib } from '../lib/dates'
import { rupiah } from '../lib/format'
import { useDebounced } from '../lib/util'
import { useReceiptPrint } from '../hooks/useReceiptPrint'
import { useVoidTx } from '../hooks/useVoidTx'
import ReasonModal from '../components/ReasonModal'
import StatCard from '../components/StatCard'
import TransactionDetailModal, { METHOD, StatusBadge, dateTime } from '../components/TransactionDetailModal'
import type { TxList, TxRow } from '../lib/types'

type Period = 'today' | 'yesterday' | '7d' | 'month' | 'lastmonth' | 'custom'
const ALL: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' }, { id: 'yesterday', label: 'Kemarin' }, { id: '7d', label: '7 hari' },
  { id: 'month', label: 'Bulan ini' }, { id: 'lastmonth', label: 'Bulan lalu' }, { id: 'custom', label: 'Kustom' },
]
const KASIR_PERIODS = ALL.slice(0, 2) // kasir hanya hari ini dan kemarin (ditegakkan juga oleh server)
const PER_PAGE = 20
const MAX_DAYS = 366

export default function RiwayatPage() {
  const { user } = useAuth()
  const owner = user?.role === 'owner'
  const today = useMemo(todayWib, [])
  const [period, setPeriod] = useState<Period>('today')
  const [cf, setCf] = useState(addDays(today, -6))
  const [ct, setCt] = useState(today)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [voiding, setVoiding] = useState<TxRow | null>(null)
  const q = useDebounced(search.trim(), 400)
  const rp = useReceiptPrint()
  const voidTx = useVoidTx()

  const last = addDays(monthStart(today), -1)
  const range =
    period === 'today' ? { from: today, to: today } :
    period === 'yesterday' ? { from: addDays(today, -1), to: addDays(today, -1) } :
    period === '7d' ? { from: addDays(today, -6), to: today } :
    period === 'month' ? { from: monthStart(today), to: today } :
    period === 'lastmonth' ? { from: monthStart(last), to: monthEnd(last) } : { from: cf, to: ct }
  const rangeError = period !== 'custom' ? null
    : !cf || !ct ? 'Isi kedua tanggal.' : cf > ct ? 'Tanggal awal tidak boleh setelah tanggal akhir.' : diffDays(cf, ct) + 1 > MAX_DAYS ? `Rentang maksimal ${MAX_DAYS} hari.` : null

  const list = useQuery({
    queryKey: ['transactions', owner ? range.from : period, owner ? range.to : '', q, page],
    enabled: !rangeError && !!user, // tunggu role diketahui agar parameter (period atau from/to) tidak salah
    placeholderData: keepPreviousData,
    queryFn: () => {
      // Kasir memakai period (batas hari dihitung server). Owner memakai rentang tanggal WIB bebas.
      const p = new URLSearchParams(owner ? { from: range.from, to: range.to } : { period })
      p.set('page', String(page)); p.set('per_page', String(PER_PAGE))
      if (q) p.set('q', q)
      return api<TxList>(`/transactions?${p}`)
    },
  })
  const d = list.data
  const s = d?.summary
  const dim = list.isPlaceholderData
  const rows = d?.data ?? []
  const from = rows.length ? (d!.meta.current_page - 1) * d!.meta.per_page + 1 : 0
  const periods = owner ? ALL : KASIR_PERIODS
  const periodLabel = ALL.find((p) => p.id === period)?.label.toLowerCase()

  const printBtn = (r: TxRow) => (
    <button onClick={() => rp.print(r.id)} disabled={r.status !== 'completed' || rp.busyId === r.id} aria-label="Cetak ulang"
      title={r.status !== 'completed' ? 'Transaksi dibatalkan' : 'Cetak ulang'} className="rounded-lg p-2 text-brand hover:bg-surface disabled:opacity-30">
      {rp.busyId === r.id ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
    </button>
  )
  const viewBtn = (r: TxRow) => <button onClick={() => setSelected(r.id)} aria-label="Lihat detail" className="rounded-lg p-2 text-brand hover:bg-surface"><Eye size={18} /></button>
  const voidBtn = (r: TxRow) => owner && r.status === 'completed' ? (
    <button onClick={() => setVoiding(r)} aria-label={`Batalkan ${r.invoice_no}`} title="Batalkan transaksi" className="rounded-lg p-2 text-danger hover:bg-surface"><Ban size={18} /></button>
  ) : null
  const shortfall = (r: TxRow) => owner && r.has_shortfall ? (
    <span title="HPP belum lengkap: dijual saat stok sistem kurang" className="ml-1 inline-flex align-middle text-danger"><AlertTriangle size={14} aria-label="HPP belum lengkap" /></span>
  ) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total transaksi" value={s ? String(s.transactions_count) : '...'} dim={dim}
          note={s && s.voided_count > 0 ? `${s.voided_count} dibatalkan` : undefined} />
        <StatCard icon={Banknote} label="Total penjualan" value={s ? rupiah(s.subtotal_sum) : '...'} dim={dim} />
        <StatCard icon={Tag} label="Total diskon" value={s ? rupiah(s.discount_sum) : '...'} dim={dim} />
        <StatCard icon={Wallet} label="Total pembayaran" value={s ? rupiah(s.total_sum) : '...'} dim={dim} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-surface-border p-1">
          <CalendarDays size={16} className="mx-2 shrink-0 text-brand" />
          {periods.map((p) => (
            <button key={p.id} onClick={() => { setPeriod(p.id); setPage(1) }}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold ${period === p.id ? 'bg-brand text-white' : 'text-ink'}`}>{p.label}</button>
          ))}
        </div>
        <div className="relative lg:w-80">
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Cari nomor transaksi..."
            className="w-full rounded-xl border border-surface-border py-2.5 pr-4 pl-11 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </div>
      {owner && !rangeError && <p className="-mt-2 text-xs text-ink-muted">{range.from === range.to ? fmtLong(range.from) : `${fmtLong(range.from)} - ${fmtLong(range.to)}`}</p>}

      {owner && period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-muted">Dari<input type="date" value={cf} onChange={(e) => { setCf(e.target.value); setPage(1) }} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" /></label>
          <label className="text-xs text-ink-muted">Sampai<input type="date" value={ct} onChange={(e) => { setCt(e.target.value); setPage(1) }} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" /></label>
        </div>
      )}
      {rangeError && <p role="alert" className="text-sm text-danger">{rangeError}</p>}

      {rp.error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <span>{rp.error}</span><button onClick={rp.clearError} aria-label="Tutup"><X size={16} /></button>
        </div>
      )}

      {list.isPending && !rangeError && <div className="h-48 animate-pulse rounded-xl bg-surface" />}
      {list.isError && !d && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {list.error instanceof Error ? list.error.message : 'Gagal memuat riwayat.'}
          <button onClick={() => list.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}
      {d && rows.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-xl bg-surface py-14 text-ink-muted">
          <ReceiptText size={28} />
          <p className="text-sm font-semibold">{q ? 'Transaksi tidak ditemukan.' : `Belum ada transaksi ${period === 'today' ? 'hari ini' : period === 'yesterday' ? 'kemarin' : `pada periode ${periodLabel}`}.`}</p>
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
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.invoice_no}{shortfall(r)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(r.occurred_at)}</td>
                    <td className="px-4 py-3">{r.cashier_name}</td>
                    <td className="px-4 py-3 text-right">{r.items_count}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={r.status !== 'completed' ? 'text-ink-muted line-through' : 'font-semibold'}>{rupiah(r.total)}</span>
                      {r.discount > 0 && <span className="block text-[11px] text-ink-muted">diskon {rupiah(r.discount)}</span>}
                    </td>
                    <td className="px-4 py-3">{METHOD[r.payment_method]}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-center">{viewBtn(r)}{printBtn(r)}{voidBtn(r)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-sm font-bold">{r.invoice_no}{shortfall(r)}</p><p className="text-xs text-ink-muted">{dateTime(r.occurred_at)} &middot; {r.cashier_name}</p></div>
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
                <div className="mt-2 flex justify-end border-t border-surface-border pt-2">{viewBtn(r)}{printBtn(r)}{voidBtn(r)}</div>
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
          {owner && <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-muted"><AlertTriangle size={12} className="text-danger" /> Tanda ini berarti HPP transaksi belum lengkap karena barang terjual saat stok sistem kurang.</p>}
        </div>
      )}

      {selected !== null && <TransactionDetailModal id={selected} onClose={() => setSelected(null)} rp={rp} />}
      {voiding && <ReasonModal title="Batalkan transaksi" confirmLabel="Batalkan transaksi" onClose={() => setVoiding(null)}
        onConfirm={async (reason) => { await voidTx(voiding.id, reason); setVoiding(null) }}
        description={`Transaksi ${voiding.invoice_no} (${rupiah(voiding.total)}) dibatalkan dan tidak dihitung lagi di laporan. Tidak ada fitur untuk mengurungkan pembatalan.`} />}
      {rp.node}
    </div>
  )
}

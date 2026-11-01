import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react'
import ExpenseFormModal from '../components/ExpenseFormModal'
import ReasonModal from '../components/ReasonModal'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { addDays, diffDays, fmtLong, monthEnd, monthStart, todayWib } from '../lib/dates'
import { rupiah } from '../lib/format'
import { useDebounced } from '../lib/util'
import type { Expense, ExpenseList } from '../lib/types'

type Preset = 'month' | 'lastmonth' | '7d' | 'all' | 'custom'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'month', label: 'Bulan ini' }, { id: 'lastmonth', label: 'Bulan lalu' }, { id: '7d', label: '7 hari' }, { id: 'all', label: 'Semua' }, { id: 'custom', label: 'Kustom' },
]
const PER_PAGE = 20
const MAX_DAYS = 366
const dmy = (s: string) => s.split('-').reverse().join('/')

export default function PengeluaranPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const today = useMemo(todayWib, [])
  const [preset, setPreset] = useState<Preset>('month')
  const [cf, setCf] = useState(addDays(today, -6))
  const [ct, setCt] = useState(today)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<Expense | 'new' | null>(null)
  const [del, setDel] = useState<Expense | null>(null)
  const q = useDebounced(search.trim(), 400)

  const last = addDays(monthStart(today), -1)
  const range =
    preset === 'month' ? { from: monthStart(today), to: today } :
    preset === 'lastmonth' ? { from: monthStart(last), to: monthEnd(last) } :
    preset === '7d' ? { from: addDays(today, -6), to: today } :
    preset === 'custom' ? { from: cf, to: ct } : { from: '', to: '' }
  const rangeError = preset !== 'custom' ? null
    : !cf || !ct ? 'Isi kedua tanggal.' : cf > ct ? 'Tanggal awal tidak boleh setelah tanggal akhir.' : diffDays(cf, ct) + 1 > MAX_DAYS ? `Rentang maksimal ${MAX_DAYS} hari.` : null

  const list = useQuery({
    queryKey: ['expenses', range.from, range.to, q, page],
    enabled: !rangeError,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
      if (range.from) { p.set('from', range.from); p.set('to', range.to) }
      if (q) p.set('q', q)
      return api<ExpenseList>(`/expenses?${p}`)
    },
  })
  const d = list.data
  const rows = d?.data ?? []
  const dim = list.isPlaceholderData
  const setP = (p: Preset) => { setPreset(p); setPage(1) }

  async function remove(reason: string) {
    await api(`/expenses/${del!.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) })
    await Promise.all(['expenses', 'expense-suggestions', 'finance'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    toast.success('Pengeluaran dihapus')
    setDel(null)
  }

  const actions = (e: Expense) => (
    <div className="flex justify-center">
      <button onClick={() => setForm(e)} aria-label={`Ubah ${e.name}`} className="rounded-lg p-2 text-brand hover:bg-surface"><Pencil size={18} /></button>
      <button onClick={() => setDel(e)} aria-label={`Hapus ${e.name}`} className="rounded-lg p-2 text-danger hover:bg-surface"><Trash2 size={18} /></button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setForm('new')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={18} /> Tambah Pengeluaran</button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Total pengeluaran operasional</p>
          <p className={`text-2xl font-extrabold text-brand ${dim ? 'opacity-40' : ''}`}>{d ? rupiah(d.summary.total_amount) : '...'}</p>
          <p className="text-[11px] text-ink-muted">Belum termasuk uang kulak (lihat Barang &amp; Stok, tab Kulak).</p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold text-brand">{d ? `${d.summary.count} pengeluaran tercatat` : ''}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-surface-border p-1">
          <CalendarDays size={16} className="mx-2 shrink-0 text-brand" />
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setP(p.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${preset === p.id ? 'bg-brand text-white' : 'text-ink'}`}>{p.label}</button>
          ))}
        </div>
        <div className="relative lg:w-80">
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Cari jenis atau deskripsi..."
            className="w-full rounded-xl border border-surface-border py-2.5 pr-4 pl-11 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </div>
      {preset !== 'all' && !rangeError && <p className="-mt-2 text-xs text-ink-muted">{range.from === range.to ? fmtLong(range.from) : `${fmtLong(range.from)} - ${fmtLong(range.to)}`}</p>}

      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-muted">Dari<input type="date" value={cf} onChange={(e) => { setCf(e.target.value); setPage(1) }} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" /></label>
          <label className="text-xs text-ink-muted">Sampai<input type="date" value={ct} onChange={(e) => { setCt(e.target.value); setPage(1) }} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" /></label>
        </div>
      )}
      {rangeError && <p role="alert" className="text-sm text-danger">{rangeError}</p>}

      {list.isPending && !rangeError && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {list.isError && !d && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {list.error instanceof Error ? list.error.message : 'Gagal memuat pengeluaran.'}
          <button onClick={() => list.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}
      {d && rows.length === 0 && (
        <div className="grid place-items-center gap-2 rounded-xl bg-surface py-12 text-ink-muted">
          <Receipt size={28} /><p className="text-sm font-semibold">{q ? 'Pengeluaran tidak ditemukan.' : 'Belum ada pengeluaran pada periode ini.'}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className={dim ? 'opacity-60 transition-opacity' : ''}>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs font-semibold">
                <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Jenis pengeluaran</th><th className="px-4 py-3">Deskripsi</th><th className="px-4 py-3 text-right">Nominal</th><th className="px-4 py-3">Pengguna</th><th className="px-4 py-3 text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-surface/40">
                    <td className="px-4 py-3 whitespace-nowrap">{dmy(e.spent_at)}</td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{e.notes || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-brand">{rupiah(e.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.created_by_name}</td>
                    <td className="px-4 py-3">{actions(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-start justify-between gap-2"><p className="font-bold">{e.name}</p><p className="shrink-0 font-extrabold text-brand">{rupiah(e.amount)}</p></div>
                <p className="text-xs text-ink-muted">{dmy(e.spent_at)} &middot; {e.created_by_name}</p>
                {e.notes && <p className="mt-1 text-sm">{e.notes}</p>}
                <div className="mt-2 flex justify-end border-t border-surface-border pt-2">{actions(e)}</div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
            <p>Menampilkan {d!.meta.from ?? 0} - {d!.meta.to ?? 0} dari {d!.meta.total} data</p>
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

      {form && <ExpenseFormModal expense={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {del && <ReasonModal title="Hapus pengeluaran" confirmLabel="Hapus" onConfirm={remove} onClose={() => setDel(null)}
        description={`${del.name} (${rupiah(del.amount)}, ${dmy(del.spent_at)}) tidak akan dihitung lagi di laporan. Penghapusan tercatat di audit log.`} />}
    </div>
  )
}

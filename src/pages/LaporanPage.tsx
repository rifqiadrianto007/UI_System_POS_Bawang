import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, CalendarDays, Scale, ShoppingCart, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { addDays, diffDays, eachDay, fmtLong, fmtShort, monthEnd, monthStart, todayWib } from '../lib/dates'
import { compactRp, rupiah, rupiahSigned } from '../lib/format'
import StatCard from '../components/StatCard'
import type { Finance, FinanceDaily } from '../lib/types'

type Preset = 'today' | '7d' | 'month' | 'lastmonth' | 'custom'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hari ini' }, { id: '7d', label: '7 hari' }, { id: 'month', label: 'Bulan ini' },
  { id: 'lastmonth', label: 'Bulan lalu' }, { id: 'custom', label: 'Kustom' },
]
const TABS = [{ id: 'income', label: 'Pendapatan' }, { id: 'spending', label: 'Pengeluaran' }, { id: 'compare', label: 'Perbandingan' }] as const
type Tab = (typeof TABS)[number]['id']
// Warna grafik: maroon + turunan dari beige/hitam (di luar 4 warna client, disetujui).
const C = { income: '#5C0707', ops: '#C69C6D', kulak: '#8C5A3C', profit: '#000000', grid: '#E6D6C2' }
const MAX_DAYS = 366

const ZERO: Omit<FinanceDaily, 'date'> = { net_sales: 0, operating_expenses: 0, purchases_total: 0, cogs: 0, display_shrink_value: 0, net_profit: 0 }
const NUM = ['net_sales', 'operating_expenses', 'purchases_total', 'cogs', 'display_shrink_value', 'net_profit'] as const

function rangeFor(p: Preset, today: string, cf: string, ct: string) {
  if (p === 'today') return { from: today, to: today }
  if (p === '7d') return { from: addDays(today, -6), to: today }
  if (p === 'month') return { from: monthStart(today), to: today }
  if (p === 'lastmonth') { const last = addDays(monthStart(today), -1); return { from: monthStart(last), to: monthEnd(last) } }
  return { from: cf, to: ct }
}

function Row({ label, value, bold, note, danger }: { label: string; value: string; bold?: boolean; note?: string; danger?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2 ${bold ? 'font-bold' : ''}`}>
      <div><p className="text-sm">{label}</p>{note && <p className="text-[11px] font-normal text-ink-muted">{note}</p>}</div>
      <p className={`shrink-0 text-sm ${danger ? 'text-danger' : bold ? 'text-brand' : ''}`}>{value}</p>
    </div>
  )
}

const tip = { contentStyle: { borderRadius: 12, borderColor: C.grid, fontSize: 12 } }
const axis = { tick: { fontSize: 11, fill: '#6B6B6B' }, stroke: C.grid }

export default function LaporanPage() {
  const today = useMemo(todayWib, [])
  const [preset, setPreset] = useState<Preset>('month')
  const [cf, setCf] = useState(addDays(today, -6))
  const [ct, setCt] = useState(today)
  const [tab, setTab] = useState<Tab>('income')

  const { from, to } = rangeFor(preset, today, cf, ct)
  const rangeError = !from || !to ? 'Isi kedua tanggal.' : from > to ? 'Tanggal awal tidak boleh setelah tanggal akhir.' : diffDays(from, to) + 1 > MAX_DAYS ? `Rentang maksimal ${MAX_DAYS} hari.` : null

  const q = useQuery({
    queryKey: ['finance', from, to],
    enabled: !rangeError,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const b = await api<{ data: Finance } | Finance>(`/reports/finance?from=${from}&to=${to}`)
      return 'data' in b ? b.data : b
    },
  })
  const f = q.data
  const dim = q.isPlaceholderData

  // Isi hari tanpa transaksi dengan nol agar grafik tidak melompat.
  const series = useMemo(() => {
    if (!f || rangeError) return []
    const byDate = new Map((f.daily ?? []).map((d) => [d.date, d]))
    return eachDay(from, to).map((date) => {
      const d = { ...ZERO, ...(byDate.get(date) ?? {}) }
      return { ...d, date, label: fmtShort(date), spending: d.operating_expenses + d.purchases_total }
    })
  }, [f, from, to, rangeError])

  // Batang per hari tidak terbaca untuk rentang panjang: gabungkan per 7 hari.
  const bars = useMemo(() => {
    if (series.length <= 31) return series.map((d) => ({ label: d.label, net_sales: d.net_sales, spending: d.spending }))
    const out: { label: string; net_sales: number; spending: number }[] = []
    for (let i = 0; i < series.length; i += 7) {
      const chunk = series.slice(i, i + 7)
      out.push({ label: chunk[0].label, net_sales: chunk.reduce((s, d) => s + d.net_sales, 0), spending: chunk.reduce((s, d) => s + d.spending, 0) })
    }
    return out
  }, [series])

  const cash = f?.by_payment_method?.cash ?? { count: 0, total: 0 }
  const qris = f?.by_payment_method?.qris ?? { count: 0, total: 0 }
  const payCount = cash.count + qris.count
  const pct = (n: number) => (payCount ? ((n / payCount) * 100).toFixed(2).replace('.', ',') : '0')
  const pay = [
    { name: 'Tunai', count: cash.count, total: cash.total, color: C.income },
    { name: 'QRIS', count: qris.count, total: qris.total, color: C.ops },
  ]
  const hasSeries = series.some((d) => NUM.some((k) => d[k] !== 0))
  const chartBox = 'h-64 sm:h-72'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-surface-border p-1">
          <CalendarDays size={16} className="mx-2 shrink-0 text-brand" />
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${preset === p.id ? 'bg-brand text-white' : 'text-ink'}`}>{p.label}</button>
          ))}
        </div>
        {!rangeError && <p className="text-xs text-ink-muted">{from === to ? fmtLong(from) : `${fmtLong(from)} - ${fmtLong(to)}`}</p>}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-muted">Dari
            <input type="date" value={cf} onChange={(e) => setCf(e.target.value)} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </label>
          <label className="text-xs text-ink-muted">Sampai
            <input type="date" value={ct} onChange={(e) => setCt(e.target.value)} className="mt-1 block rounded-xl border border-surface-border px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </label>
        </div>
      )}
      {rangeError && <p role="alert" className="text-sm text-danger">{rangeError}</p>}
      {q.isError && !f && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {q.error instanceof Error ? q.error.message : 'Gagal memuat laporan.'}
          <button onClick={() => q.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total transaksi" value={f ? String(f.transactions_count) : '...'} dim={dim}
          note={f && f.void_count > 0 ? `${f.void_count} dibatalkan` : undefined} />
        <StatCard icon={Banknote} label="Total pendapatan" value={f ? rupiah(f.net_sales) : '...'} dim={dim} note="Setelah diskon" />
        <StatCard icon={Wallet} label="Total pengeluaran" value={f ? rupiah(f.total_spending) : '...'} dim={dim}
          note={f ? `Operasional ${rupiah(f.operating_expenses)} + kulak ${rupiah(f.purchases_total)}` : undefined} />
        <StatCard icon={Scale} label="Laba" value={f ? rupiahSigned(f.cash_flow) : '...'} dim={dim} danger={!!f && f.cash_flow < 0} note="Selisih kas (pendapatan - pengeluaran)" />
      </div>

      <section className="rounded-2xl border border-surface-border p-4 sm:p-5">
        <h2 className="text-base font-bold">Ringkasan laba usaha</h2>
        <p className="mb-2 text-xs text-ink-muted">Dihitung dari HPP barang yang terjual, bukan dari uang kulak.</p>
        {f ? (
          <div className={`divide-y divide-dashed divide-surface-border ${dim ? 'opacity-50' : ''}`}>
            <Row label="Pendapatan bersih" value={rupiah(f.net_sales)} note="Setelah diskon" />
            <Row label="HPP barang terjual" value={`-${rupiah(f.cogs)}`} />
            <Row label="Laba kotor" value={rupiahSigned(f.gross_profit)} bold danger={f.gross_profit < 0} />
            <Row label="Susut display" value={`-${rupiah(f.display_shrink_value)}`} note="Baru tercatat setelah owner menjalankan hitung ulang stok. Nol belum tentu berarti tidak ada susut." />
            <Row label="Biaya operasional" value={`-${rupiah(f.operating_expenses)}`} />
            <Row label="Laba bersih" value={rupiahSigned(f.net_profit)} bold danger={f.net_profit < 0} />
          </div>
        ) : <div className="h-40 animate-pulse rounded-xl bg-surface" />}
        {f && <p className="mt-3 rounded-xl bg-surface p-3 text-xs text-ink-muted">Kulak periode ini {rupiah(f.purchases_total)}. Uang kulak yang barangnya belum terjual masih berupa stok, jadi tidak mengurangi laba usaha di atas. Karena itu angka ini bisa berbeda dari kartu Laba (selisih kas).</p>}
      </section>

      <section className="rounded-2xl border border-surface-border p-4 sm:p-5">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-brand text-white' : 'border border-surface-border text-ink-muted'}`}>{t.label}</button>
          ))}
        </div>
        <h3 className="mb-2 text-sm font-bold">{tab === 'income' ? 'Pendapatan Harian' : tab === 'spending' ? 'Pengeluaran Harian' : 'Pendapatan, Pengeluaran, dan Laba Bersih'}</h3>
        {!f ? <div className={`${chartBox} animate-pulse rounded-xl bg-surface`} /> : !hasSeries ? (
          <p className={`${chartBox} grid place-items-center text-sm text-ink-muted`}>Belum ada data pada periode ini.</p>
        ) : (
          <div className={`${chartBox} ${dim ? 'opacity-50' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              {tab === 'spending' ? (
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={compactRp} width={52} />
                  <Tooltip {...tip} formatter={(v) => rupiah(Number(v))} />
                  <Legend />
                  <Bar dataKey="operating_expenses" name="Operasional" stackId="s" fill={C.ops} />
                  <Bar dataKey="purchases_total" name="Kulak" stackId="s" fill={C.kulak} />
                </BarChart>
              ) : (
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={compactRp} width={52} />
                  <Tooltip {...tip} formatter={(v) => rupiah(Number(v))} />
                  <Line type="monotone" dataKey="net_sales" name="Pendapatan" stroke={C.income} strokeWidth={2} dot={series.length <= 31} />
                  {tab === 'compare' && <Line type="monotone" dataKey="spending" name="Pengeluaran" stroke={C.ops} strokeWidth={2} dot={series.length <= 31} />}
                  {tab === 'compare' && <Line type="monotone" dataKey="net_profit" name="Laba bersih" stroke={C.profit} strokeWidth={2} strokeDasharray="5 3" dot={false} />}
                  {tab === 'compare' && <Legend />}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-surface-border p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold">Metode Pembayaran</h3>
          {!f || payCount === 0 ? <p className="grid h-48 place-items-center text-sm text-ink-muted">{f ? 'Belum ada transaksi pada periode ini.' : '...'}</p> : (
            <div className={`flex flex-col items-center gap-4 sm:flex-row ${dim ? 'opacity-50' : ''}`}>
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pay} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="100%" stroke="#fff" startAngle={90} endAngle={-270}>
                      {pay.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip {...tip} formatter={(v) => `${v} transaksi`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-3 text-sm">
                {pay.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: p.color }} />{p.name}</span>
                    <span className="text-right"><span className="font-bold">{p.count} ({pct(p.count)}%)</span><span className="block text-[11px] text-ink-muted">{rupiah(p.total)}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-surface-border p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold">Pendapatan vs Pengeluaran{series.length > 31 ? ' (per 7 hari)' : ''}</h3>
          {!f || !hasSeries ? <p className="grid h-48 place-items-center text-sm text-ink-muted">{f ? 'Belum ada data pada periode ini.' : '...'}</p> : (
            <div className={`h-56 ${dim ? 'opacity-50' : ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="label" {...axis} minTickGap={16} />
                  <YAxis {...axis} tickFormatter={compactRp} width={52} />
                  <Tooltip {...tip} formatter={(v) => rupiah(Number(v))} />
                  <Legend />
                  <Bar dataKey="net_sales" name="Pendapatan" fill={C.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spending" name="Pengeluaran" fill={C.ops} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

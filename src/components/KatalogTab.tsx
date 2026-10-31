import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Pencil, Plus, Power, Search } from 'lucide-react'
import ProductFormModal from './ProductFormModal'
import { useToast } from './Toast'
import { api } from '../lib/api'
import { formatKgStr, rupiah } from '../lib/format'
import type { ProductAdmin } from '../lib/types'

type Filter = 'all' | 'active' | 'inactive'
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'Semua' }, { id: 'active', label: 'Aktif' }, { id: 'inactive', label: 'Nonaktif' }]

export default function KatalogTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<ProductAdmin | 'new' | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const q = useQuery({ queryKey: ['products-admin'], queryFn: () => api<{ data: ProductAdmin[] }>('/products').then((r) => r.data) })
  const all = q.data ?? []
  const rows = all.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || (filter === 'active') === p.is_active))
  const minus = all.filter((p) => parseFloat(p.stock_kg) < 0)

  async function toggle(p: ProductAdmin) {
    const next = !p.is_active
    if (!next && !window.confirm(`Nonaktifkan ${p.name}? Barang tidak akan muncul di kasir. Stok dan riwayatnya tetap tercatat.`)) return
    setBusyId(p.id)
    try {
      await api(`/products/${p.id}/active`, { method: 'PATCH', body: JSON.stringify({ is_active: next }) })
      await Promise.all([qc.invalidateQueries({ queryKey: ['products-admin'] }), qc.invalidateQueries({ queryKey: ['products'] })])
      toast.success(next ? `${p.name} diaktifkan` : `${p.name} dinonaktifkan`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal mengubah status') } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={18} /> Tambah Barang</button>
      </div>

      {minus.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p><b>{minus.length} barang stoknya minus</b> ({minus.map((p) => p.name).join(', ')}). Ada penjualan melebihi stok sistem. Catat kulak dan sortir barang itu agar stok dan HPP benar.</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-surface-border p-1">
          {FILTERS.map((f) => <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${filter === f.id ? 'bg-brand text-white' : 'text-ink'}`}>{f.label}</button>)}
        </div>
        <div className="relative sm:w-80">
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama barang..."
            className="w-full rounded-xl border border-surface-border py-2.5 pr-4 pl-11 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
      </div>

      {q.isPending && <div className="h-48 animate-pulse rounded-xl bg-surface" />}
      {q.isError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {q.error instanceof Error ? q.error.message : 'Gagal memuat barang.'}
          <button onClick={() => q.refetch()} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}
      {q.isSuccess && rows.length === 0 && <p className="rounded-xl bg-surface py-10 text-center text-sm text-ink-muted">{all.length === 0 ? 'Belum ada barang. Tambahkan barang pertama.' : 'Barang tidak ditemukan.'}</p>}

      {rows.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-surface-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">Nama barang</th><th className="px-4 py-3 text-right">Harga ecer</th><th className="px-4 py-3 text-right">Harga 3 kg</th>
                  <th className="px-4 py-3 text-right">Harga 5 kg</th><th className="px-4 py-3 text-right">Stok</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((p) => {
                  const neg = parseFloat(p.stock_kg) < 0
                  return (
                    <tr key={p.id} className={`hover:bg-surface/40 ${p.is_active ? '' : 'text-ink-muted'}`}>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-right">{rupiah(p.price_retail)}</td><td className="px-4 py-3 text-right">{rupiah(p.price_3kg)}</td><td className="px-4 py-3 text-right">{rupiah(p.price_5kg)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${neg ? 'font-bold text-danger' : ''}`}>{formatKgStr(p.stock_kg)} kg</td>
                      <td className="px-4 py-3 text-center"><StatusPill active={p.is_active} /></td>
                      <td className="px-4 py-3"><Actions p={p} busy={busyId === p.id} onEdit={() => setEditing(p)} onToggle={() => toggle(p)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className={`rounded-xl border border-surface-border p-3 ${p.is_active ? '' : 'bg-surface/40'}`}>
                <div className="flex items-start justify-between gap-2"><p className="font-bold">{p.name}</p><StatusPill active={p.is_active} /></div>
                <p className="mt-1 text-xs text-ink-muted">Ecer {rupiah(p.price_retail)} &middot; 3 kg {rupiah(p.price_3kg)} &middot; 5 kg {rupiah(p.price_5kg)}</p>
                <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-2">
                  <p className={`text-sm ${parseFloat(p.stock_kg) < 0 ? 'font-bold text-danger' : ''}`}>Stok {formatKgStr(p.stock_kg)} kg</p>
                  <Actions p={p} busy={busyId === p.id} onEdit={() => setEditing(p)} onToggle={() => toggle(p)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <ProductFormModal product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${active ? 'bg-brand text-white' : 'border border-surface-border bg-surface text-ink-muted'}`}>{active ? 'Aktif' : 'Nonaktif'}</span>
}

function Actions({ p, busy, onEdit, onToggle }: { p: ProductAdmin; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  return (
    <div className="flex justify-center">
      <button onClick={onEdit} aria-label={`Ubah ${p.name}`} className="rounded-lg p-2 text-brand hover:bg-surface"><Pencil size={18} /></button>
      <button onClick={onToggle} disabled={busy} aria-label={p.is_active ? `Nonaktifkan ${p.name}` : `Aktifkan ${p.name}`} title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        className="rounded-lg p-2 text-danger hover:bg-surface disabled:opacity-40"><Power size={18} /></button>
    </div>
  )
}

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'
import { api, ApiError } from '../lib/api'
import { useToast } from './Toast'
import { usePurchases, useProductsAdmin, refreshStock } from '../hooks/usePurchases'
import { gramsToKgString, parseKg } from '../lib/util'
import { formatKgStr } from '../lib/format'
import type { ProductKind } from '../lib/types'

export default function StockAdditionModal({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient(), toast = useToast(); const [kind, setKind] = useState<ProductKind>('merah'), [batch, setBatch] = useState(''), [product, setProduct] = useState(''), [weight, setWeight] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
    const purchases = usePurchases(kind), products = useProductsAdmin()
    const batches = (purchases.data ?? []).filter(p => p.jenis === kind && !p.is_locked && p.status_batch !== 'selesai_disortir' && p.status_sortir !== 'tersortir' && Number(p.remaining_weight_kg) > 0)
    const goods = (products.data ?? []).filter(p => p.jenis === kind)
    const selected = batches.find(p => String(p.id) === batch), grams = parseKg(weight)
    async function save() { if (!selected || !product || !grams) return; setBusy(true); setError(''); try { await api('/stock-additions', { method: 'POST', body: JSON.stringify({ batch_id: selected.id, product_id: Number(product), weight_kg: gramsToKgString(grams) }) }); await refreshStock(qc); toast.success('Stok berhasil ditambahkan.'); onClose() } catch (e) { if (e instanceof ApiError) setError([e.message, ...Object.values(e.errors ?? {}).flat()].join(' ')); else setError('Terjadi kesalahan.') } finally { setBusy(false) } }
    return <Modal title="Tambah stok" onClose={() => !busy && onClose()} footer={<div className="flex gap-2"><button onClick={onClose} className="flex-1 rounded-xl border border-brand py-3 font-semibold text-brand">Batal</button><button disabled={busy || !selected || !product || !grams || grams / 1000 > Number(selected.remaining_weight_kg)} onClick={() => void save()} className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-40">Tambah</button></div>}>
        <div className="space-y-4">
            <label className="block text-sm">Jenis bawang<select value={kind} onChange={e => { setKind(e.target.value as ProductKind); setBatch(''); setProduct('') }} className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5"><option value="merah">Merah</option><option value="putih">Putih</option></select></label>
            <label className="block text-sm">Batch kulak<select value={batch} onChange={e => setBatch(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5"><option value="">Pilih batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.code || `Kulak #${b.id}`} · sisa {formatKgStr(b.remaining_weight_kg)} kg</option>)}</select></label>
            <label className="block text-sm">Barang / grade<select value={product} onChange={e => setProduct(e.target.value)} className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5"><option value="">Pilih barang</option>{goods.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label className="block text-sm">Berat (kg)<input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5" /></label>
            {selected && grams && grams / 1000 > Number(selected.remaining_weight_kg) && <p className="text-sm text-danger">Berat melebihi sisa batch {formatKgStr(selected.remaining_weight_kg)} kg.</p>}{error && <p role="alert" className="rounded-lg bg-danger/5 p-3 text-sm text-danger">{error}</p>}
        </div></Modal>
}

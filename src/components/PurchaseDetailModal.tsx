import Modal from './Modal'
import { fmtLong } from '../lib/dates'
import { formatKgStr, rupiah } from '../lib/format'
import type { Purchase } from '../lib/types'

const kg = (value: unknown) => {
  const n = Number.parseFloat(String(value ?? ''))
  return `${formatKgStr(Number.isFinite(n) ? String(Math.max(0, n)) : '0')} kg`
}

export default function PurchaseDetailModal({ purchase, onClose, onEdit }: { purchase: Purchase; onClose: () => void; onEdit: (p: Purchase) => void }) {
  const sorted = Number.isFinite(Number(purchase.sort_percentage)) ? purchase.sort_percentage : 0
  const lots = Array.isArray(purchase.lots) ? purchase.lots : []
  const footer = purchase.can_edit
    ? <button onClick={() => onEdit(purchase)} className="w-full rounded-xl border border-brand py-3 font-semibold text-brand">Ubah supplier/catatan</button>
    : <button onClick={onClose} className="w-full rounded-xl border border-brand py-3 font-semibold text-brand">Tutup</button>

  return (
    <Modal wide title={`Kulak ${fmtLong(purchase.purchased_at)}`} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface p-4 sm:grid-cols-3">
          <Info label="Kode">{purchase.code || '-'}</Info>
          <Info label="Supplier">{purchase.supplier?.name ?? '-'}</Info>
          <Info label="Jenis">{purchase.jenis ?? '-'}</Info>
          <Info label="Berat kotor">{kg(purchase.gross_weight_kg)}</Info>
          <Info label="Harga per kg">{rupiah(purchase.price_per_kg || 0)}</Info>
          <Info label="Total biaya">{rupiah(purchase.total_cost || 0)}</Info>
          <Info label="Status sortir"><span className="inline-block rounded-full border border-brand px-3 py-0.5 text-xs font-semibold text-brand">{purchase.status_sortir === 'tersortir' ? 'Tersortir' : 'Belum disortir'}</span></Info>
          {purchase.notes && <Info label="Catatan">{purchase.notes}</Info>}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs"><span>Tersortir/display {kg(purchase.sorted_weight_kg)} dari {kg(purchase.gross_weight_kg)} ({sorted}%)</span><span className="text-ink-muted">Sisa {kg(purchase.remaining_weight_kg)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, sorted))}%` }} /></div>
        </div>
        <section>
          <h3 className="mb-2 text-sm font-bold">Riwayat stok display</h3>
          {lots.length === 0 ? <p className="rounded-xl bg-surface py-5 text-center text-sm text-ink-muted">Belum ada stok display dari batch ini.</p> : (
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

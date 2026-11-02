import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertTriangle, Ban, Download, Loader2, Printer } from 'lucide-react'
import Modal from './Modal'
import ReasonModal from './ReasonModal'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useVoidTx } from '../hooks/useVoidTx'
import { formatKgStr, formatReceiptDate, rupiah } from '../lib/format'
import type { useReceiptPrint } from '../hooks/useReceiptPrint'
import type { TxDetail, TxStatus } from '../lib/types'

export const dateTime = (iso: string) => { const { date, time } = formatReceiptDate(iso); return `${date} ${time.replace('.', ':')}` }
export const METHOD = { cash: 'Tunai', qris: 'QRIS' } as const

export function StatusBadge({ status }: { status: TxStatus }) {
  const ok = status === 'completed'
  return <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${ok ? 'bg-brand text-white' : 'border border-danger bg-danger/10 text-danger'}`}>{ok ? 'Lunas' : 'Dibatalkan'}</span>
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs text-ink-muted">{label}</p><div className="text-sm font-bold">{children}</div></div>
}

export default function TransactionDetailModal({ id, onClose, rp }: { id: number; onClose: () => void; rp: ReturnType<typeof useReceiptPrint> }) {
  const q = useQuery({ queryKey: ['transaction', id], queryFn: () => api<{ data: TxDetail }>(`/transactions/${id}`).then((r) => r.data) })
  const t = q.data
  const { user } = useAuth()
  const owner = user?.role === 'owner'
  const voidTx = useVoidTx()
  const [voiding, setVoiding] = useState(false)
  const isVoid = !!t && t.status !== 'completed'
  const busy = rp.busyId === id
  const btn = 'flex items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-40'

  return (
    <Modal title="Detail Transaksi" onClose={onClose}
      footer={
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className={`${btn} border border-brand text-brand`}>Tutup</button>
            <button onClick={() => t && rp.print(id, t.amount_paid)} disabled={!t || isVoid || busy} className={`${btn} bg-brand text-white hover:bg-brand-hover`}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Cetak ulang
            </button>
          </div>
          <button onClick={() => t && rp.pdf(id, t.amount_paid)} disabled={!t || isVoid || busy} className={`${btn} w-full border border-brand text-brand`}><Download size={16} /> Unduh PDF 58 mm</button>
          {owner && t && !isVoid && <button onClick={() => setVoiding(true)} className={`${btn} w-full border border-danger text-danger`}><Ban size={16} /> Batalkan transaksi</button>}
          {rp.error && <p role="alert" className="text-center text-xs text-danger">{rp.error}</p>}
        </div>
      }>
      {q.isPending && <div className="grid place-items-center py-10 text-brand"><Loader2 className="animate-spin" /></div>}
      {q.isError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {q.error instanceof Error ? q.error.message : 'Gagal memuat detail.'}
        </p>
      )}
      {t && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-surface p-4">
            <Info label="No. Transaksi">{t.invoice_no}</Info>
            <Info label="Tanggal/Jam">{dateTime(t.occurred_at)}</Info>
            <Info label="Kasir">{t.cashier_name}</Info>
            <Info label="Status"><StatusBadge status={t.status} /></Info>
            <Info label="Pelanggan">{t.customer_name || '-'}</Info>
            <Info label="Jenis pembeli">{t.customer_category === 'grosir' ? 'Grosir' : 'Ecer'}</Info>
          </div>

          {isVoid && (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
              <p className="font-bold">Transaksi dibatalkan{t.voided_at ? ` (${dateTime(t.voided_at)})` : ''}</p>
              {t.void_reason && <p className="mt-0.5">Alasan: {t.void_reason}</p>}
            </div>
          )}

          <p className="mt-4 mb-2 text-sm font-bold">Item Transaksi</p>
          <ul className="space-y-2">
            {t.items.map((i, k) => (
              <li key={k} className="flex items-start justify-between gap-3 rounded-xl bg-surface p-3">
                <div className="min-w-0"><p className="text-sm font-bold">{i.product_name}</p><p className="text-xs text-ink-muted">{rupiah(i.price_per_kg)} x {formatKgStr(i.weight_kg)}kg{owner && i.cogs !== undefined ? ` · HPP ${rupiah(i.cogs)}` : ''}</p></div>
                <p className="shrink-0 text-sm font-bold text-brand">{rupiah(i.line_total)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1 border-t border-dashed border-surface-border pt-3 text-sm">
            <div className="flex justify-between text-ink-muted"><span>Sub total</span><span>{rupiah(t.subtotal)}</span></div>
            {t.discount > 0 && <div className="flex justify-between font-semibold"><span>Diskon</span><span>-{rupiah(t.discount)}</span></div>}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-surface-border pt-3">
            <span className="text-sm text-ink-muted">Total pembayaran</span>
            <span className="text-2xl font-extrabold text-brand">{rupiah(t.total)}</span>
          </div>

          <p className="mt-4 text-sm font-bold">Pembayaran</p>
          <div className="mt-1 space-y-1 text-sm">
            <div className="flex justify-between text-ink-muted"><span>{METHOD[t.payment_method]}</span><span className="text-ink">{rupiah(t.amount_paid ?? t.total)}</span></div>
            {!!t.change && t.change > 0 && <div className="flex justify-between font-bold text-brand"><span>Kembalian</span><span>{rupiah(t.change)}</span></div>}
          </div>

          {owner && t.cogs !== undefined && (
            <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
              <p className="mb-1 text-xs font-bold text-ink-muted">Khusus owner</p>
              <div className="flex justify-between"><span className="text-ink-muted">HPP transaksi</span><span>{rupiah(t.cogs)}</span></div>
              <div className="flex justify-between font-bold"><span>Laba kotor transaksi</span><span className={t.total - t.cogs < 0 ? 'text-danger' : 'text-brand'}>{t.total - t.cogs < 0 ? '-' : ''}{rupiah(Math.abs(t.total - t.cogs))}</span></div>
              {t.has_shortfall && <p className="mt-2 flex items-start gap-2 text-xs text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> HPP belum lengkap: barang ini terjual saat stok sistem kurang, jadi laba kotor terlihat lebih tinggi dari kenyataan.</p>}
            </div>
          )}
        </>
      )}
      {voiding && t && <ReasonModal title="Batalkan transaksi" confirmLabel="Batalkan transaksi" onClose={() => setVoiding(false)}
        onConfirm={async (reason) => { await voidTx(id, reason); setVoiding(false) }}
        description={`Transaksi ${t.invoice_no} (${rupiah(t.total)}) dibatalkan dan tidak dihitung lagi di laporan. Tidak ada fitur untuk mengurungkan pembatalan.`} />}
    </Modal>
  )
}

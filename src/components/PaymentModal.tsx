import { useState } from 'react'
import { AlertTriangle, Loader2, Printer } from 'lucide-react'
import Modal from './Modal'
import { rupiah } from '../lib/format'
import type { Method } from '../lib/types'

const QUICK = [10000, 20000, 50000, 100000]
const BIG_DISCOUNT_PCT = 20 // di atas ini, peringatan konfirmasi dibuat lebih keras

interface Props { total: number; method: Method; busy: boolean; error: string | null; onSubmit: (paid: number, print: boolean) => void; onClose: () => void }

export default function PaymentModal({ total, method, busy, error, onSubmit, onClose }: Props) {
  const [digits, setDigits] = useState(method === 'qris' ? String(total) : '')
  const [confirmPrint, setConfirmPrint] = useState<boolean | null>(null) // null = belum di tahap konfirmasi diskon

  const paid = Number(digits || 0)
  const finalTotal = Math.min(total, paid)
  const discount = total - finalTotal // bayar kurang dari total => selisih dicatat sebagai diskon
  const change = Math.max(0, paid - total)
  const pct = total > 0 ? Math.round((discount / total) * 100) : 0
  const big = pct >= BIG_DISCOUNT_PCT

  const go = (print: boolean) => (discount > 0 ? setConfirmPrint(print) : onSubmit(paid, print))
  const close = () => { if (!busy) onClose() }

  if (confirmPrint !== null) {
    return (
      <Modal title="Konfirmasi diskon" onClose={close}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setConfirmPrint(null)} disabled={busy} className="flex-1 rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Periksa lagi</button>
            <button onClick={() => onSubmit(paid, confirmPrint)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={16} className="animate-spin" />} Ya, simpan
            </button>
          </div>
        }>
        <div className={`rounded-xl p-4 text-center ${big ? 'border border-danger bg-danger/5' : 'bg-surface'}`}>
          {big && <AlertTriangle className="mx-auto mb-1 text-danger" />}
          <p className="text-sm text-ink-muted">Diskon yang akan dicatat</p>
          <p className={`text-3xl font-extrabold ${big ? 'text-danger' : 'text-brand'}`}>{rupiah(discount)}</p>
          <p className="text-sm">{pct}% dari total {rupiah(total)}</p>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          {big ? 'Diskon ini besar. Pastikan jumlah bayar sudah benar, transaksi yang tersimpan hanya bisa dibatalkan oleh owner.' : `Pelanggan membayar ${rupiah(paid)} dari total ${rupiah(total)}.`}
        </p>
        {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
      </Modal>
    )
  }

  const disabled = busy || paid <= 0
  return (
    <Modal title="Pembayaran" onClose={close}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => go(true)} disabled={disabled} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Simpan &amp; Cetak resi
          </button>
          <button onClick={() => go(false)} disabled={disabled} className="flex-1 rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-40">Simpan tanpa cetak resi</button>
        </div>
      }>
      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm">Total yang harus dibayar:</span>
        <span className="text-2xl font-extrabold text-brand">{rupiah(total)}</span>
      </div>

      <label className="mt-4 block text-sm">Jumlah bayar
        <input value={digits ? rupiah(paid) : ''} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
          inputMode="numeric" placeholder="Rp 0"
          className="mt-1 w-full rounded-xl border border-surface-border px-4 py-3 text-base font-bold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
      </label>

      {method === 'cash' && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={() => setDigits(String(total))} className="rounded-xl border border-brand bg-surface py-2 text-sm font-semibold text-brand">Uang pas</button>
          {QUICK.map((q) => (
            <button key={q} onClick={() => setDigits(String(q))} className="rounded-xl border border-surface-border py-2 text-sm">{rupiah(q)}</button>
          ))}
        </div>
      )}

      {paid > 0 && (
        <div className="mt-4 space-y-1 text-sm">
          {discount > 0 && <div className="flex justify-between font-semibold text-danger"><span>Diskon ({pct}%)</span><span>-{rupiah(discount)}</span></div>}
          {change > 0 && <div className="flex justify-between text-base font-bold text-brand"><span>Kembalian</span><span>{rupiah(change)}</span></div>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}

import { useState } from 'react'
import { AlertTriangle, Loader2, Printer } from 'lucide-react'
import Modal from './Modal'
import { rupiah } from '../lib/format'
import type { Method } from '../lib/types'

const QUICK = [10000, 20000, 50000, 100000]
const BIG_DISCOUNT_PCT = 20 // di atas ini, konfirmasi diskon dibuat lebih keras
const digitsOf = (s: string) => s.replace(/\D/g, '').slice(0, 9)

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">{label}
      <input value={value ? rupiah(Number(value)) : ''} onChange={(e) => onChange(digitsOf(e.target.value))} inputMode="numeric" placeholder="Rp 0"
        className="mt-1 w-full rounded-xl border border-surface-border px-4 py-3 text-base font-bold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
    </label>
  )
}

interface Props {
  subtotal: number; method: Method; busy: boolean; error: string | null
  onSubmit: (finalTotal: number, paid: number, print: boolean) => void; onClose: () => void
}

export default function PaymentModal({ subtotal, method, busy, error, onSubmit, onClose }: Props) {
  const cash = method === 'cash'
  const [totalD, setTotalD] = useState(String(subtotal)) // total akhir yang disepakati, default = harga normal
  const [paidD, setPaidD] = useState('')
  const [confirmPrint, setConfirmPrint] = useState<boolean | null>(null) // null = belum di tahap konfirmasi diskon

  const total = Number(totalD || 0)
  const paid = cash ? Number(paidD || 0) : total // QRIS: dibayar pas sebesar total
  const discount = subtotal - total
  const pct = discount > 0 ? Math.max(1, Math.round((discount / subtotal) * 100)) : 0
  const big = pct >= BIG_DISCOUNT_PCT
  const change = Math.max(0, paid - total)
  const shortfall = cash && total > 0 && paid > 0 && paid < total ? total - paid : 0
  const totalErr = total > subtotal ? `Total tidak boleh melebihi ${rupiah(subtotal)}.` : null
  const valid = total > 0 && total <= subtotal && paid >= total

  const go = (print: boolean) => (discount > 0 ? setConfirmPrint(print) : onSubmit(total, paid, print))
  const close = () => { if (!busy) onClose() }

  if (confirmPrint !== null) {
    return (
      <Modal title="Konfirmasi diskon" onClose={close}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setConfirmPrint(null)} disabled={busy} className="flex-1 rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Periksa lagi</button>
            <button onClick={() => onSubmit(total, paid, confirmPrint)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={16} className="animate-spin" />} Ya, simpan
            </button>
          </div>
        }>
        <div className={`rounded-xl p-4 text-center ${big ? 'border border-danger bg-danger/5' : 'bg-surface'}`}>
          {big && <AlertTriangle className="mx-auto mb-1 text-danger" />}
          <p className="text-sm text-ink-muted">Diskon yang akan dicatat</p>
          <p className={`text-3xl font-extrabold ${big ? 'text-danger' : 'text-brand'}`}>{rupiah(discount)}</p>
          <p className="text-sm">{pct}% dari harga normal</p>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Harga normal</span><span>{rupiah(subtotal)}</span></div>
          <div className="flex justify-between font-bold"><span>Total disepakati</span><span>{rupiah(total)}</span></div>
          {cash && <div className="flex justify-between"><span className="text-ink-muted">Jumlah bayar</span><span>{rupiah(paid)}</span></div>}
          {change > 0 && <div className="flex justify-between font-bold text-brand"><span>Kembalian</span><span>{rupiah(change)}</span></div>}
        </div>
        {big && <p className="mt-3 text-sm text-danger">Diskon ini besar. Pastikan total yang disepakati sudah benar, transaksi yang tersimpan hanya bisa dibatalkan oleh owner.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
      </Modal>
    )
  }

  return (
    <Modal title="Pembayaran" onClose={close}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => go(true)} disabled={busy || !valid} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Simpan &amp; Cetak resi
          </button>
          <button onClick={() => go(false)} disabled={busy || !valid} className="flex-1 rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-40">Simpan tanpa cetak resi</button>
        </div>
      }>
      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm">Harga normal:</span>
        <span className="text-xl font-extrabold text-brand">{rupiah(subtotal)}</span>
      </div>

      <div className="mt-4">
        <MoneyInput label="Total" value={totalD} onChange={setTotalD} />
        {totalErr && <p role="alert" className="mt-1 text-xs text-danger">{totalErr}</p>}
        {discount > 0 && !totalErr ? (
          <p className="mt-1 flex items-center justify-between text-xs font-semibold text-danger">
            <span>Diskon {rupiah(discount)} ({pct}%)</span>
            <button type="button" onClick={() => setTotalD(String(subtotal))} className="underline">Reset</button>
          </p>
        ) : !totalErr && <p className="mt-1 text-xs text-ink-muted">Ubah hanya jika harga akhir disepakati lebih murah.</p>}
      </div>

      {cash && (
        <div className="mt-4">
          <MoneyInput label="Jumlah bayar" value={paidD} onChange={setPaidD} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button onClick={() => setPaidD(String(total))} disabled={total <= 0} className="rounded-xl border border-brand bg-surface py-2 text-sm font-semibold text-brand disabled:opacity-40">Uang pas</button>
            {QUICK.map((q) => (
              <button key={q} onClick={() => setPaidD(String(q))} className="rounded-xl border border-surface-border py-2 text-sm">{rupiah(q)}</button>
            ))}
          </div>
          {shortfall > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              Jumlah bayar kurang {rupiah(shortfall)} dari total.
              <button type="button" onClick={() => setTotalD(String(paid))} className="mt-1 block font-semibold underline">
                Jadikan total {rupiah(paid)} (diskon {rupiah(subtotal - paid)})
              </button>
            </div>
          )}
        </div>
      )}

      {valid && change > 0 && <div className="mt-4 flex justify-between text-base font-bold text-brand"><span>Kembalian</span><span>{rupiah(change)}</span></div>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}

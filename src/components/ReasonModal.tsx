import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import { formErrors } from '../lib/errors'

// Konfirmasi tindakan yang butuh alasan (hapus pengeluaran, batalkan hitung ulang).
export default function ReasonModal({ title, description, confirmLabel, onConfirm, onClose }: {
  title: string; description: string; confirmLabel: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function go() {
    if (reason.trim().length < 3) { setErr('Alasan wajib diisi (minimal 3 karakter).'); return }
    setBusy(true); setErr('')
    try { await onConfirm(reason.trim()) }
    catch (e) { const r = formErrors(e); setErr(r.fields.reason || r.message || Object.values(r.fields)[0] || 'Gagal memproses.') }
    finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={() => !busy && onClose()}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Batal</button>
          <button onClick={go} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-danger py-3 font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />} {confirmLabel}</button>
        </div>
      }>
      <p className="text-sm">{description}</p>
      <label className="mt-3 block text-sm">Alasan <span className="text-danger">*</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={200} placeholder="Contoh: salah input nominal"
          className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/20 ${err ? 'border-danger' : 'border-surface-border focus:border-brand'}`} />
      </label>
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </Modal>
  )
}

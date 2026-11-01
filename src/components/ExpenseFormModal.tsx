import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import MoneyField from './MoneyField'
import { useToast } from './Toast'
import { useExpenseSuggestions } from '../hooks/useExpenses'
import { api } from '../lib/api'
import { todayWib } from '../lib/dates'
import { formErrors } from '../lib/errors'
import type { Expense } from '../lib/types'

// Pengeluaran operasional. Jenis diketik bebas (saran dari riwayat). Uang kulak TIDAK dicatat di sini, lihat tab Kulak.
export default function ExpenseFormModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const sugg = useExpenseSuggestions()
  const today = todayWib()
  const [date, setDate] = useState(expense?.spent_at ?? today)
  const [name, setName] = useState(expense?.name ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const e: Record<string, string> = {}
    if (!date) e.spent_at = 'Tanggal wajib diisi.'
    else if (date > today) e.spent_at = 'Tanggal tidak boleh di masa depan.'
    if (!name.trim()) e.name = 'Jenis pengeluaran wajib diisi.'
    if (!(Number(amount) >= 1)) e.amount = 'Nominal wajib diisi.'
    setErrs(e); setGeneral('')
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const r = await api<{ data: Expense; warnings?: string[] }>(expense ? `/expenses/${expense.id}` : '/expenses', {
        method: expense ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: name.trim(), category: 'lainnya', amount: Number(amount), spent_at: date,
          ...(notes.trim() ? { notes: notes.trim() } : expense ? { notes: null } : {}),
        }),
      })
      await Promise.all(['expenses', 'expense-suggestions', 'finance'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
      toast.success(expense ? 'Pengeluaran berhasil diperbarui' : 'Pengeluaran berhasil ditambahkan')
      ;(r.warnings ?? []).forEach((w) => toast.error(String(w)))
      onClose()
    } catch (err) { const r = formErrors(err); setErrs(r.fields); setGeneral(r.message) } finally { setBusy(false) }
  }

  const box = (bad?: string) => `mt-1 w-full rounded-xl border px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand/20 ${bad ? 'border-danger' : 'border-surface-border focus:border-brand'}`
  return (
    <Modal title={expense ? 'Ubah Pengeluaran' : 'Tambah Pengeluaran Baru'} onClose={() => !busy && onClose()}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand disabled:opacity-50">Batal</button>
          <button onClick={save} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </div>
      }>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Catat pengeluaran operasional toko.</p>
        <label className="block text-sm">Tanggal <span className="text-danger">*</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={box(errs.spent_at)} />
          {errs.spent_at && <span role="alert" className="mt-1 block text-xs text-danger">{errs.spent_at}</span>}
        </label>
        <label className="block text-sm">Jenis pengeluaran <span className="text-danger">*</span>
          <input value={name} onChange={(e) => setName(e.target.value)} list="expense-suggestions" maxLength={100} placeholder="Contoh: Listrik bulan Oktober" className={box(errs.name)} />
          <datalist id="expense-suggestions">{(sugg.data ?? []).map((s) => <option key={s} value={s} />)}</datalist>
          {errs.name ? <span role="alert" className="mt-1 block text-xs text-danger">{errs.name}</span> : <span className="mt-1 block text-xs text-ink-muted">Ketik bebas. Pilihan muncul dari pengeluaran sebelumnya.</span>}
        </label>
        <label className="block text-sm">Deskripsi (opsional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Keterangan tambahan" className={box(errs.notes)} />
          {errs.notes && <span role="alert" className="mt-1 block text-xs text-danger">{errs.notes}</span>}
        </label>
        <MoneyField label="Nominal pengeluaran (Rp) *" value={amount} onChange={setAmount} error={errs.amount} />
        <p className="rounded-lg bg-surface p-3 text-xs text-ink-muted">Uang kulak tidak dicatat di sini. Catat di Barang &amp; Stok, tab Kulak, agar tidak terhitung dua kali di laporan.</p>
        {general && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
      </div>
    </Modal>
  )
}

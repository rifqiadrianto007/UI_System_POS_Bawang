import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { useSuppliers } from '../hooks/usePurchases'
import { api } from '../lib/api'
import { formErrors } from '../lib/errors'
import type { Supplier } from '../lib/types'

export default function SupplierModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useSuppliers()
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)

  const open = (s: Supplier | 'new') => {
    setEditing(s); setErrs({}); setGeneral('')
    setName(s === 'new' ? '' : s.name); setPhone(s === 'new' ? '' : s.phone ?? ''); setNote(s === 'new' ? '' : s.note ?? '')
  }

  async function save() {
    if (!name.trim()) { setErrs({ name: 'Nama supplier wajib diisi.' }); return }
    setBusy(true); setErrs({}); setGeneral('')
    try {
      await api(editing === 'new' ? '/suppliers' : `/suppliers/${(editing as Supplier).id}`, {
        method: editing === 'new' ? 'POST' : 'PUT',
        body: JSON.stringify({ name: name.trim(), ...(editing === 'new' ? { ...(phone.trim() ? { phone: phone.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) } : { phone: phone.trim() || null, note: note.trim() || null }) }),
      })
      await Promise.all([qc.invalidateQueries({ queryKey: ['suppliers'] }), qc.invalidateQueries({ queryKey: ['purchases'] })])
      toast.success(editing === 'new' ? 'Supplier ditambahkan' : 'Supplier diperbarui')
      setEditing(null)
    } catch (e) { const r = formErrors(e); setErrs(r.fields); setGeneral(r.message) } finally { setBusy(false) }
  }

  const input = 'mt-1 w-full rounded-xl border border-surface-border px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
  return (
    <Modal title="Supplier" onClose={onClose}
      footer={editing ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditing(null)} disabled={busy} className="rounded-xl border border-brand py-3 font-semibold text-brand">Batal</button>
          <button onClick={save} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </div>
      ) : (
        <button onClick={() => open('new')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-hover"><Plus size={18} /> Tambah supplier</button>
      )}>
      {editing ? (
        <div className="space-y-3">
          <label className="block text-sm">Nama supplier <span className="text-danger">*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} />
            {errs.name && <span role="alert" className="mt-1 block text-xs text-danger">{errs.name}</span>}
          </label>
          <label className="block text-sm">Telepon (opsional)<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20} className={input} /></label>
          <label className="block text-sm">Catatan (opsional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={input} /></label>
          {general && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{general}</p>}
        </div>
      ) : q.isPending ? <div className="h-20 animate-pulse rounded-xl bg-surface" /> : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface py-8 text-center text-sm text-ink-muted">Belum ada supplier.</p>
      ) : (
        <ul className="space-y-2">
          {q.data!.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
              <div className="min-w-0"><p className="text-sm font-bold">{s.name}</p><p className="truncate text-xs text-ink-muted">{[s.phone, s.note].filter(Boolean).join(' · ') || '-'}</p></div>
              <button onClick={() => open(s)} aria-label={`Ubah ${s.name}`} className="rounded-lg p-2 text-brand hover:bg-white"><Pencil size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

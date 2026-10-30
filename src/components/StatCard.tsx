import type { LucideIcon } from 'lucide-react'

export default function StatCard({ icon: Icon, label, value, note, dim, danger }: { icon: LucideIcon; label: string; value: string; note?: string; dim?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 sm:p-4">
      <div className="hidden size-11 shrink-0 place-items-center rounded-full bg-white text-brand sm:grid"><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className={`truncate text-base font-extrabold sm:text-lg ${danger ? 'text-danger' : 'text-brand'} ${dim ? 'opacity-40' : ''}`}>{value}</p>
        {note && <p className="text-[11px] text-ink-muted">{note}</p>}
      </div>
    </div>
  )
}

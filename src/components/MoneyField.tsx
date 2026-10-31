import { rupiah } from '../lib/format'

export const digitsOf = (s: string) => s.replace(/\D/g, '').slice(0, 9)

export default function MoneyField({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <label className="block text-sm">{label}
      <input value={value ? rupiah(Number(value)) : ''} onChange={(e) => onChange(digitsOf(e.target.value))} inputMode="numeric" placeholder="Rp 0"
        className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-base font-semibold outline-none focus:ring-2 focus:ring-brand/20 ${error ? 'border-danger' : 'border-surface-border focus:border-brand'}`} />
      {error ? <span role="alert" className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

import { useState } from 'react'
import KatalogTab from '../components/KatalogTab'
import StokTab from '../components/StokTab'

const TABS = [{ id: 'barang', label: 'Barang' }, { id: 'stok', label: 'Stok' }] as const

export default function BarangPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('barang')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-5 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-brand text-white' : 'border border-surface-border text-ink-muted'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'barang' ? <KatalogTab /> : <StokTab />}
    </div>
  )
}

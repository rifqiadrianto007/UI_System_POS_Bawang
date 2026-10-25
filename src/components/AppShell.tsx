import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { History, LogOut, Menu, ShoppingCart, X } from 'lucide-react'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/kasir', label: 'Kasir', title: 'Kasir', icon: ShoppingCart },
  { to: '/riwayat', label: 'Riwayat Transaksi', title: 'Riwayat Transaksi', icon: History },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const title = NAV.find((n) => pathname.startsWith(n.to))?.title ?? ''
  const initials = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border px-5 py-4">
        <p className="text-xl font-bold leading-tight text-brand">FAUNA BAWANG</p>
        <p className="text-xs text-ink-muted">Sistem kasir</p>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-surface text-brand' : 'text-ink hover:bg-surface/60'}`}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-surface-border p-4">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-surface/60">
          <LogOut size={18} /> Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full bg-page">
      <aside className="hidden w-61 shrink-0 border-r border-surface-border lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85%] bg-page shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen((v) => !v)} className="rounded-lg bg-surface p-2 text-brand lg:hidden" aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <h1 className="text-lg font-bold leading-tight">{title}</h1>
              <p className="text-xs text-ink-muted">Toko Sumber Rezeki</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-1.5">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{user?.name}</p>
              <p className="text-[11px] capitalize text-ink-muted">{user?.role}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-brand text-xs font-bold text-white">{initials}</div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler, TOKEN_KEY, tokenStore } from './api'
import { FLASH_KEY, SECURITY } from '../config/security'

export interface User { id: number; name: string; username: string; role: 'kasir' | 'owner'; is_active: boolean }
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)
export const useAuth = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth harus di dalam AuthProvider')
  return c
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => !!tokenStore.get())

  // Buang token DAN seluruh cache data: pengguna berikutnya di perangkat yang sama (mis. kasir setelah owner) tidak boleh melihat sisa data.
  const reset = useCallback(() => { tokenStore.clear(); setUser(null); qc.clear() }, [qc])

  useEffect(() => { setUnauthorizedHandler(reset) }, [reset])

  // Validasi token yang tersimpan saat aplikasi dibuka.
  useEffect(() => {
    if (!tokenStore.get()) return
    api<{ user: User }>('/auth/me')
      .then((r) => (r.user.is_active ? setUser(r.user) : reset()))
      .catch(() => {}) // 401 sudah ditangani handler; error jaringan: user tetap null, diminta login ulang
      .finally(() => setLoading(false))
  }, [reset])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST', auth: false, body: JSON.stringify({ username, password }),
    })
    qc.clear() // pastikan tidak ada data sisa dari sesi sebelumnya
    tokenStore.set(r.token)
    setUser(r.user)
  }, [qc])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch { /* token dibuang di sisi klien bagaimanapun */ }
    reset()
  }, [reset])

  // Login atau logout di tab lain: muat ulang agar tidak ada dua pengguna tercampur dalam satu perangkat.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === TOKEN_KEY) window.location.reload() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Cek ulang akun saat aplikasi kembali ke layar: akun yang dinonaktifkan atau token yang dicabut langsung keluar.
  useEffect(() => {
    if (!user) return
    let last = Date.now()
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < SECURITY.revalidateEveryMs) return
      last = Date.now()
      api<{ user: User }>('/auth/me').then((r) => (r.user.is_active ? setUser(r.user) : reset())).catch(() => {})
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [user, reset])

  // Logout otomatis karena tidak ada aktivitas (per role, lihat config/security.ts).
  const idleMin = !user ? 0 : user.role === 'owner' ? SECURITY.ownerIdleMinutes : SECURITY.kasirIdleMinutes
  useEffect(() => {
    if (idleMin <= 0) return
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const idleMs = idleMin * 60_000
    const timer = setInterval(() => {
      if (Date.now() - last > idleMs) {
        sessionStorage.setItem(FLASH_KEY, `Sesi berakhir karena tidak ada aktivitas selama ${idleMin} menit. Silakan login kembali.`)
        void logout()
      }
    }, Math.min(15_000, Math.max(250, idleMs / 2)))
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); clearInterval(timer) }
  }, [idleMin, logout])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

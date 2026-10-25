import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from './api'

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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => !!tokenStore.get())

  const reset = useCallback(() => { tokenStore.clear(); setUser(null) }, [])

  useEffect(() => { setUnauthorizedHandler(reset) }, [reset])

  // Validasi token yang tersimpan saat aplikasi dibuka.
  useEffect(() => {
    if (!tokenStore.get()) return
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {}) // 401 sudah ditangani handler; error jaringan: user tetap null, diminta login ulang
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST', auth: false, body: JSON.stringify({ username, password }),
    })
    tokenStore.set(r.token)
    setUser(r.user)
  }, [])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch { /* token dibuang di sisi klien bagaimanapun */ }
    reset()
  }, [reset])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Settings, User } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/kasir" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await login(username.trim(), password)
      navigate('/kasir', { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0]?.[0] : err.message) : 'Terjadi kesalahan.'
      setError(msg ?? 'Login gagal.')
    } finally { setBusy(false) }
  }

  const field = 'flex items-center gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20'

  return (
    <div className="flex min-h-full flex-col items-center justify-between bg-page px-4 py-8">
      <header className="text-center">
        <p className="text-2xl font-extrabold tracking-tight text-brand">FAUNA BAWANG</p>
        <p className="text-sm text-ink-muted">Sistem Kasir</p>
      </header>

      <main className="w-full max-w-md rounded-2xl border border-surface-border bg-white p-6 shadow-[0_8px_30px_rgba(92,7,7,0.08)] sm:p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface text-brand"><Settings size={30} /></div>
        <h2 className="mt-5 text-center text-2xl font-bold">Login Admin / Owner</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">Masuk untuk mengelola data, laporan,<br />dan pengaturan sistem</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Username</span>
            <span className={field}>
              <User size={18} className="text-ink-muted" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username"
                autoComplete="username" autoCapitalize="none" required className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted/60" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <span className={field}>
              <Lock size={18} className="text-ink-muted" />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password" autoComplete="current-password" required
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted/60" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} className="text-ink-muted">
                {show ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy || !username || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <>Login <ArrowRight size={18} /></>}
          </button>
        </form>
      </main>

      <footer className="text-center text-xs text-ink-muted">
        <p className="font-bold text-ink/70">FAUNA BAWANG</p>
        <p>Toko Sumber Rezeki</p>
        <p className="mt-1">© {new Date().getFullYear()} Fauna Bawang. Semua hak dilindungi.</p>
      </footer>
    </div>
  )
}

import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useAuth, type User } from './lib/auth'
import { homeFor } from './lib/roles'
import KasirPage from './pages/KasirPage'
import LaporanPage from './pages/LaporanPage'
import LoginPage from './pages/LoginPage'
import Placeholder from './pages/Placeholder'
import RiwayatPage from './pages/RiwayatPage'

const Spinner = () => <div className="grid h-full place-items-center text-brand"><Loader2 className="animate-spin" /></div>

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

// Halaman owner. Kasir diarahkan kembali ke halamannya; pembatasan sebenarnya tetap ditegakkan backend.
function RequireRole({ role }: { role: User['role'] }) {
  const { user } = useAuth()
  return user?.role === role ? <Outlet /> : <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/kasir" element={<KasirPage />} />
            <Route path="/riwayat" element={<RiwayatPage />} />
            <Route element={<RequireRole role="owner" />}>
              <Route path="/laporan" element={<LaporanPage />} />
              <Route path="/barang" element={<Placeholder name="Barang & Stok" />} />
              <Route path="/pengeluaran" element={<Placeholder name="Pengeluaran" />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

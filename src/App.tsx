import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useAuth } from './lib/auth'
import KasirPage from './pages/KasirPage'
import LoginPage from './pages/LoginPage'
import RiwayatPage from './pages/RiwayatPage'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-full place-items-center text-brand"><Loader2 className="animate-spin" /></div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/kasir" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

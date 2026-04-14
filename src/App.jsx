import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login           from './pages/auth/Login'
import Registro        from './pages/auth/Registro'
import PersoneroPanel  from './pages/personero/PersoneroPanel'
import AdminDashboard  from './pages/admin/AdminDashboard'
import SuperAdminPanel from './pages/admin/SuperAdminPanel'

// Spinner simple
function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-rojo border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    </div>
  )
}

// Guard por rol
function Guard({ roles, children }) {
  const { loading, session, perfil } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (!perfil)  return <Spinner /> // perfil aún cargando
  if (!roles.includes(perfil.rol)) {
    if (perfil.rol === 'superadmin')    return <Navigate to="/superadmin" replace />
    if (perfil.rol === 'admin_partido') return <Navigate to="/admin" replace />
    return <Navigate to="/personero" replace />
  }
  return children
}

// Redirect desde raíz
function Root() {
  const { loading, session, perfil } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (!perfil)  return <Spinner />
  if (perfil.rol === 'superadmin')    return <Navigate to="/superadmin" replace />
  if (perfil.rol === 'admin_partido') return <Navigate to="/admin" replace />
  return <Navigate to="/personero" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"         element={<Root />} />
      <Route path="/login"    element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/personero"  element={<Guard roles={['personero']}><PersoneroPanel /></Guard>} />
      <Route path="/admin"      element={<Guard roles={['admin_partido']}><AdminDashboard /></Guard>} />
      <Route path="/superadmin" element={<Guard roles={['superadmin']}><SuperAdminPanel /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
      </AuthProvider>
    </BrowserRouter>
  )
}

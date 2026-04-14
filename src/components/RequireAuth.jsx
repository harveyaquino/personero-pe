import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children, allowedRoles }) {
  const { user, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Verificando sesión...</div>
      </div>
    )
  }

  if (!user || !perfil) return <Navigate to="/login" replace />

  if (!perfil.activo) return <Navigate to="/bloqueado" replace />

  if (allowedRoles && !allowedRoles.includes(perfil.rol)) {
    if (perfil.rol === 'personero') return <Navigate to="/personero" replace />
    if (perfil.rol === 'admin_partido') return <Navigate to="/admin" replace />
    if (perfil.rol === 'superadmin') return <Navigate to="/superadmin" replace />
  }

  return children
}

import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function Header() {
  const { perfil, partido, signOut } = useAuth()

  const rolLabel = {
    superadmin:    'Super Admin',
    admin_partido: 'Admin',
    personero:     'Personero',
  }

  return (
    <header className="bg-rojo px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-sm">
      {/* Bandera */}
      <div className="flex gap-0.5 shrink-0">
        <div className="w-2 h-6 bg-white rounded-sm" />
        <div className="w-2 h-6 bg-rojo border border-white/30 rounded-sm" />
        <div className="w-2 h-6 bg-white rounded-sm" />
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-white font-semibold text-sm leading-tight truncate">
          Personero.pe | EG 2026
        </h1>
        {partido && (
          <p className="text-white/75 text-xs truncate leading-tight">{partido.nombre}</p>
        )}
        <p className="text-white/50 text-[10px] leading-tight hidden sm:block">
          Desarrollado por <a href="https://www.linkedin.com/in/harveyaquinomas/" target="_blank" rel="noopener noreferrer" className="underline text-white/70">Harvey Aquino Mas</a>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {perfil && (
          <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full border border-white/30">
            {rolLabel[perfil.rol] ?? perfil.rol}
          </span>
        )}
        <button
          onClick={signOut}
          className="bg-white/15 text-white border border-white/30 rounded-xl p-2.5 hover:bg-white/25 active:scale-95 transition-all"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

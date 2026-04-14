import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Footer } from '../../components/layout/Footer'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr
      const { data: perfil, error: perfilErr } = await supabase
        .from('perfiles').select('rol').eq('id', data.user.id).single()
      if (perfilErr || !perfil) {
        setError('Usuario sin perfil asignado. Contacta al administrador.')
        await supabase.auth.signOut()
        return
      }
      toast.success('Bienvenido')
      if (perfil.rol === 'superadmin')    navigate('/superadmin', { replace: true })
      else if (perfil.rol === 'admin_partido') navigate('/admin', { replace: true })
      else navigate('/personero', { replace: true })
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
      toast.error('Acceso denegado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header simple */}
      <div className="bg-rojo px-4 py-3 flex items-center gap-3">
        <div className="flex gap-0.5">
          <div className="w-2 h-6 bg-white rounded-sm" />
          <div className="w-2 h-6 bg-rojo border border-white/30 rounded-sm" />
          <div className="w-2 h-6 bg-white rounded-sm" />
        </div>
        <h1 className="text-white font-semibold text-sm">Personero.pe | EG 2026</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8 gap-3">
            <div className="w-20 h-20 bg-rojo rounded-full flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10">
                <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="white" strokeWidth="1.5"/>
                <path d="M16 4v24M4 10l12 6 12-6" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-900">Personero.pe</h1>
              <p className="text-sm text-gray-500 mt-1">Elecciones Generales 2026 · Perú</p>
            </div>
          </div>

          <div className="card p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Correo electrónico</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input" placeholder="usuario@partido.pe"
                  required autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div>
                <label className="form-label">Contraseña</label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="form-input" placeholder="••••••••••"
                  required autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">
                {loading ? 'Verificando...' : 'Ingresar al Sistema'}
              </button>
            </form>
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-800">
              ⚠ Acceso restringido. Todos los intentos quedan registrados y auditados.
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  )
}

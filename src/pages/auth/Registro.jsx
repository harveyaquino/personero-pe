import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Footer } from '../../components/layout/Footer'

export default function Registro() {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const token     = params.get('token')

  const [inv, setInv]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm]     = useState({ nombre: '', dni: '', telefono: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!token) { setLoading(false); return }
    async function checkToken() {
      const { data } = await supabase
        .from('invitaciones')
        .select('*, partido:partidos(nombre, color_hex), mesa:mesas(numero, local_nombre)')
        .eq('token', token)
        .eq('usado', false)
        .gt('expira_at', new Date().toISOString())
        .single()
      setInv(data)
      if (data?.nombre) setForm(f => ({ ...f, nombre: data.nombre }))
      setLoading(false)
    }
    checkToken()
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 10) { setError('La contraseña debe tener mínimo 10 caracteres'); return }
    setSaving(true)
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: inv.email,
        password: form.password,
      })
      if (authErr) throw authErr

      const userId = authData.user.id

      // 2. Usar función SECURITY DEFINER que crea perfil + asigna mesa + marca invitación
      // Esta función bypasea el RLS para garantizar que todo se crea correctamente
      const { data: result, error: fnErr } = await supabase.rpc('registrar_personero', {
        p_user_id:  userId,
        p_token:    token,
        p_nombre:   form.nombre,
        p_dni:      form.dni,
        p_telefono: form.telefono,
      })

      if (fnErr) throw fnErr
      if (!result?.ok) throw new Error(result?.error ?? 'Error al registrar')

      toast.success('Registro exitoso. Inicia sesión para continuar.')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm animate-pulse">Verificando invitación...</div>
    </div>
  )

  if (!token || !inv) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Invitación inválida</h2>
        <p className="text-sm text-gray-500">
          El link de invitación no es válido, ya fue usado o expiró.
          Contacta al administrador de tu partido.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white font-bold text-sm"
            style={{ background: inv.partido?.color_hex ?? '#C8102E' }}
          >
            {inv.partido?.nombre?.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Registro de Personero</h1>
            <p className="text-sm text-gray-500 mt-1">{inv.partido?.nombre}</p>
            {inv.mesa && (
              <p className="text-xs text-gray-400 mt-0.5">
                Mesa {inv.mesa.numero} — {inv.mesa.local_nombre}
              </p>
            )}
          </div>
        </div>

        <div className="card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                className="form-input bg-gray-50 text-gray-400"
                value={inv.email}
                disabled
              />
            </div>
            <div>
              <label className="form-label">Nombre completo *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Tu nombre y apellidos"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">DNI *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="12345678"
                  maxLength={8}
                  value={form.dni}
                  onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  className="form-input font-mono"
                  placeholder="9XX XXX XXX"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Contraseña * (mín. 10 caracteres)</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="form-label">Confirmar contraseña *</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Creando cuenta...' : 'Completar registro'}
            </button>
          </form>
        </div>

        <Footer />
      </div>
    </div>
  )
}

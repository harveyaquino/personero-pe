import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil,  setPerfil]  = useState(null)

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session?.user) loadPerfil(session.user.id)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session?.user) loadPerfil(session.user.id)
      else setPerfil(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPerfil(userId) {
    const { data } = await supabase
      .from('perfiles')
      .select('*, partido:partidos(*)')
      .eq('id', userId)
      .single()
    setPerfil(data ?? null)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    setPerfil(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user:    session?.user ?? null,
      perfil,
      partido: perfil?.partido ?? null,
      loading: session === undefined,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

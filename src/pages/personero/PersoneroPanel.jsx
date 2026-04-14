import { useEffect, useState, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { PARTIDOS, CATEGORIAS } from '../../lib/data'
import toast from 'react-hot-toast'
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

// Componente de preferenciales por partido
function PreferencialesPanel({ catId, codigoPartido, actaVotoId, maxPref, disabled, onTotalChange, onSugerirVotos }) {
  const [prefs, setPrefs] = useState([]) // [{ numero, votos }]
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!actaVotoId) return
    supabase.from('acta_votos_pref')
      .select('*')
      .eq('acta_voto_id', actaVotoId)
      .order('numero_candidato')
      .then(({ data }) => {
        if (data) {
          const rows = data.map(r => ({ numero: r.numero_candidato, votos: r.votos, id: r.id }))
          setPrefs(rows)
          onTotalChange?.(rows.reduce((s,r) => s+(parseInt(r.votos)||0), 0))
        }
      })
  }, [actaVotoId])

  async function guardarPrefs() {
    if (!actaVotoId) return
    setLoading(true)
    try {
      // Agrupar duplicados: si el mismo número candidato aparece 2 veces, SUMAR los votos
      const agrupado = {}
      prefs.forEach(p => {
        if (!p.numero) return
        const num = parseInt(p.numero)
        agrupado[num] = (agrupado[num] || 0) + (parseInt(p.votos) || 0)
      })

      // Si hay duplicados, consolidar las filas
      const filasSinDuplicados = Object.entries(agrupado).map(([num, vts]) => ({ numero: num, votos: vts }))
      if (filasSinDuplicados.length < prefs.filter(p => p.numero).length) {
        setPrefs(filasSinDuplicados)
        onTotalChange?.(filasSinDuplicados.reduce((s,r) => s+(parseInt(r.votos)||0), 0))
        toast('Candidatos duplicados fueron sumados automáticamente', { icon: 'ℹ️' })
      }

      // Guardar en BD
      for (const [num, vts] of Object.entries(agrupado)) {
        await supabase.from('acta_votos_pref').upsert({
          acta_voto_id: actaVotoId,
          numero_candidato: parseInt(num),
          votos: vts,
        }, { onConflict: 'acta_voto_id,numero_candidato' })
      }

      // Sugerir total al campo de votos si está en 0
      const totalPref = Object.values(agrupado).reduce((s,v) => s+v, 0)
      onSugerirVotos?.(totalPref)

      toast.success('Preferenciales guardados')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function addFila() {
    if (prefs.length >= 20) return
    setPrefs(prev => [...prev, { numero: '', votos: '' }])
  }

  function removeFila(i) {
    setPrefs(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      onTotalChange?.(next.reduce((s,r) => s+(parseInt(r.votos)||0), 0))
      return next
    })
  }

  function updateFila(i, campo, val) {
    setPrefs(prev => {
      const next = prev.map((p, idx) => idx === i ? { ...p, [campo]: val } : p)
      if (campo === 'votos') onTotalChange?.(next.reduce((s,r) => s+(parseInt(r.votos)||0), 0))
      return next
    })
  }

  if (maxPref === 0) return null

  return (
    <div className="mx-3 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700">
          Votos preferenciales (máx. {maxPref} por votante)
        </span>
        {!disabled && (
          <button onClick={addFila} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus size={12} /> Agregar candidato
          </button>
        )}
      </div>

      {prefs.length === 0 && (
        <p className="text-xs text-blue-400 italic">Sin preferenciales registrados</p>
      )}

      {prefs.map((p, i) => (
        <div key={i} className="flex items-center gap-2 min-h-[48px]">
          <div className="text-xs text-blue-600 w-16 shrink-0">Candidato #</div>
          <input
            type="number" min="1" placeholder="N°"
            disabled={disabled}
            className="pref-input"
            value={p.numero}
            onChange={e => updateFila(i, 'numero', e.target.value)}
          />
          <div className="text-xs text-blue-600 shrink-0">→ Votos:</div>
          <input
            type="number" min="0" placeholder="0"
            disabled={disabled}
            className="pref-input"
            value={p.votos}
            onChange={e => updateFila(i, 'votos', e.target.value)}
          />
          {!disabled && (
            <button onClick={() => removeFila(i)} className="text-red-400 hover:text-red-600 ml-auto">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}

      {!disabled && prefs.length > 0 && (
        <button onClick={guardarPrefs} disabled={loading}
          className="w-full text-xs bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 disabled:opacity-50 mt-1">
          {loading ? 'Guardando...' : 'Guardar preferenciales'}
        </button>
      )}
    </div>
  )
}

export default function PersoneroPanel() {
  const { user, perfil } = useAuth()
  const [mesa, setMesa]             = useState(null)
  const [partidosDB, setPartidosDB] = useState([])
  const [actas, setActas]           = useState({})
  const [votos, setVotos]           = useState({})
  // acta_votos IDs para los preferenciales: { `${catId}-${codigo}`: uuid }
  const [actaVotoIds, setActaVotoIds] = useState({})
  const [extras, setExtras]         = useState({ electores: 0, nulos: 0, blancos: 0 })
  // Totales de votos preferenciales por partido { `${catId}-${codigo}`: total }
  const [prefTotales, setPrefTotales] = useState({})

  function updatePrefTotal(catId, codigo, total) {
    setPrefTotales(prev => ({ ...prev, [`${catId}-${codigo}`]: total }))
  }
  const [catAbierta, setCatAbierta] = useState(1)
  const [prefAbierto, setPrefAbierto] = useState(null) // `${catId}-${codigo}`
  const [guardando, setGuardando]   = useState({})
  const [enviando, setEnviando]     = useState({})

  useEffect(() => {
    if (!user) return
    supabase.from('personero_mesa').select('mesa:mesas(*)')
      .eq('personero_id', user.id).eq('activo', true).single()
      .then(({ data }) => {
        if (data?.mesa) {
          setMesa(data.mesa)
          setExtras(prev => ({ ...prev, electores: data.mesa.electores_habiles }))
        }
      })
  }, [user])

  useEffect(() => {
    supabase.from('partidos').select('id, codigo').order('nombre')
      .then(({ data }) => { if (data) setPartidosDB(data) })
  }, [])

  useEffect(() => {
    if (!mesa || !perfil?.partido_id || !partidosDB.length) return
    supabase.from('actas').select('*, votos:acta_votos(id, partido_votado_id, votos)')
      .eq('mesa_id', mesa.id).eq('partido_id', perfil.partido_id)
      .then(({ data }) => {
        if (!data) return
        const actasMap = {}, votosMap = {}, avIds = {}
        data.forEach(acta => {
          actasMap[acta.categoria_id] = acta
          acta.votos?.forEach(v => {
            const p = partidosDB.find(x => x.id === v.partido_votado_id)
            if (p) {
              votosMap[`${acta.categoria_id}-${p.codigo}`] = v.votos
              avIds[`${acta.categoria_id}-${p.codigo}`] = v.id
            }
          })
        })
        setActas(actasMap)
        setVotos(votosMap)
        setActaVotoIds(avIds)
      })
  }, [mesa, perfil, partidosDB])

  const totalCat = useCallback((catId) =>
    PARTIDOS.reduce((s, p) => s + (parseInt(votos[`${catId}-${p.codigo}`]) || 0), 0)
  , [votos])

  function setVoto(catId, codigo, val) {
    setVotos(prev => ({ ...prev, [`${catId}-${codigo}`]: val }))
  }

  function getUUID(codigo) {
    return partidosDB.find(x => x.codigo === codigo)?.id ?? null
  }

  async function getOrCreateActa(catId) {
    if (actas[catId]) return actas[catId]
    const { data, error } = await supabase.from('actas').upsert({
      mesa_id: mesa.id, partido_id: perfil.partido_id, personero_id: user.id,
      categoria_id: catId, estado: 'borrador',
      votos_nulos: parseInt(extras.nulos)||0,
      votos_blancos: parseInt(extras.blancos)||0,
      total_votantes: parseInt(extras.electores)||0,
    }, { onConflict: 'mesa_id,partido_id,categoria_id' }).select().single()
    if (error) throw error
    setActas(prev => ({ ...prev, [catId]: data }))
    return data
  }

  async function guardarBorrador(catId) {
    if (!mesa || !perfil?.partido_id || !partidosDB.length) return
    setGuardando(prev => ({ ...prev, [catId]: true }))
    try {
      const acta = await getOrCreateActa(catId)
      const rows = PARTIDOS.map(p => {
        const uuid = getUUID(p.codigo)
        if (!uuid) return null
        return {
          acta_id: acta.id,
          partido_votado_id: uuid,
          votos: parseInt(votos[`${catId}-${p.codigo}`]) || 0,
        }
      }).filter(Boolean)

      const { data: savedVotos, error } = await supabase.from('acta_votos')
        .upsert(rows, { onConflict: 'acta_id,partido_votado_id' })
        .select('id, partido_votado_id')
      if (error) throw error

      // Guardar IDs de acta_votos para preferenciales
      if (savedVotos) {
        const newIds = {}
        savedVotos.forEach(sv => {
          const p = partidosDB.find(x => x.id === sv.partido_votado_id)
          if (p) newIds[`${catId}-${p.codigo}`] = sv.id
        })
        setActaVotoIds(prev => ({ ...prev, ...newIds }))
      }

      toast.success(`Borrador guardado — ${CATEGORIAS.find(c => c.id === catId)?.nombre}`)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setGuardando(prev => ({ ...prev, [catId]: false }))
    }
  }

  async function reabrirActa(catId) {
    if (!actas[catId]) return
    if (!window.confirm('¿Reabrir esta acta para editar? Se borrará el sello de envío. Tienes hasta las 23:59 del día de la elección.')) return
    try {
      const { data, error } = await supabase.rpc('reabrir_acta', { p_acta_id: actas[catId].id })
      if (error) throw error
      if (!data.ok) throw new Error(data.error)
      setActas(prev => ({ ...prev, [catId]: { ...prev[catId], estado: 'borrador', hash_acta: null } }))
      toast('Acta reabierta. Puedes corregir y volver a enviar.', { icon: '✏️' })
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function enviarActa(catId) {
    if (!actas[catId]) { toast.error('Guarda el borrador primero'); return }
    setEnviando(prev => ({ ...prev, [catId]: true }))
    try {
      const { data, error } = await supabase.rpc('enviar_acta', { p_acta_id: actas[catId].id })
      if (error) throw error
      if (!data.ok) throw new Error(data.error)
      setActas(prev => ({ ...prev, [catId]: { ...prev[catId], estado: 'enviado' } }))
      toast.success('✓ Acta enviada y sellada')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setEnviando(prev => ({ ...prev, [catId]: false }))
    }
  }

  if (!mesa) return (
    <div className="min-h-screen">
      <Header />
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
          <p className="text-gray-600 text-sm">No tienes una mesa asignada.</p>
          <p className="text-gray-400 text-xs mt-1">Contacta al administrador de tu partido.</p>
        </div>
      </div>
      <Footer />
    </div>
  )

  const actasEnviadas = CATEGORIAS.filter(c => actas[c.id]?.estado === 'enviado').length

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-lg mx-auto px-3 py-4 space-y-3">

        {/* Mesa */}
        <div className="bg-gray-800 text-white rounded-xl p-4 flex items-center gap-4">
          <div>
            <div className="text-3xl font-mono font-bold">{mesa.numero}</div>
            <div className="text-white/60 text-xs">Mesa</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{mesa.local_nombre}</div>
            <div className="text-white/60 text-xs">{mesa.distrito} · {mesa.provincia} · {mesa.departamento}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-white/60">Actas</div>
            <div className="text-lg font-mono font-bold">{actasEnviadas}/{CATEGORIAS.length}</div>
          </div>
        </div>

        {/* Totales */}
        <div className="card p-4 grid grid-cols-4 gap-3 text-center">
          {[
            { val: extras.electores, lbl: 'Electores', cls: '' },
            { val: CATEGORIAS.reduce((s,c)=>s+totalCat(c.id),0), lbl: 'Votos', cls: 'text-yellow-600' },
            { val: extras.nulos,   lbl: 'Nulos',   cls: 'text-red-600' },
            { val: extras.blancos, lbl: 'Blancos',  cls: 'text-red-600' },
          ].map(({ val, lbl, cls }) => (
            <div key={lbl}>
              <div className={`text-lg font-mono font-semibold ${cls}`}>{val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Datos generales */}
        <div className="card p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos generales de la mesa</div>
          <div className="grid grid-cols-3 gap-3">
            {[['electores','Electores hábiles'],['nulos','Votos nulos'],['blancos','Votos en blanco']].map(([k,l])=>(
              <div key={k}>
                <label className="form-label">{l}</label>
                <input type="number" min="0" className="form-input font-mono text-center"
                  value={extras[k]} onChange={e=>setExtras(p=>({...p,[k]:e.target.value}))} />
              </div>
            ))}
          </div>
        </div>

        {/* Categorías */}
        {CATEGORIAS.map(cat => {
          const acta    = actas[cat.id]
          const enviado = acta?.estado === 'enviado'
          const abierta = catAbierta === cat.id
          const hasPref = cat.maxPref > 0

          return (
            <div key={cat.id} className="card overflow-hidden">
              {/* Header categoría */}
              <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50"
                onClick={() => setCatAbierta(abierta ? null : cat.id)}>
                <div className="w-2 h-6 rounded-sm shrink-0" style={{ background: cat.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: cat.color }}>{cat.nombre}</div>
                  <div className="text-xs text-gray-400 font-mono">Total: {totalCat(cat.id)} votos</div>
                </div>
                {enviado ? <CheckCircle size={16} className="text-green-600 shrink-0" />
                  : abierta ? <ChevronUp size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {abierta && (
                <div>
                  {/* Cabecera columnas */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <div className="w-8 shrink-0 text-center">#</div>
                    <div className="flex-1">Partido político</div>
                    <div className="w-16 text-center">Votos</div>
                    {hasPref && <div className="w-20 text-center text-blue-400">Pref.</div>}
                  </div>

                  {/* Filas de partidos */}
                  <div className="border-t border-gray-100">
                    {PARTIDOS.map(p => {
                      const prefKey    = `${cat.id}-${p.codigo}`
                      const avId       = actaVotoIds[prefKey]
                      const prefOpen   = prefAbierto === prefKey
                      const tieneVotos = parseInt(votos[prefKey]) > 0

                      return (
                        <div key={p.codigo}>
                          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-50 last:border-0">
                            {/* Número orden */}
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: p.color }}>
                              {p.orden}
                            </div>
                            {/* Nombre */}
                            <div className="flex-1 min-w-0 text-xs text-gray-800 leading-tight font-medium">{p.nombre}</div>
                            {/* Votos */}
                            <div className="flex flex-col items-center">
                              <input type="number" min="0" disabled={enviado} placeholder="0"
                                className="votos-input"
                                value={votos[prefKey] ?? ''}
                                onChange={e => setVoto(cat.id, p.codigo, e.target.value)} />
                              {prefTotales[prefKey] > 0 && (
                                <span className="text-[9px] text-blue-500 font-mono mt-0.5">
                                  Pref: {prefTotales[prefKey]}
                                </span>
                              )}
                            </div>
                            {/* Botón preferencial */}
                            {hasPref && (
                              <button
                                onClick={async () => {
                                  if (prefOpen) { setPrefAbierto(null); return }
                                  // Si no hay acta_voto_id, guardar borrador primero automáticamente
                                  if (!avId) {
                                    await guardarBorrador(cat.id)
                                  }
                                  setPrefAbierto(prefKey)
                                }}
                                disabled={enviado}
                                className={`w-16 text-[10px] py-2.5 rounded-lg border font-medium transition-all active:scale-95 ${
                                  prefOpen
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 disabled:opacity-30'
                                }`}
                              >
                                {prefOpen ? 'Cerrar' : '+ Pref.'}
                              </button>
                            )}
                          </div>

                          {/* Panel preferenciales expandido */}
                          {hasPref && prefOpen && (
                            <PreferencialesPanel
                              catId={cat.id}
                              codigoPartido={p.codigo}
                              actaVotoId={avId}
                              maxPref={cat.maxPref}
                              disabled={enviado}
                              onTotalChange={(total) => updatePrefTotal(cat.id, p.codigo, total)}
                              onSugerirVotos={async (suma) => {
                                const key = `${cat.id}-${p.codigo}`
                                if (!votos[key] || parseInt(votos[key]) === 0) {
                                  setVoto(cat.id, p.codigo, suma)
                                  // También guardar en BD para que persista
                                  const avId = actaVotoIds[key]
                                  if (avId) {
                                    await supabase.from('acta_votos')
                                      .update({ votos: suma })
                                      .eq('id', avId)
                                  }
                                }
                              }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Acciones */}
                  {!enviado && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                      <button onClick={() => guardarBorrador(cat.id)} disabled={guardando[cat.id]}
                        className="btn-secondary flex-1 text-sm py-3">
                        {guardando[cat.id] ? 'Guardando...' : 'Guardar borrador'}
                      </button>
                      <button onClick={() => enviarActa(cat.id)} disabled={enviando[cat.id] || !actas[cat.id]}
                        className="btn-success flex-1 text-sm py-3">
                        {enviando[cat.id] ? 'Enviando...' : 'Enviar acta'}
                      </button>
                    </div>
                  )}

                  {enviado && (
                    <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2 flex-wrap">
                      <CheckCircle size={14} className="text-green-600 shrink-0" />
                      <div className="text-xs text-green-700 flex-1">
                        Acta enviada · {new Date(acta.enviado_at).toLocaleTimeString('es-PE')}
                        {acta.hash_acta && (
                          <span className="ml-2 font-mono text-green-500 text-[10px]">#{acta.hash_acta.slice(0,8)}</span>
                        )}
                      </div>
                      <button
                        onClick={() => reabrirActa(cat.id)}
                        className="text-xs text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 active:scale-95 rounded-lg px-3 py-2 shrink-0 font-medium"
                      >
                        ✏️ Corregir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Footer />
    </div>
  )
}

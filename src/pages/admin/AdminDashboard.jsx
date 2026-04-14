import { useEffect, useState, useRef, useCallback } from 'react'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { PARTIDOS, CATEGORIAS } from '../../lib/data'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  Users, MapPin, BarChart2, Shield, Plus, RefreshCw,
  CheckCircle, Clock, Circle, Search, X, ChevronDown,
  ChevronUp, Trash2, ArrowLeft, Download
} from 'lucide-react'

// Preferenciales
function PreferencialesPanel({ actaVotoId, maxPref, disabled, onTotalChange, onSugerirVotos }) {
  const [prefs, setPrefs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!actaVotoId) return
    supabase.from('acta_votos_pref')
      .select('*').eq('acta_voto_id', actaVotoId).order('numero_candidato')
      .then(({ data }) => {
        if (data) {
          const rows = data.map(r => ({ numero: r.numero_candidato, votos: r.votos, id: r.id }))
          setPrefs(rows)
          onTotalChange?.(rows.reduce((s, r) => s + (parseInt(r.votos) || 0), 0))
        }
      })
  }, [actaVotoId])

  async function guardarPrefs() {
    if (!actaVotoId) return
    setLoading(true)
    try {
      const agrupado = {}
      prefs.forEach(p => {
        if (!p.numero) return
        const num = parseInt(p.numero)
        agrupado[num] = (agrupado[num] || 0) + (parseInt(p.votos) || 0)
      })
      for (const [num, vts] of Object.entries(agrupado)) {
        await supabase.from('acta_votos_pref').upsert({
          acta_voto_id: actaVotoId,
          numero_candidato: parseInt(num),
          votos: vts,
        }, { onConflict: 'acta_voto_id,numero_candidato' })
      }
      const totalPref = Object.values(agrupado).reduce((s, v) => s + v, 0)
      onSugerirVotos?.(totalPref)
      toast.success('Preferenciales guardados')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function addFila() { if (prefs.length < 20) setPrefs(prev => [...prev, { numero: '', votos: '' }]) }
  function removeFila(i) {
    setPrefs(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      onTotalChange?.(next.reduce((s, r) => s + (parseInt(r.votos) || 0), 0))
      return next
    })
  }
  function updateFila(i, campo, val) {
    setPrefs(prev => {
      const next = prev.map((p, idx) => idx === i ? { ...p, [campo]: val } : p)
      if (campo === 'votos') onTotalChange?.(next.reduce((s, r) => s + (parseInt(r.votos) || 0), 0))
      return next
    })
  }

  if (maxPref === 0) return null
  return (
    <div className="mx-3 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700">Votos preferenciales (máx. {maxPref})</span>
        {!disabled && (
          <button onClick={addFila} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus size={12} /> Agregar
          </button>
        )}
      </div>
      {prefs.length === 0 && <p className="text-xs text-blue-400 italic">Sin preferenciales</p>}
      {prefs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-blue-600 w-12 shrink-0">Cand. #</span>
          <input type="number" min="1" placeholder="N°" disabled={disabled}
            className="pref-input" value={p.numero}
            onChange={e => updateFila(i, 'numero', e.target.value)} />
          <span className="text-xs text-blue-600 shrink-0">→</span>
          <input type="number" min="0" placeholder="0" disabled={disabled}
            className="pref-input" value={p.votos}
            onChange={e => updateFila(i, 'votos', e.target.value)} />
          {!disabled && (
            <button onClick={() => removeFila(i)} className="text-red-400 hover:text-red-600 ml-auto">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
      {!disabled && prefs.length > 0 && (
        <button onClick={guardarPrefs} disabled={loading}
          className="w-full text-xs bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar preferenciales'}
        </button>
      )}
    </div>
  )
}

// Modal llenar acta
function ModalActaMesa({ mesa, partidoId, adminId, onClose }) {
  const [partidosDB, setPartidosDB] = useState([])
  const [actas, setActas]           = useState({})
  const [votos, setVotos]           = useState({})
  const [actaVotoIds, setActaVotoIds] = useState({})
  const [prefTotales, setPrefTotales] = useState({})
  const [extras, setExtras] = useState({
    electores: mesa.electores_habiles || 0, nulos: 0, blancos: 0
  })
  const [catAbierta, setCatAbierta] = useState(1)
  const [prefAbierto, setPrefAbierto] = useState(null)
  const [guardando, setGuardando]   = useState({})
  const [enviando, setEnviando]     = useState({})

  function getUUID(codigo) { return partidosDB.find(p => p.codigo === codigo)?.id }
  function totalCat(catId) { return PARTIDOS.reduce((s, p) => s + (parseInt(votos[`${catId}-${p.codigo}`]) || 0), 0) }
  function setVoto(catId, codigo, val) { setVotos(prev => ({ ...prev, [`${catId}-${codigo}`]: val })) }
  function updatePrefTotal(catId, codigo, total) { setPrefTotales(prev => ({ ...prev, [`${catId}-${codigo}`]: total })) }

  useEffect(() => {
    supabase.from('partidos').select('id, codigo').order('nombre')
      .then(({ data }) => { if (data) setPartidosDB(data) })
  }, [])

  useEffect(() => {
    if (!mesa || !partidoId || !partidosDB.length) return
    supabase.from('actas')
      .select('*, votos:acta_votos(id, partido_votado_id, votos)')
      .eq('mesa_id', mesa.id).eq('partido_id', partidoId)
      .then(({ data }) => {
        if (!data) return
        const actasMap = {}, votosMap = {}, avIds = {}
        data.forEach(acta => {
          actasMap[acta.categoria_id] = acta
          setExtras(prev => ({
            electores: acta.total_votantes || prev.electores,
            nulos:     acta.votos_nulos    || prev.nulos,
            blancos:   acta.votos_blancos  || prev.blancos,
          }))
          acta.votos?.forEach(v => {
            const p = partidosDB.find(x => x.id === v.partido_votado_id)
            if (p) {
              votosMap[`${acta.categoria_id}-${p.codigo}`] = v.votos
              avIds[`${acta.categoria_id}-${p.codigo}`] = v.id
            }
          })
        })
        setActas(actasMap); setVotos(votosMap); setActaVotoIds(avIds)
      })
  }, [mesa, partidoId, partidosDB])

  async function getOrCreateActa(catId) {
    const existing = actas[catId]
    if (existing) {
      await supabase.from('actas').update({
        votos_nulos: parseInt(extras.nulos)||0, votos_blancos: parseInt(extras.blancos)||0,
        total_votantes: parseInt(extras.electores)||0, personero_id: adminId,
      }).eq('id', existing.id)
      return existing
    }
    const { data, error } = await supabase.from('actas').upsert({
      mesa_id: mesa.id, partido_id: partidoId, personero_id: adminId,
      categoria_id: catId, estado: 'borrador',
      votos_nulos: parseInt(extras.nulos)||0, votos_blancos: parseInt(extras.blancos)||0,
      total_votantes: parseInt(extras.electores)||0,
    }, { onConflict: 'mesa_id,partido_id,categoria_id' }).select().single()
    if (error) throw error
    setActas(prev => ({ ...prev, [catId]: data }))
    return data
  }

  async function guardarBorrador(catId) {
    if (!partidosDB.length) return
    setGuardando(prev => ({ ...prev, [catId]: true }))
    try {
      const acta = await getOrCreateActa(catId)
      const rows = PARTIDOS.map(p => {
        const uuid = getUUID(p.codigo)
        if (!uuid) return null
        return { acta_id: acta.id, partido_votado_id: uuid, votos: parseInt(votos[`${catId}-${p.codigo}`])||0 }
      }).filter(Boolean)
      const { data: savedVotos, error } = await supabase.from('acta_votos')
        .upsert(rows, { onConflict: 'acta_id,partido_votado_id' }).select('id, partido_votado_id')
      if (error) throw error
      if (savedVotos) {
        const newIds = {}
        savedVotos.forEach(sv => {
          const p = partidosDB.find(x => x.id === sv.partido_votado_id)
          if (p) newIds[`${catId}-${p.codigo}`] = sv.id
        })
        setActaVotoIds(prev => ({ ...prev, ...newIds }))
      }
      toast.success(`Borrador guardado — ${CATEGORIAS.find(c => c.id === catId)?.nombre}`)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setGuardando(prev => ({ ...prev, [catId]: false })) }
  }

  async function reabrirActa(catId) {
    if (!actas[catId]) return
    if (!window.confirm('¿Reabrir esta acta para editar?')) return
    try {
      const { data, error } = await supabase.rpc('reabrir_acta', { p_acta_id: actas[catId].id })
      if (error) throw error
      if (!data.ok) throw new Error(data.error)
      setActas(prev => ({ ...prev, [catId]: { ...prev[catId], estado: 'borrador', hash_acta: null } }))
      toast('Acta reabierta.', { icon: '✏️' })
    } catch (err) { toast.error('Error: ' + err.message) }
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
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setEnviando(prev => ({ ...prev, [catId]: false })) }
  }

  const actasEnviadas = CATEGORIAS.filter(c => actas[c.id]?.estado === 'enviado').length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 bg-gray-800 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-white/70 hover:text-white active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono font-bold text-lg leading-none">Mesa {mesa.numero}</div>
          <div className="text-white/60 text-xs truncate mt-0.5">{mesa.local_nombre} · {mesa.distrito}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-white/60">Actas</div>
          <div className="text-lg font-mono font-bold">{actasEnviadas}/{CATEGORIAS.length}</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-3 py-4 space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
          <p className="text-xs text-amber-700">
            Estás registrando como <strong>administrador del partido</strong>. El acta quedará firmada con tu usuario.
          </p>
        </div>

        <div className="card p-4 grid grid-cols-4 gap-3 text-center">
          {[
            { val: extras.electores, lbl: 'Electores', cls: '' },
            { val: CATEGORIAS.reduce((s,c)=>s+totalCat(c.id),0), lbl: 'Votos', cls: 'text-yellow-600' },
            { val: extras.nulos, lbl: 'Nulos', cls: 'text-red-600' },
            { val: extras.blancos, lbl: 'Blancos', cls: 'text-red-600' },
          ].map(({val,lbl,cls}) => (
            <div key={lbl}>
              <div className={`text-lg font-mono font-semibold ${cls}`}>{val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>

        <div className="card p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos generales</div>
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

        {CATEGORIAS.map(cat => {
          const acta = actas[cat.id]
          const enviado = acta?.estado === 'enviado'
          const abierta = catAbierta === cat.id
          const hasPref = cat.maxPref > 0
          return (
            <div key={cat.id} className="card overflow-hidden">
              <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50"
                onClick={()=>setCatAbierta(abierta?null:cat.id)}>
                <div className="w-2 h-6 rounded-sm shrink-0" style={{background:cat.color}} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{color:cat.color}}>{cat.nombre}</div>
                  <div className="text-xs text-gray-400 font-mono">Total: {totalCat(cat.id)} votos</div>
                </div>
                {enviado ? <CheckCircle size={16} className="text-green-600 shrink-0" />
                  : abierta ? <ChevronUp size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {abierta && (
                <div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <div className="w-8 shrink-0 text-center">#</div>
                    <div className="flex-1">Partido político</div>
                    <div className="w-16 text-center">Votos</div>
                    {hasPref && <div className="w-20 text-center text-blue-400">Pref.</div>}
                  </div>
                  <div className="border-t border-gray-100">
                    {PARTIDOS.map(p => {
                      const prefKey = `${cat.id}-${p.codigo}`
                      const avId = actaVotoIds[prefKey]
                      const prefOpen = prefAbierto === prefKey
                      return (
                        <div key={p.codigo}>
                          <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-50 last:border-0">
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{background:p.color}}>
                              {p.orden}
                            </div>
                            <div className="flex-1 min-w-0 text-xs text-gray-800 leading-tight font-medium">{p.nombre}</div>
                            <div className="flex flex-col items-center">
                              <input type="number" min="0" disabled={enviado} placeholder="0"
                                className="votos-input" value={votos[prefKey]??''} 
                                onChange={e=>setVoto(cat.id,p.codigo,e.target.value)} />
                              {prefTotales[prefKey]>0 && (
                                <span className="text-[9px] text-blue-500 font-mono mt-0.5">Pref: {prefTotales[prefKey]}</span>
                              )}
                            </div>
                            {hasPref && (
                              <button onClick={async()=>{
                                if(prefOpen){setPrefAbierto(null);return}
                                if(!avId) await guardarBorrador(cat.id)
                                setPrefAbierto(prefKey)
                              }} disabled={enviado}
                                className={`w-16 text-[10px] py-2.5 rounded-lg border font-medium transition-all active:scale-95 ${prefOpen?'bg-blue-600 text-white border-blue-600':'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 disabled:opacity-30'}`}>
                                {prefOpen?'Cerrar':'+ Pref.'}
                              </button>
                            )}
                          </div>
                          {hasPref && prefOpen && (
                            <PreferencialesPanel actaVotoId={avId} maxPref={cat.maxPref} disabled={enviado}
                              onTotalChange={total=>updatePrefTotal(cat.id,p.codigo,total)}
                              onSugerirVotos={async suma=>{
                                if(!votos[prefKey]||parseInt(votos[prefKey])===0){
                                  setVoto(cat.id,p.codigo,suma)
                                  const id=actaVotoIds[prefKey]
                                  if(id) await supabase.from('acta_votos').update({votos:suma}).eq('id',id)
                                }
                              }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!enviado && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                      <button onClick={()=>guardarBorrador(cat.id)} disabled={guardando[cat.id]} className="btn-secondary flex-1 text-sm py-3">
                        {guardando[cat.id]?'Guardando...':'Guardar borrador'}
                      </button>
                      <button onClick={()=>enviarActa(cat.id)} disabled={enviando[cat.id]||!actas[cat.id]} className="btn-success flex-1 text-sm py-3">
                        {enviando[cat.id]?'Enviando...':'Enviar acta'}
                      </button>
                    </div>
                  )}
                  {enviado && (
                    <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2 flex-wrap">
                      <CheckCircle size={14} className="text-green-600 shrink-0" />
                      <div className="text-xs text-green-700 flex-1">
                        Acta enviada · {new Date(acta.enviado_at).toLocaleTimeString('es-PE')}
                        {acta.hash_acta && <span className="ml-2 font-mono text-green-500 text-[10px]">#{acta.hash_acta.slice(0,8)}</span>}
                      </div>
                      <button onClick={()=>reabrirActa(cat.id)}
                        className="text-xs text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 active:scale-95 rounded-lg px-3 py-2 shrink-0 font-medium">
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
    </div>
  )
}

// Buscador de mesa
function BuscadorMesa({ onSeleccionar }) {
  const [query, setQuery]   = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const inputRef = useRef(null)

  useEffect(()=>{inputRef.current?.focus()},[])

  async function buscar() {
    const num = query.trim()
    if (!num) return
    setLoading(true); setError(''); setResult(null)
    const { data, error: err } = await supabase.from('mesas').select('*').eq('numero', num).single()
    setLoading(false)
    if (err || !data) {
      setError(`No se encontró la mesa N° ${num}. Verifica el número.`)
    } else {
      setResult(data)
    }
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Search size={15} className="text-gray-500" /> Buscar y registrar mesa
      </div>
      <div className="flex gap-2">
        <input ref={inputRef} type="number" placeholder="Número de mesa — ej: 123456"
          className="form-input flex-1 font-mono text-lg text-center tracking-widest"
          value={query}
          onChange={e=>{setQuery(e.target.value);setError('');setResult(null)}}
          onKeyDown={e=>e.key==='Enter'&&buscar()} />
        <button onClick={buscar} disabled={loading||!query.trim()} className="btn-primary px-5 py-2 flex items-center gap-2 shrink-0">
          {loading?<RefreshCw size={14} className="animate-spin"/>:<Search size={14}/>} Buscar
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <X size={14} className="text-red-500 shrink-0"/>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <MapPin size={20} className="text-green-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-bold text-xl text-green-800">Mesa {result.numero}</div>
              <div className="text-sm font-medium text-gray-800 mt-0.5 truncate">{result.local_nombre}</div>
              <div className="text-xs text-gray-500 mt-0.5">{result.distrito} · {result.provincia} · {result.departamento}</div>
              <div className="text-xs text-gray-500 mt-0.5">{result.electores_habiles?.toLocaleString('es-PE')} electores hábiles</div>
            </div>
          </div>
          <button onClick={()=>onSeleccionar(result)} className="btn-primary w-full py-3 text-sm font-semibold">
            Ingresar y registrar actas de esta mesa →
          </button>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'consolidado', label: 'Consolidado', icon: BarChart2 },
  { id: 'mesas',       label: 'Mesas',       icon: MapPin },
  { id: 'personeros',  label: 'Personeros',  icon: Users },
  { id: 'seguridad',   label: 'Seguridad',   icon: Shield },
]

export default function AdminDashboard() {
  const { partido, perfil, user } = useAuth()
  const [tab, setTab]                 = useState('consolidado')
  const [mesas, setMesas]             = useState([])
  const [avanceMesas, setAvanceMesas] = useState([])
  const [personeros, setPersoneros]   = useState([])
  const [auditLog, setAuditLog]       = useState([])
  const [resultados, setResultados]   = useState([])
  const [actasInfo, setActasInfo]     = useState([])
  const [invEmail, setInvEmail]       = useState('')
  const [invMesa, setInvMesa]         = useState('')
  const [invLoading, setInvLoading]   = useState(false)
  const [linkGenerado, setLinkGenerado] = useState('')
  const [loading, setLoading]         = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)
  const [mesaActiva, setMesaActiva]   = useState(null)
  const [exportLoading, setExportLoading] = useState(false)
  const channelRef = useRef(null)

  useEffect(()=>{
    if(!partido) return
    loadAll()
    suscribirRealtime()
    return ()=>{ channelRef.current?.unsubscribe() }
  },[partido])

  function suscribirRealtime() {
    channelRef.current = supabase.channel('actas-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'actas'},()=>{
        loadResultados(); loadAvanceMesas()
        setUltimaActualizacion(new Date())
        toast('Nueva acta recibida',{icon:'📋',duration:3000})
      }).subscribe()
  }

  async function loadAll() {
    setLoading(true)
    await Promise.allSettled([loadMesas(),loadPersoneros(),loadAudit(),loadResultados(),loadAvanceMesas()])
    setLoading(false)
  }

  async function loadMesas() {
    const {data} = await supabase.from('mesas').select('*').order('numero')
    setMesas(data??[])
  }

  async function loadAvanceMesas() {
    if(!perfil?.partido_id) return
    const {data} = await supabase.from('actas')
      .select('id,mesa_id,categoria_id,estado,enviado_at,mesas(numero,local_nombre,distrito)')
      .eq('partido_id',perfil.partido_id).order('enviado_at',{ascending:false})
    setAvanceMesas(data??[])
  }

  async function loadPersoneros() {
    if(!perfil?.partido_id) return
    const {data} = await supabase.from('perfiles')
      .select('*,mesa:personero_mesa(mesa:mesas(numero,local_nombre))')
      .eq('partido_id',perfil.partido_id).eq('rol','personero').order('nombre')
    setPersoneros(data??[])
  }

  async function loadAudit() {
    if(!perfil?.partido_id) return
    const {data} = await supabase.from('audit_log').select('*')
      .eq('partido_id',perfil.partido_id).order('ts',{ascending:false}).limit(50)
    setAuditLog(data??[])
  }

  async function loadResultados() {
    if(!perfil?.partido_id) return
    const {data:actasData} = await supabase.from('actas')
      .select('id,categoria_id,estado').eq('partido_id',perfil.partido_id)
      .in('estado',['borrador','enviado','validado'])
    if(!actasData?.length){setResultados([]);setActasInfo([]);return}
    setActasInfo(actasData)
    const actaIds   = actasData.map(a=>a.id)
    const catMap    = Object.fromEntries(actasData.map(a=>[a.id,a.categoria_id]))
    const estadoMap = Object.fromEntries(actasData.map(a=>[a.id,a.estado]))
    const {data:votosData} = await supabase.from('acta_votos')
      .select('id,acta_id,votos,partido_votado_id,prefs:acta_votos_pref(numero_candidato,votos)')
      .in('acta_id',actaIds)
    if(!votosData) return
    const {data:partidosData} = await supabase.from('partidos').select('id,codigo,nombre,color_hex,orden')
    const partidoMap = Object.fromEntries((partidosData??[]).map(p=>[p.id,p]))
    const mapa={}
    votosData.forEach(row=>{
      const p=partidoMap[row.partido_votado_id]
      const catId=catMap[row.acta_id]
      if(!p||!catId) return
      const key=`${p.codigo}-${catId}`
      if(!mapa[key]) mapa[key]={partido_votado:p.codigo,nombre_partido:p.nombre,color_hex:p.color_hex,orden:p.orden,categoria_id:catId,total_votos:0,prefMap:{},estado:estadoMap[row.acta_id]??'borrador'}
      mapa[key].total_votos+=parseInt(row.votos)||0
      row.prefs?.forEach(pref=>{const num=pref.numero_candidato;mapa[key].prefMap[num]=(mapa[key].prefMap[num]||0)+(parseInt(pref.votos)||0)})
    })
    setResultados(Object.values(mapa).sort((a,b)=>b.total_votos-a.total_votos))
  }

  async function exportarExcel() {
    if (!perfil?.partido_id) return
    setExportLoading(true)
    toast('Generando Excel...', { icon: '⏳', duration: 2000 })
    try {
      // Mapa de categorías desde constante local (no depende de join)
      const catNombre = { 1:'Presidente y Vicepresidente', 2:'Senadores — Nivel Nacional',
        3:'Senadores — Nivel Regional', 4:'Diputados', 5:'Parlamento Andino' }
      const catCodigo = { 1:'PRES', 2:'SEN_N', 3:'SEN_R', 4:'DIP', 5:'PARL' }

      // 1. TODAS las actas (todos los partidos) — para consolidado real
      const { data: actasRaw } = await supabase
        .from('actas')
        .select(`
          id, estado, hash_acta, enviado_at, created_at, updated_at,
          votos_nulos, votos_blancos, total_votantes, categoria_id,
          partido:partidos(codigo, nombre),
          mesa:mesas(numero, local_nombre, distrito, provincia, departamento, electores_habiles),
          personero:perfiles(nombre, dni)
        `)
        .order('created_at', { ascending: true })

      const actaIds = (actasRaw ?? []).map(a => a.id)

      // 2. Votos con ID propio
      const { data: votosConId } = actaIds.length
        ? await supabase.from('acta_votos')
            .select('id, acta_id, votos, partido_votado_id, partido_votado:partidos(codigo, nombre, orden)')
            .in('acta_id', actaIds)
        : { data: [] }

      // 3. Preferenciales
      const { data: prefsConId } = (votosConId ?? []).length
        ? await supabase.from('acta_votos_pref')
            .select('acta_voto_id, numero_candidato, votos')
            .in('acta_voto_id', (votosConId ?? []).map(v => v.id))
        : { data: [] }

      const wb = XLSX.utils.book_new()
      const codigo_partido = partido?.codigo ?? 'PARTIDO'
      const nombre_partido = partido?.nombre ?? 'Partido'
      const actaMap = Object.fromEntries((actasRaw ?? []).map(a => [a.id, a]))
      const votoMap = Object.fromEntries((votosConId ?? []).map(v => [v.id, v]))
      const nMesa = m => parseInt(m) || 0

      // ── HOJA 1: ACTAS — 1 fila = 1 acta, todos los partidos ──────────────
      const h1 = [['partido_registro','codigo_partido','mesa_numero','local_electoral',
        'distrito','provincia','departamento','electores_habiles',
        'categoria_orden','categoria_codigo','categoria_nombre',
        'estado_acta','total_votantes','votos_nulos','votos_blancos',
        'votos_validos','pct_participacion','responsable','dni_responsable',
        'fecha_envio','hash_acta']]
      ;(actasRaw ?? [])
        .sort((a,b) => {
          const diff = nMesa(a.mesa?.numero) - nMesa(b.mesa?.numero)
          return diff !== 0 ? diff : (a.categoria_id??0) - (b.categoria_id??0)
        })
        .forEach(a => {
          const validos = Math.max(0, (a.total_votantes??0) - (a.votos_nulos??0) - (a.votos_blancos??0))
          const pct = a.mesa?.electores_habiles > 0
            ? parseFloat(((a.total_votantes??0) / a.mesa.electores_habiles * 100).toFixed(2)) : 0
          const catId = a.categoria_id
          h1.push([
            a.partido?.nombre ?? '',
            a.partido?.codigo ?? '',
            a.mesa?.numero ?? '',
            a.mesa?.local_nombre ?? '',
            a.mesa?.distrito ?? '',
            a.mesa?.provincia ?? '',
            a.mesa?.departamento ?? '',
            a.mesa?.electores_habiles ?? 0,
            catId ?? '',
            catCodigo[catId] ?? '',
            catNombre[catId] ?? '',
            a.estado ?? '',
            a.total_votantes ?? 0,
            a.votos_nulos ?? 0,
            a.votos_blancos ?? 0,
            validos,
            pct,
            a.personero?.nombre ?? 'Admin',
            a.personero?.dni ?? '',
            a.enviado_at ? new Date(a.enviado_at).toLocaleString('es-PE') : '',
            a.hash_acta ? a.hash_acta.slice(0,16) : '',
          ])
        })
      const ws1 = XLSX.utils.aoa_to_sheet(h1)
      ws1['!cols'] = [
        {wch:30},{wch:8},{wch:35},{wch:18},{wch:18},{wch:16},
        {wch:10},{wch:8},{wch:10},{wch:32},
        {wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},
        {wch:28},{wch:12},{wch:20},{wch:18}
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Actas')

      // ── HOJA 2: VOTOS_PARTIDO — 1 fila = 1 partido votado x acta ───────────
      const h2 = [['partido_registro','mesa_numero','local_electoral','distrito','provincia',
        'departamento','categoria_orden','categoria_codigo','categoria_nombre','estado_acta',
        'orden_partido_votado','codigo_partido_votado','nombre_partido_votado','votos']]
      ;(votosConId ?? [])
        .sort((a,b) => {
          const actaA = actaMap[a.acta_id], actaB = actaMap[b.acta_id]
          const mesaDiff = nMesa(actaA?.mesa?.numero) - nMesa(actaB?.mesa?.numero)
          if (mesaDiff !== 0) return mesaDiff
          const catDiff = (actaA?.categoria_id??0) - (actaB?.categoria_id??0)
          return catDiff !== 0 ? catDiff : (a.partido_votado?.orden??99) - (b.partido_votado?.orden??99)
        })
        .forEach(v => {
          const acta = actaMap[v.acta_id]
          if (!acta) return
          const catId = acta.categoria_id
          h2.push([
            acta.partido?.nombre ?? '',
            acta.mesa?.numero ?? '',
            acta.mesa?.local_nombre ?? '',
            acta.mesa?.distrito ?? '',
            acta.mesa?.provincia ?? '',
            acta.mesa?.departamento ?? '',
            catId ?? '',
            catCodigo[catId] ?? '',
            catNombre[catId] ?? '',
            acta.estado ?? '',
            v.partido_votado?.orden ?? '',
            v.partido_votado?.codigo ?? '',
            v.partido_votado?.nombre ?? '',
            parseInt(v.votos) || 0,
          ])
        })
      const ws2 = XLSX.utils.aoa_to_sheet(h2)
      ws2['!cols'] = [
        {wch:30},{wch:8},{wch:35},{wch:18},{wch:18},{wch:16},
        {wch:10},{wch:32},{wch:12},
        {wch:8},{wch:8},{wch:40},{wch:8}
      ]
      XLSX.utils.book_append_sheet(wb, ws2, 'Votos_Partido')

      // ── HOJA 3: PREFERENCIALES — 1 fila = 1 candidato x acta ─────────────
      const h3 = [['partido_registro','mesa_numero','local_electoral','distrito','provincia',
        'departamento','categoria_orden','categoria_codigo','categoria_nombre','estado_acta',
        'orden_partido_votado','codigo_partido_votado','nombre_partido_votado',
        'numero_candidato','votos_preferenciales']]
      ;(prefsConId ?? [])
        .sort((a,b) => {
          const vA = votoMap[a.acta_voto_id], vB = votoMap[b.acta_voto_id]
          const actaA = actaMap[vA?.acta_id], actaB = actaMap[vB?.acta_id]
          const mesaDiff = nMesa(actaA?.mesa?.numero) - nMesa(actaB?.mesa?.numero)
          if (mesaDiff !== 0) return mesaDiff
          const catDiff = (actaA?.categoria_id??0) - (actaB?.categoria_id??0)
          return catDiff !== 0 ? catDiff : a.numero_candidato - b.numero_candidato
        })
        .forEach(pref => {
          const voto = votoMap[pref.acta_voto_id]
          if (!voto) return
          const acta = actaMap[voto.acta_id]
          if (!acta) return
          const catId = acta.categoria_id
          h3.push([
            acta.partido?.nombre ?? '',
            acta.mesa?.numero ?? '',
            acta.mesa?.local_nombre ?? '',
            acta.mesa?.distrito ?? '',
            acta.mesa?.provincia ?? '',
            acta.mesa?.departamento ?? '',
            catId ?? '',
            catCodigo[catId] ?? '',
            catNombre[catId] ?? '',
            acta.estado ?? '',
            voto.partido_votado?.orden ?? '',
            voto.partido_votado?.codigo ?? '',
            voto.partido_votado?.nombre ?? '',
            pref.numero_candidato,
            parseInt(pref.votos) || 0,
          ])
        })
      if (h3.length > 1) {
        const ws3 = XLSX.utils.aoa_to_sheet(h3)
        ws3['!cols'] = [
          {wch:30},{wch:8},{wch:35},{wch:18},{wch:18},{wch:16},
          {wch:10},{wch:32},{wch:12},
          {wch:8},{wch:8},{wch:40},{wch:14},{wch:16}
        ]
        XLSX.utils.book_append_sheet(wb, ws3, 'Preferenciales')
      }

      // ── HOJA 4: AVANCE_MESAS — 1 fila = 1 mesa x partido ────────────────
      const mesasConActas = {}
      ;(actasRaw ?? []).forEach(a => {
        const partidoCod = a.partido?.codigo ?? 'NOPART'
        const key = `${a.mesa?.numero}__${partidoCod}`
        if (!key) return
        if (!mesasConActas[key]) mesasConActas[key] = {
          mesa: a.mesa,
          partido_nombre: a.partido?.nombre ?? '',
          partido_codigo: a.partido?.codigo ?? '',
          personero: a.personero?.nombre ?? 'Admin',
          cats: {}
        }
        const catId = a.categoria_id
        const cod = catCodigo[catId] ?? `cat${catId}`
        mesasConActas[key].cats[cod] = a.estado
      })
      const h4 = [['partido_registro','codigo_partido','mesa_numero','local_electoral',
        'distrito','provincia','departamento','electores_habiles','responsable',
        'estado_PRES','estado_SEN_N','estado_SEN_R','estado_DIP','estado_PARL',
        'actas_enviadas','actas_total','pct_completado']]
      const cats_orden = ['PRES','SEN_N','SEN_R','DIP','PARL']
      Object.values(mesasConActas)
        .sort((a,b) => {
          const diff = nMesa(a.mesa?.numero) - nMesa(b.mesa?.numero)
          return diff !== 0 ? diff : (a.partido_codigo??'').localeCompare(b.partido_codigo??'')
        })
        .forEach(m => {
          const enviadas = cats_orden.filter(c => m.cats[c] === 'enviado').length
          h4.push([
            m.partido_nombre,
            m.partido_codigo,
            m.mesa?.numero ?? '',
            m.mesa?.local_nombre ?? '',
            m.mesa?.distrito ?? '',
            m.mesa?.provincia ?? '',
            m.mesa?.departamento ?? '',
            m.mesa?.electores_habiles ?? 0,
            m.personero,
            m.cats['PRES'] ?? 'pendiente',
            m.cats['SEN_N'] ?? 'pendiente',
            m.cats['SEN_R'] ?? 'pendiente',
            m.cats['DIP'] ?? 'pendiente',
            m.cats['PARL'] ?? 'pendiente',
            enviadas,
            5,
            parseFloat((enviadas / 5 * 100).toFixed(1)),
          ])
        })
      const ws4 = XLSX.utils.aoa_to_sheet(h4)
      ws4['!cols'] = [
        {wch:30},{wch:8},{wch:35},{wch:18},{wch:18},{wch:16},
        {wch:10},{wch:28},
        {wch:12},{wch:12},{wch:12},{wch:12},{wch:12},
        {wch:12},{wch:10},{wch:12}
      ]
      XLSX.utils.book_append_sheet(wb, ws4, 'Avance_Mesas')

      // ── HOJA 5: PERSONEROS ────────────────────────────────────────────────
      const h5 = [['partido','nombre','dni','telefono',
        'mesa_numero','local_electoral','distrito','departamento','estado']]
      personeros.forEach(p => {
        const mesa = p.mesa?.[0]?.mesa
        h5.push([
          nombre_partido,
          p.nombre ?? '',
          p.dni ?? '',
          p.telefono ?? '',
          mesa?.numero ?? '',
          mesa?.local_nombre ?? '',
          mesa?.distrito ?? '',
          mesa?.departamento ?? '',
          p.activo ? 'activo' : 'inactivo',
        ])
      })
      const ws5 = XLSX.utils.aoa_to_sheet(h5)
      ws5['!cols'] = [
        {wch:30},{wch:28},{wch:12},{wch:14},
        {wch:8},{wch:35},{wch:18},{wch:16},{wch:10}
      ]
      XLSX.utils.book_append_sheet(wb, ws5, 'Personeros')

      // Descargar
      const fecha = new Date().toISOString().slice(0,10)
      XLSX.writeFile(wb, `personero-pe_${codigo_partido}_${fecha}.xlsx`)
      toast.success(`Excel listo — ${(actasRaw??[]).length} actas · ${(votosConId??[]).length} votos · ${(prefsConId??[]).length} preferenciales`)
    } catch (err) {
      toast.error('Error al exportar: ' + err.message)
      console.error(err)
    } finally {
      setExportLoading(false)
    }
  }

    async function enviarInvitacion() {
    if(!invEmail||!invMesa){toast.error('Completa email y mesa');return}
    const mesaObj=mesas.find(m=>m.id===invMesa)
    if(!mesaObj){toast.error('Mesa no encontrada');return}
    setInvLoading(true)
    try {
      const {data,error}=await supabase.from('invitaciones')
        .insert({partido_id:perfil.partido_id,mesa_id:mesaObj.id,email:invEmail})
        .select('token').single()
      if(error) throw error
      const link=`${window.location.origin}/registro?token=${data.token}`
      setLinkGenerado(link)
      await navigator.clipboard.writeText(link).catch(()=>{})
      toast.success('¡Link generado!')
      setInvEmail(''); setInvMesa('')
    } catch(err){ toast.error('Error: '+err.message) }
    finally{ setInvLoading(false) }
  }

  const totalMesas     = mesas.length
  const mesasEnviadas  = [...new Set(avanceMesas.filter(a=>a.estado==='enviado').map(a=>a.mesa_id))].length
  const mesasEnProceso = [...new Set(avanceMesas.filter(a=>a.estado==='borrador').map(a=>a.mesa_id))].length
  const totalVotos     = resultados.reduce((s,r)=>s+r.total_votos,0)
  const pctAvance      = totalMesas>0?Math.round(mesasEnviadas/totalMesas*100):0

  const avancePorMesa={}
  avanceMesas.forEach(a=>{
    if(!avancePorMesa[a.mesa_id]) avancePorMesa[a.mesa_id]={mesa:a.mesas,categorias:{},ultimoEnvio:null}
    avancePorMesa[a.mesa_id].categorias[a.categoria_id]=a.estado
    if(a.estado==='enviado'&&a.enviado_at){
      const t=new Date(a.enviado_at)
      if(!avancePorMesa[a.mesa_id].ultimoEnvio||t>avancePorMesa[a.mesa_id].ultimoEnvio) avancePorMesa[a.mesa_id].ultimoEnvio=t
    }
  })

  if(mesaActiva) return (
    <ModalActaMesa mesa={mesaActiva} partidoId={perfil?.partido_id} adminId={user?.id}
      onClose={()=>{setMesaActiva(null);loadAvanceMesas();loadResultados()}} />
  )

  return (
    <div className="min-h-screen">
      <Header/>
      <div className="max-w-2xl mx-auto px-3 py-4 space-y-3">

        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Avance general</span>
            <div className="flex items-center gap-2">
              {ultimaActualizacion&&<span className="text-[10px] text-gray-400">Actualizado {ultimaActualizacion.toLocaleTimeString('es-PE')}</span>}
              <button onClick={loadAll} className="text-gray-400 hover:text-gray-600 active:scale-90 transition-all"><RefreshCw size={14}/></button>
              <button
                onClick={exportarExcel}
                disabled={exportLoading}
                className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium active:scale-95 transition-all">
                {exportLoading ? <RefreshCw size={12} className="animate-spin"/> : <Download size={12}/>}
                {exportLoading ? 'Exportando...' : 'Excel'}
              </button>
            </div>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-700"
              style={{width:`${pctAvance}%`,background:pctAvance===100?'#1A7A3E':'#C8102E'}}/>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              {val:`${pctAvance}%`,lbl:'Avance',cls:'text-rojo font-bold'},
              {val:mesasEnviadas,lbl:'✓ Enviadas',cls:'text-verde font-semibold'},
              {val:mesasEnProceso,lbl:'● En proceso',cls:'text-yellow-600 font-semibold'},
              {val:totalMesas-mesasEnviadas-mesasEnProceso,lbl:'○ Sin iniciar',cls:'text-gray-400'},
            ].map(({val,lbl,cls})=>(
              <div key={lbl} className="bg-gray-50 rounded-lg p-2">
                <div className={`text-lg font-mono ${cls}`}>{val}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{lbl}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-xs text-gray-500 font-mono">{totalVotos.toLocaleString('es-PE')} votos procesados</div>
        </div>

        <BuscadorMesa onSeleccionar={setMesaActiva}/>

        <div className="card flex overflow-hidden">
          {TABS.map(t=>{
            const Icon=t.icon
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium border-r border-gray-100 last:border-0 transition-colors active:scale-95 ${tab===t.id?'bg-gray-800 text-white':'text-gray-500 hover:bg-gray-50'}`}>
                <Icon size={13}/><span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {loading&&<div className="card p-8 text-center text-gray-400 text-sm animate-pulse">Cargando...</div>}

        {!loading&&(<>
          {tab==='consolidado'&&(
            <div className="space-y-3">
              {resultados.length===0?(
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm font-medium text-gray-600">Sin actas aún</p>
                  <p className="text-xs text-gray-400 mt-1">Los resultados aparecerán cuando se registren actas.</p>
                </div>
              ):(
                CATEGORIAS.map(cat=>{
                  const res=resultados.filter(r=>parseInt(r.categoria_id)===cat.id&&r.total_votos>0).sort((a,b)=>b.total_votos-a.total_votos)
                  const tieneActa=actasInfo.some(a=>parseInt(a.categoria_id)===cat.id)
                  if(!tieneActa&&!res.length) return null
                  const maxV=res[0]?.total_votos||1
                  const totalCat=res.reduce((s,r)=>s+r.total_votos,0)
                  const estadoCat=actasInfo.find(a=>parseInt(a.categoria_id)===cat.id)?.estado??'sin_iniciar'
                  return (
                    <div key={cat.id} className="card overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                        <div className="w-2 h-5 rounded-sm shrink-0" style={{background:cat.color}}/>
                        <span className="text-sm font-semibold flex-1" style={{color:cat.color}}>{cat.nombre}</span>
                        <span className="text-xs text-gray-400 font-mono mr-2">{totalCat} votos</span>
                        {estadoCat==='enviado'&&<span className="badge-ok">✓ Enviado</span>}
                        {estadoCat==='borrador'&&<span className="badge-pending">● Progreso</span>}
                        {estadoCat==='sin_iniciar'&&<span className="badge-error">Sin iniciar</span>}
                      </div>
                      {res.length===0?(
                        <div className="px-4 py-3 text-xs text-gray-400 italic">Sin votos registrados aún</div>
                      ):(
                        <div className="p-3 space-y-2">
                          {res.map((r,i)=>{
                            const pct=Math.round(r.total_votos/maxV*100)
                            const pctTotal=totalVotos>0?((r.total_votos/totalVotos)*100).toFixed(1):0
                            const topPrefs=Object.entries(r.prefMap??{}).sort((a,b)=>b[1]-a[1]).slice(0,4)
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-700 w-36 shrink-0 truncate font-medium">{r.nombre_partido}</div>
                                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                                    <div className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
                                      style={{width:`${Math.max(pct,2)}%`,background:r.color_hex}}>
                                      <span className="text-[10px] text-white font-mono font-bold">{r.total_votos}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs font-mono text-gray-500 w-10 text-right shrink-0">{pctTotal}%</div>
                                </div>
                                {topPrefs.length>0&&(
                                  <div className="flex items-center gap-1.5 pl-36 flex-wrap">
                                    <span className="text-[10px] text-gray-400">Pref:</span>
                                    {topPrefs.map(([num,cnt])=>(
                                      <span key={num} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 font-mono">#{num}: {cnt}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {tab==='mesas'&&(
            <div className="space-y-3">
              <div className="text-xs text-gray-500 px-1">
                {totalMesas.toLocaleString('es-PE')} mesas · {mesasEnviadas} completas · {mesasEnProceso} en proceso
              </div>
              {Object.entries(avancePorMesa).sort((a,b)=>(a[1].mesa?.numero??''). localeCompare(b[1].mesa?.numero??'')).map(([mesaId,info])=>{
                const cats=info.categorias
                const enviadas=CATEGORIAS.filter(c=>cats[c.id]==='enviado').length
                const enProceso=CATEGORIAS.filter(c=>cats[c.id]==='borrador').length
                const estadoGlobal=enviadas===CATEGORIAS.length?'completo':enProceso>0||enviadas>0?'progreso':'pendiente'
                return (
                  <div key={mesaId} className="card p-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {estadoGlobal==='completo'&&<CheckCircle size={20} className="text-verde"/>}
                        {estadoGlobal==='progreso'&&<Clock size={20} className="text-yellow-500"/>}
                        {estadoGlobal==='pendiente'&&<Circle size={20} className="text-gray-300"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-sm">Mesa {info.mesa?.numero}</span>
                            <span className="text-xs text-gray-500 ml-2 truncate">{info.mesa?.local_nombre}</span>
                          </div>
                          <span className="text-xs font-mono text-gray-500 shrink-0">{enviadas}/{CATEGORIAS.length}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {CATEGORIAS.map(cat=>{
                            const est=cats[cat.id]
                            return <div key={cat.id} className="flex-1 h-2 rounded-full overflow-hidden"
                              style={{background:est==='enviado'?cat.color:est==='borrador'?'#FCD34D':'#E8E6E1'}} title={cat.nombre}/>
                          })}
                        </div>
                        {info.ultimoEnvio&&<span className="text-[10px] text-gray-400 block mt-1">Último: {info.ultimoEnvio.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.keys(avancePorMesa).length===0&&<div className="card p-8 text-center text-gray-400 text-sm">Sin actas registradas aún.</div>}
            </div>
          )}

          {tab==='personeros'&&(
            <div className="space-y-3">
              <div className="card p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2"><Plus size={14}/>Invitar personero</div>
                <div>
                  <label className="form-label">Email del personero</label>
                  <input type="email" className="form-input" placeholder="personero@partido.pe" value={invEmail} onChange={e=>setInvEmail(e.target.value)}/>
                </div>
                <div>
                  <label className="form-label">Mesa asignada</label>
                  <select className="form-input" value={invMesa} onChange={e=>setInvMesa(e.target.value)}>
                    <option value="">Selecciona una mesa</option>
                    {mesas.map(m=><option key={m.id} value={m.id}>Mesa {m.numero} — {m.local_nombre}</option>)}
                  </select>
                </div>
                <button onClick={enviarInvitacion} disabled={invLoading} className="btn-primary w-full">
                  {invLoading?'Generando...':'Generar link de invitación'}
                </button>
                <p className="text-xs text-gray-400">El link se copia automáticamente. Expira en 48h.</p>
                {linkGenerado&&(
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-700">✓ Link generado:</p>
                    <div className="flex items-center gap-2">
                      <input type="text" readOnly value={linkGenerado} className="form-input text-xs font-mono bg-white flex-1 py-2" onClick={e=>e.target.select()}/>
                      <button onClick={()=>{navigator.clipboard.writeText(linkGenerado);toast.success('¡Copiado!')}} className="btn-success text-xs px-3 py-2 shrink-0 whitespace-nowrap">Copiar</button>
                    </div>
                    <p className="text-[10px] text-green-600">⏰ Expira en 48 horas · Solo funciona una vez</p>
                  </div>
                )}
              </div>
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><span className="text-sm font-semibold">Personeros ({personeros.length})</span></div>
                {personeros.length===0?(
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">Sin personeros registrados.</div>
                ):personeros.map(p=>{
                  const initials=p.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
                  const mesa=p.mesa?.[0]?.mesa
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold shrink-0">{initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.nombre}</div>
                        <div className="text-xs text-gray-400 truncate">{mesa?`Mesa ${mesa.numero} — ${mesa.local_nombre}`:'Sin mesa'}</div>
                      </div>
                      <span className={p.activo?'badge-ok':'badge-error'}>{p.activo?'Activo':'Inactivo'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab==='seguridad'&&(
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><span className="text-sm font-semibold">Log de auditoría</span></div>
              {auditLog.length===0?(
                <div className="px-4 py-8 text-center text-gray-400 text-sm">Sin eventos.</div>
              ):auditLog.map(log=>(
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="shrink-0">{log.resultado==='ok'?<CheckCircle size={14} className="text-green-500"/>:<Circle size={14} className="text-red-400"/>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700">{log.accion}</div>
                    <div className="text-[10px] text-gray-400 truncate">{log.usuario_email}</div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-400 shrink-0">{new Date(log.ts).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
      <Footer/>
    </div>
  )
}

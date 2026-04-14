import { useEffect, useState } from 'react'
import { Header } from '../../components/layout/Header'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Footer } from '../../components/layout/Footer'
import { RefreshCw, Plus } from 'lucide-react'

const TABS = ['Partidos', 'Mesas', 'Auditoria Global']

export default function SuperAdminPanel() {
  const [tab, setTab]           = useState(0)
  const [partidos, setPartidos] = useState([])
  const [mesas, setMesas]       = useState([])
  const [audit, setAudit]       = useState([])
  const [loading, setLoading]   = useState(true)
  // Formulario nueva mesa
  const [form, setForm] = useState({ numero: '', local_nombre: '', distrito: '', provincia: '', departamento: '', electores_habiles: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [p, m, a] = await Promise.all([
      supabase.from('partidos').select('*').order('nombre'),
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('audit_log').select('*, partido:partidos(nombre)').order('ts', { ascending: false }).limit(100),
    ])
    if (p.data) setPartidos(p.data)
    if (m.data) setMesas(m.data)
    if (a.data) setAudit(a.data)
    setLoading(false)
  }

  async function crearMesa() {
    if (!form.numero || !form.local_nombre || !form.distrito) {
      toast.error('Completa los campos requeridos'); return
    }
    const { error } = await supabase.from('mesas').insert({
      ...form,
      electores_habiles: parseInt(form.electores_habiles) || 0,
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Mesa ${form.numero} creada`)
    setForm({ numero: '', local_nombre: '', distrito: '', provincia: '', departamento: '', electores_habiles: '' })
    loadAll()
  }

  async function togglePartido(id, activo) {
    await supabase.from('partidos').update({ activo: !activo }).eq('id', id)
    loadAll()
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Partidos activos', value: partidos.filter(p => p.activo).length, color: 'text-rojo' },
            { label: 'Mesas registradas', value: mesas.length, color: 'text-azul' },
            { label: 'Eventos de auditoría', value: audit.length, color: 'text-verde' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-3">
              <div className={`text-2xl font-mono font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="card flex overflow-hidden">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 py-2.5 text-xs font-medium border-r border-gray-100 last:border-0 transition-colors ${
                tab === i ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
          <button onClick={loadAll} className="px-3 text-gray-400 hover:text-gray-600 border-l border-gray-100">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* PARTIDOS */}
        {tab === 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold">
              Partidos políticos EG 2026 ({partidos.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Código</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Nombre</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Color</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {partidos.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 font-mono font-medium">{p.codigo}</td>
                      <td className="px-4 py-2 text-gray-700">{p.nombre}</td>
                      <td className="px-4 py-2">
                        <div className="w-5 h-5 rounded" style={{ background: p.color_hex }} />
                      </td>
                      <td className="px-4 py-2">
                        <span className={p.activo ? 'badge-ok' : 'badge-error'}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => togglePartido(p.id, p.activo)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MESAS */}
        {tab === 1 && (
          <div className="space-y-4">
            {/* Form nueva mesa */}
            <div className="card p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2"><Plus size={14} /> Nueva mesa electoral</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: 'numero',          label: 'Número *',         placeholder: '001' },
                  { key: 'local_nombre',    label: 'Local electoral *', placeholder: 'I.E. San Martín' },
                  { key: 'distrito',        label: 'Distrito *',        placeholder: 'Miraflores' },
                  { key: 'provincia',       label: 'Provincia',         placeholder: 'Lima' },
                  { key: 'departamento',    label: 'Departamento',      placeholder: 'Lima' },
                  { key: 'electores_habiles', label: 'Electores hábiles', placeholder: '300', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="form-label">{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      className="form-input"
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <button onClick={crearMesa} className="btn-primary text-sm">Crear mesa</button>
            </div>

            {/* Lista mesas */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold">
                Mesas registradas ({mesas.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Mesa', 'Local', 'Distrito', 'Prov.', 'Dep.', 'Electores', 'Estado'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mesas.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-mono font-medium">{m.numero}</td>
                        <td className="px-4 py-2 truncate max-w-[140px]">{m.local_nombre}</td>
                        <td className="px-4 py-2">{m.distrito}</td>
                        <td className="px-4 py-2">{m.provincia}</td>
                        <td className="px-4 py-2">{m.departamento}</td>
                        <td className="px-4 py-2 font-mono">{m.electores_habiles}</td>
                        <td className="px-4 py-2">
                          <span className={m.activa ? 'badge-ok' : 'badge-error'}>
                            {m.activa ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AUDITORÍA GLOBAL */}
        {tab === 2 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold">
              Auditoría global del sistema (últimos 100 eventos)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Hora', 'Usuario', 'Partido', 'Acción', 'IP', 'Estado'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map(log => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 font-mono text-gray-500 whitespace-nowrap">
                        {new Date(log.ts).toLocaleTimeString('es-PE')}
                      </td>
                      <td className="px-4 py-2 truncate max-w-[120px]">{log.usuario_email}</td>
                      <td className="px-4 py-2 truncate max-w-[100px]">{log.partido?.nombre ?? '—'}</td>
                      <td className="px-4 py-2">{log.accion}</td>
                      <td className="px-4 py-2 font-mono text-gray-400">{log.ip ?? '—'}</td>
                      <td className="px-4 py-2">
                        {log.resultado === 'ok'       && <span className="badge-ok">OK</span>}
                        {log.resultado === 'error'    && <span className="badge-error">Error</span>}
                        {log.resultado === 'bloqueado' && <span className="badge-error">Bloqueado</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    <Footer />
    </div>
  )
}

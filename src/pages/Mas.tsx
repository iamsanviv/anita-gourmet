import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useCatalogo, useToast } from '../lib/store'
import { pesos } from '../lib/format'
import type { Personal, Producto } from '../lib/types'
import { CrearClave } from './Login'

type Vista = null | 'productos' | 'empleados' | 'clave'

export default function Mas() {
  const { staff } = useAuth()
  const [vista, setVista] = useState<Vista>(null)

  if (vista === 'clave') return <CrearClave onDone={() => setVista(null)} />
  if (vista === 'productos') return <Productos volver={() => setVista(null)} />
  if (vista === 'empleados') return <Empleados volver={() => setVista(null)} />

  const items: [string, string, string, Vista | 'salir' | 'pronto'][] = [
    ['🏷️', 'Productos y precios', 'Disponibilidad de hoy y precios', 'productos'],
    ...(staff?.role === 'admin' ? [['👩‍🍳', 'Empleados', 'Usuarios con acceso a la app', 'empleados'] as [string, string, string, Vista]] : []),
    ['🔒', 'Cambiar contraseña', staff?.full_name ?? '', 'clave'],
    ['🍛', 'Menú del día', 'Fase 2', 'pronto'],
    ['📊', 'Reportes y cierre de caja', 'Fase 2', 'pronto'],
    ['🚚', 'Proveedores y compras', 'Fase 2', 'pronto'],
    ['🖨️', 'Tickets de cocina', 'Más adelante', 'pronto'],
    ['🚪', 'Cerrar sesión', '', 'salir'],
  ]

  return (
    <div className="screen">
      <div className="top"><h1>Más</h1></div>
      <div className="box">
        {items.map(([ic, t, s, v]) => (
          <button
            key={t}
            className="row-i"
            disabled={v === 'pronto'}
            style={v === 'pronto' ? { opacity: 0.55 } : undefined}
            onClick={() => (v === 'salir' ? supabase.auth.signOut() : v !== 'pronto' && setVista(v))}
          >
            <div className="art">{ic}</div>
            <div className="tx"><b>{t}</b>{s && <small>{s}</small>}</div>
            {v !== 'pronto' && <span className="muted">›</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Productos({ volver }: { volver: () => void }) {
  const { categorias, productos, recargar } = useCatalogo()
  const toast = useToast()
  const [editando, setEditando] = useState<Producto | null>(null)
  const [precio, setPrecio] = useState('')

  async function disponible(p: Producto) {
    const { error } = await supabase.from('products').update({ available_today: !p.available_today }).eq('id', p.id)
    if (error) return toast(error.message, true)
    recargar()
  }

  async function guardarPrecio() {
    const n = Number(precio)
    if (!editando || !n) return
    const { error } = await supabase.from('products').update({ price: n }).eq('id', editando.id)
    if (error) return toast(error.message, true)
    toast(`${editando.name}: ${pesos(n)}`)
    setEditando(null)
    recargar()
  }

  async function reactivarTodo() {
    const { error } = await supabase.from('products').update({ available_today: true }).eq('available_today', false)
    if (error) return toast(error.message, true)
    toast('Todos los productos quedaron disponibles')
    recargar()
  }

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={volver} aria-label="Volver">‹</button>
        <h1>Productos</h1>
        <button className="mini" onClick={reactivarTodo}>Todo disponible</button>
      </div>
      {categorias.map((c) => (
        <div key={c.id}>
          <div className="lbl">{c.icon} {c.name}</div>
          <div className="box">
            {productos.filter((p) => p.category_id === c.id).map((p) => (
              <div key={p.id} className="row-i">
                <div className="art">{p.icon}</div>
                <button className="tx" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => { setEditando(p); setPrecio(String(p.price)) }}>
                  <b>{p.name}</b>
                  <small>{pesos(p.price)} · {p.available_today ? 'Disponible' : 'Agotado hoy'}</small>
                </button>
                <button className={'tog' + (p.available_today ? ' on' : '')} aria-label={`Disponible hoy: ${p.name}`} aria-pressed={p.available_today} onClick={() => disponible(p)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {editando && (
        <>
          <div className="dim" onClick={() => setEditando(null)} />
          <div className="sheet" role="dialog" aria-label="Cambiar precio">
            <div className="grab" />
            <div className="sh-top"><div className="art">{editando.icon}</div><div><b>{editando.name}</b><small>Precio actual {pesos(editando.price)}</small></div></div>
            <label className="field big">
              <span>NUEVO PRECIO</span>
              <input id="precio" inputMode="numeric" autoFocus value={precio ? pesos(Number(precio)) : ''} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button className="btn" disabled={!Number(precio)} onClick={guardarPrecio}>Guardar precio</button>
          </div>
        </>
      )}
    </div>
  )
}

function Empleados({ volver }: { volver: () => void }) {
  const toast = useToast()
  const [lista, setLista] = useState<Personal[]>([])
  const [f, setF] = useState({ full_name: '', email: '', password: '' })
  const [enviando, setEnviando] = useState(false)

  const cargar = () => supabase.from('staff').select('*').order('full_name').then(({ data }) => setLista((data as Personal[]) ?? []))
  useEffect(() => { cargar() }, [])

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (f.password.length < 8) return toast('La contraseña temporal debe tener al menos 8 caracteres', true)
    setEnviando(true)
    const { data, error } = await supabase.functions.invoke('crear-empleado', { body: f })
    setEnviando(false)
    if (error || data?.error) return toast(data?.error ?? 'No se pudo crear el usuario', true)
    toast(`${f.full_name} ya puede entrar con su correo`)
    setF({ full_name: '', email: '', password: '' })
    cargar()
  }

  async function activar(p: Personal) {
    const { error } = await supabase.from('staff').update({ active: !p.active }).eq('id', p.id)
    if (error) return toast(error.message, true)
    cargar()
  }

  return (
    <div className="screen">
      <div className="top"><button className="round" onClick={volver} aria-label="Volver">‹</button><h1>Empleados</h1></div>
      <div className="box">
        {lista.map((p) => (
          <div key={p.id} className="row-i">
            <div className="av">{p.full_name.slice(0, 1)}</div>
            <div className="tx"><b>{p.full_name}</b><small>{p.role === 'admin' ? 'Administradora' : 'Empleado'} · {p.active ? 'Activo' : 'Sin acceso'}</small></div>
            {p.role !== 'admin' && <button className={'tog' + (p.active ? ' on' : '')} aria-label={`Acceso de ${p.full_name}`} onClick={() => activar(p)} />}
          </div>
        ))}
      </div>
      <div className="lbl">Agregar empleado</div>
      <form onSubmit={crear}>
        <label className="field"><span>NOMBRE</span><input id="e-nombre" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
        <label className="field"><span>CORREO</span><input id="e-correo" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field"><span>CONTRASEÑA TEMPORAL</span><input id="e-clave" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <div style={{ padding: '0 16px' }}><button className="btn" style={{ width: '100%' }} disabled={enviando}>Crear usuario</button></div>
      </form>
    </div>
  )
}

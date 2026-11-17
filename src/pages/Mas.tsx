import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useCatalogo, useToast } from '../lib/store'
import { pesos } from '../lib/format'
import type { Personal, Producto } from '../lib/types'
import { CrearClave } from './Login'
import { ProductoSheet } from './ProductoEditar'

type Vista = null | 'empleados' | 'clave'

export default function Mas() {
  const { staff } = useAuth()
  const nav = useNavigate()
  const [vista, setVista] = useState<Vista>(null)

  if (vista === 'clave') return <CrearClave onDone={() => setVista(null)} />
  if (vista === 'empleados') return <Empleados volver={() => setVista(null)} />

  type Item = [string, string, string, string, () => void, boolean?]
  const items: Item[] = [
    ['🍛', 'Menú del día', 'Publicar el almuerzo de hoy', 'var(--green-soft)', () => nav('/menu')],
    ['🏷️', 'Productos', 'Precios, disponibilidad y recetas', 'var(--pink-soft)', () => nav('/productos')],
    ['📊', 'Reportes', 'Ventas, ganancia y exportar', 'var(--lilac-soft)', () => nav('/reportes')],
    ['🧾', 'Cierre de caja', 'Cuadre del día', 'var(--orange-soft)', () => nav('/cierre')],
    ['🚚', 'Proveedores', 'Datos y compras', 'var(--yellow-soft)', () => nav('/proveedores')],
    ...(staff?.role === 'admin' ? [['👩‍🍳', 'Empleados', 'Usuarios con acceso a la app', 'var(--pink-soft)', () => setVista('empleados')] as Item] : []),
    ['🔒', 'Cambiar contraseña', staff?.full_name ?? '', 'var(--lilac-soft)', () => setVista('clave')],
    ['🖨️', 'Tickets de cocina', 'Próximamente', 'var(--line)', () => {}, true],
    ['🚪', 'Cerrar sesión', '', 'var(--line)', () => supabase.auth.signOut()],
  ]

  return (
    <div className="screen">
      <div className="top"><h1>Más</h1></div>
      <div className="box">
        {items.map(([ic, t, s, c, go, pronto]) => (
          <button key={t} className="row-i" disabled={pronto} style={pronto ? { opacity: 0.6 } : undefined} onClick={go}>
            <div className="art" style={{ ['--c' as string]: c }}>{ic}</div>
            <div className="tx"><b>{t}</b>{s && !pronto && <small>{s}</small>}</div>
            {pronto ? <span className="soon">PRÓXIMAMENTE</span> : <span className="muted">›</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Productos() {
  const nav = useNavigate()
  const volver = () => nav('/mas')
  const { categorias, productos, recargar } = useCatalogo()
  const toast = useToast()
  const [nuevo, setNuevo] = useState(false)
  const [ocultos, setOcultos] = useState<Pick<Producto, 'id' | 'name' | 'icon' | 'price'>[]>([])
  const cargarOcultos = () =>
    supabase.from('products').select('id, name, icon, price').eq('active', false).order('name')
      .then(({ data }) => setOcultos((data as typeof ocultos) ?? []))
  useEffect(() => { cargarOcultos() }, [productos])

  async function mostrar(id: string, name: string) {
    const { error } = await supabase.from('products').update({ active: true, available_today: true }).eq('id', id)
    if (error) return toast(error.message, true)
    toast(`${name} vuelve a aparecer en Vender`)
    recargar()
  }
  async function disponible(p: Producto) {
    const { error } = await supabase.from('products').update({ available_today: !p.available_today }).eq('id', p.id)
    if (error) return toast(error.message, true)
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
        <button className="mini pri" onClick={() => setNuevo(true)}>+ Nuevo</button>
      </div>
      {categorias.map((c) => (
        <div key={c.id}>
          <div className="lbl">{c.icon} {c.name}</div>
          <div className="box">
            {productos.filter((p) => p.category_id === c.id).map((p) => (
              <div key={p.id} className="row-i">
                <div className="art">{p.icon}</div>
                <button className="tx" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => nav('/productos/' + p.id)}>
                  <b>{p.name}</b>
                  <small>{pesos(p.price)} · {p.available_today ? 'Disponible' : 'Agotado hoy'}{p.recipes.length ? '' : ' · sin receta'}</small>
                </button>
                <button className={'tog' + (p.available_today ? ' on' : '')} aria-label={`Disponible hoy: ${p.name}`} aria-pressed={p.available_today} onClick={() => disponible(p)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {ocultos.length > 0 && (
        <>
          <div className="lbl">Ocultos (no aparecen en Vender)</div>
          <div className="box">
            {ocultos.map((p) => (
              <div key={p.id} className="row-i" style={{ opacity: 0.75 }}>
                <div className="art">{p.icon}</div>
                <div className="tx"><b>{p.name}</b><small>{pesos(p.price)}</small></div>
                <button className="mini" onClick={() => mostrar(p.id, p.name)}>Mostrar</button>
              </div>
            ))}
          </div>
        </>
      )}
      {nuevo && <ProductoSheet onClose={() => setNuevo(false)} />}
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

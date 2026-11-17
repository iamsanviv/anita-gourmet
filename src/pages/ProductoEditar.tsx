import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogo, useToast } from '../lib/store'
import { pesos } from '../lib/format'
import type { GrupoOpciones, Producto } from '../lib/types'

const dup = (e: { code?: string }, texto: string) => (e.code === '23505' ? texto : null)

/** Crear un producto nuevo o editar nombre, ícono, categoría y precio. */
export function ProductoSheet({ producto, onClose }: { producto?: Producto; onClose: () => void }) {
  const { categorias, productos, recargar } = useCatalogo()
  const toast = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({
    name: producto?.name ?? '', icon: producto?.icon ?? '🍽️',
    category_id: producto?.category_id ?? categorias[0]?.id ?? 'nueva', price: producto ? String(producto.price) : '',
  })
  const [cat, setCat] = useState({ name: '', icon: '🍽️' })
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    if (!f.name.trim()) return toast('Escribe el nombre', true)
    if (f.price === '') return toast('Escribe el precio', true)
    setEnviando(true)
    let categoryId = f.category_id
    if (categoryId === 'nueva') {
      if (!cat.name.trim()) { setEnviando(false); return toast('Escribe el nombre de la categoría', true) }
      const sort = Math.max(-1, ...categorias.map((c) => c.sort)) + 1
      const { data, error } = await supabase.from('categories').insert({ name: cat.name.trim(), icon: cat.icon.trim() || '🍽️', sort }).select('id').single()
      if (error) { setEnviando(false); return toast(dup(error, 'Ya existe una categoría con ese nombre (puede estar oculta)') ?? error.message, true) }
      categoryId = data.id as string
    }
    const datos = { name: f.name.trim(), icon: f.icon.trim() || '🍽️', category_id: categoryId, price: Number(f.price) }
    if (producto) {
      const { error } = await supabase.from('products').update(datos).eq('id', producto.id)
      setEnviando(false)
      if (error) return toast(dup(error, 'Ya hay un producto con ese nombre en esa categoría') ?? error.message, true)
      toast('Cambios guardados')
      await recargar()
      onClose()
    } else {
      const sort = Math.max(-1, ...productos.filter((p) => p.category_id === categoryId).map((p) => p.sort)) + 1
      const { data, error } = await supabase.from('products').insert({ ...datos, sort }).select('id').single()
      setEnviando(false)
      if (error) return toast(dup(error, 'Ya hay un producto con ese nombre en esa categoría (puede estar oculto)') ?? error.message, true)
      toast(`${datos.name} creado`)
      await recargar()
      onClose()
      nav('/productos/' + data.id)
    }
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={producto ? 'Editar producto' : 'Nuevo producto'}>
        <div className="grab" />
        <div className="sh-top"><div className="art">{f.icon || '🍽️'}</div><div><b>{producto ? 'Editar producto' : 'Nuevo producto'}</b><small>{producto ? producto.name : 'Aparece en Vender apenas lo guardes'}</small></div></div>
        <div className="row2">
          <label className="field"><span>NOMBRE</span><input id="np-nombre" autoFocus={!producto} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Arepa con queso" /></label>
          <label className="field"><span>ÍCONO</span><input id="np-icono" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} maxLength={4} /></label>
        </div>
        <label className="field">
          <span>CATEGORÍA</span>
          <select id="np-cat" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            <option value="nueva">+ Categoría nueva…</option>
          </select>
        </label>
        {f.category_id === 'nueva' && (
          <div className="row2">
            <label className="field"><span>NOMBRE DE LA CATEGORÍA</span><input id="np-cat-nombre" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="Ej.: Desayunos" /></label>
            <label className="field"><span>ÍCONO</span><input id="np-cat-icono" value={cat.icon} onChange={(e) => setCat({ ...cat, icon: e.target.value })} maxLength={4} /></label>
          </div>
        )}
        <label className="field big">
          <span>PRECIO</span>
          <input id="np-precio" inputMode="numeric" value={f.price !== '' ? pesos(Number(f.price)) : ''} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, '') })} placeholder="$0" />
        </label>
        <button className="btn" disabled={enviando} onClick={guardar}>{producto ? 'Guardar cambios' : 'Crear producto'}</button>
        {!producto && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Después de crearlo puedes agregarle opciones (tamaño, sabor, extras) y su receta.</p>}
      </div>
    </>
  )
}

type OpcionEd = { id?: string; name: string; price_delta: string }

/** Crear o editar un grupo de opciones (p. ej. "Tamaño": Pequeña, Grande +$7.000). */
export function GrupoSheet({ productoId, grupo, sort, onClose }: { productoId: string; grupo?: GrupoOpciones; sort: number; onClose: () => void }) {
  const { recargar } = useCatalogo()
  const toast = useToast()
  const [f, setF] = useState({ name: grupo?.name ?? '', required: grupo?.required ?? true, multiple: grupo?.multiple ?? false })
  const [ops, setOps] = useState<OpcionEd[]>(
    grupo?.options.map((o) => ({ id: o.id, name: o.name, price_delta: String(o.price_delta) })) ?? [{ name: '', price_delta: '0' }, { name: '', price_delta: '0' }],
  )
  const [enviando, setEnviando] = useState(false)

  const cambiar = (i: number, campo: keyof OpcionEd, v: string) => setOps((xs) => xs.map((x, k) => (k === i ? { ...x, [campo]: v } : x)))
  const validas = ops.filter((o) => o.name.trim())

  async function guardar() {
    if (!f.name.trim()) return toast('Escribe el nombre del grupo', true)
    if (!validas.length) return toast('Agrega al menos una opción', true)
    setEnviando(true)
    let groupId = grupo?.id
    if (grupo) {
      const { error } = await supabase.from('option_groups').update({ name: f.name.trim(), required: f.required, multiple: f.multiple }).eq('id', grupo.id)
      if (error) { setEnviando(false); return toast(error.message, true) }
    } else {
      const { data, error } = await supabase.from('option_groups').insert({ product_id: productoId, name: f.name.trim(), required: f.required, multiple: f.multiple, sort }).select('id').single()
      if (error) { setEnviando(false); return toast(error.message, true) }
      groupId = data.id as string
    }
    // Opciones quitadas
    const quedan = new Set(validas.filter((o) => o.id).map((o) => o.id))
    const quitar = (grupo?.options ?? []).filter((o) => !quedan.has(o.id)).map((o) => o.id)
    if (quitar.length) {
      const { error } = await supabase.from('options').delete().in('id', quitar)
      if (error) { setEnviando(false); return toast(error.message, true) }
    }
    for (const [i, o] of validas.entries()) {
      const datos = { name: o.name.trim(), price_delta: Number(o.price_delta.replace(/[^\d-]/g, '')) || 0, sort: i }
      const { error } = o.id
        ? await supabase.from('options').update(datos).eq('id', o.id)
        : await supabase.from('options').insert({ ...datos, group_id: groupId })
      if (error) { setEnviando(false); return toast(error.message, true) }
    }
    setEnviando(false)
    toast('Opciones guardadas')
    await recargar()
    onClose()
  }

  async function borrarGrupo() {
    if (!grupo) return
    const { error } = await supabase.from('option_groups').delete().eq('id', grupo.id)
    if (error) return toast(error.message, true)
    toast(`Se quitó "${grupo.name}"`)
    await recargar()
    onClose()
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={grupo ? `Editar ${grupo.name}` : 'Nuevo grupo de opciones'}>
        <div className="grab" />
        <div className="sh-top"><div className="art">⚙️</div><div><b>{grupo ? grupo.name : 'Grupo de opciones'}</b><small>Ej.: Tamaño, Sabor, Extras</small></div></div>
        <label className="field"><span>NOMBRE DEL GRUPO</span><input id="g-nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Tamaño" /></label>
        <div className="chips">
          <button className={'ch' + (f.required ? ' on' : '')} onClick={() => setF({ ...f, required: !f.required })}>{f.required ? '✓ ' : ''}Obligatorio</button>
          <button className={'ch' + (f.multiple ? ' on' : '')} onClick={() => setF({ ...f, multiple: !f.multiple })}>{f.multiple ? '✓ ' : ''}Se pueden elegir varias</button>
        </div>
        <div>
          <div className="row2" style={{ gridTemplateColumns: '1fr 110px 40px', fontSize: 11.5, fontWeight: 800, color: 'var(--muted)' }}>
            <span>OPCIÓN</span><span>SUMA AL PRECIO</span><span />
          </div>
          {ops.map((o, i) => (
            <div key={o.id ?? 'n' + i} className="row2" style={{ gridTemplateColumns: '1fr 110px 40px', alignItems: 'center', marginTop: 6 }}>
              <input className="inp" aria-label={`Opción ${i + 1}`} value={o.name} onChange={(e) => cambiar(i, 'name', e.target.value)} placeholder={i === 0 ? 'Ej.: Pequeña' : 'Ej.: Grande'} />
              <input className="inp" aria-label={`Valor extra de la opción ${i + 1}`} inputMode="numeric" value={o.price_delta === '0' || o.price_delta === '' ? '' : pesos(Number(o.price_delta.replace(/\D/g, '')))} onChange={(e) => cambiar(i, 'price_delta', e.target.value.replace(/\D/g, '') || '0')} placeholder="$0" />
              <button className="mini" aria-label={`Quitar opción ${i + 1}`} onClick={() => setOps((xs) => xs.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
          <button className="mini link" style={{ marginTop: 10 }} onClick={() => setOps((xs) => [...xs, { name: '', price_delta: '0' }])}>+ Agregar opción</button>
        </div>
        <button className="btn" disabled={enviando} onClick={guardar}>Guardar opciones</button>
        {grupo && <button className="btn danger" onClick={borrarGrupo}>Quitar este grupo</button>}
      </div>
    </>
  )
}

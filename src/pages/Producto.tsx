import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogo, useToast } from '../lib/store'
import { cant, leerNumero, pesos } from '../lib/format'
import type { GrupoOpciones, ItemInventario, RecetaConItem } from '../lib/types'
import { useInventario } from './Inventario'
import { GrupoSheet, ProductoSheet } from './ProductoEditar'

export default function ProductoPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { productos, categorias, recargar } = useCatalogo()
  const { items, cargar: cargarItems } = useInventario()
  const p = productos.find((x) => x.id === id)
  const [receta, setReceta] = useState<RecetaConItem[] | null>(null)
  const [precio, setPrecio] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<RecetaConItem | null>(null)
  const [editandoProducto, setEditandoProducto] = useState(false)
  const [grupo, setGrupo] = useState<GrupoOpciones | 'nuevo' | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('recipes').select('*, inventory_items(*)').eq('product_id', id!)
    setReceta(((data as RecetaConItem[]) ?? []).sort((a, b) => a.inventory_items.name.localeCompare(b.inventory_items.name)))
  }, [id])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (p) setPrecio(String(p.price)) }, [p])

  const costo = useMemo(() => (receta ?? []).reduce((a, r) => a + r.quantity * Number(r.inventory_items.unit_cost), 0), [receta])
  const sinCosto = (receta ?? []).filter((r) => !(Number(r.inventory_items.unit_cost) > 0))

  if (!p) return <div className="empty">Cargando…</div>
  const cat = categorias.find((c) => c.id === p.category_id)
  const ganancia = p.price - costo
  const tieneReceta = (receta?.length ?? 0) > 0

  async function cambiosHechos() {
    await cargar()
    recargar()
  }

  async function disponible() {
    const { error } = await supabase.from('products').update({ available_today: !p!.available_today }).eq('id', p!.id)
    if (error) return toast(error.message, true)
    recargar()
  }

  async function ocultar() {
    const { error } = await supabase.from('products').update({ active: false }).eq('id', p!.id)
    if (error) return toast(error.message, true)
    toast(`${p!.name} quedó oculto. Puedes volver a mostrarlo desde Productos.`)
    await recargar()
    nav('/productos')
  }

  async function guardarPrecio() {
    const n = Number(precio)
    if (!n || n === p!.price) return
    const { error } = await supabase.from('products').update({ price: n }).eq('id', p!.id)
    if (error) return toast(error.message, true)
    toast(`${p!.name}: ${pesos(n)}`)
    recargar()
  }

  /** Producto que se compra hecho: crea (o reutiliza) un ítem con su nombre y una receta de 1 unidad. */
  async function controlarComoComprado() {
    let item = (items ?? []).find((i) => i.name.toLowerCase() === p!.name.toLowerCase())
    if (!item) {
      const { data, error } = await supabase.from('inventory_items')
        .insert({ name: p!.name, kind: 'producto', unit: 'und', icon: p!.icon }).select('*').single()
      if (error) return toast(error.code === '23505' ? 'Ya hay un ítem con ese nombre (quizá quitado del inventario)' : error.message, true)
      item = data as ItemInventario
    }
    const { error } = await supabase.from('recipes').insert({ product_id: p!.id, item_id: item.id, quantity: 1 })
    if (error) return toast(error.message, true)
    toast('Listo: cada venta descuenta 1 unidad. Registra una compra o un conteo en Inventario.')
    cargarItems()
    cambiosHechos()
  }

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/productos')} aria-label="Volver">‹</button>
        <h1>Producto</h1>
        <button className="mini" onClick={() => setEditandoProducto(true)}>Editar</button>
      </div>
      <div className="hero-p">
        <div className="art">{p.icon}</div>
        <div><b>{p.name}</b><small>{cat ? `${cat.icon} ${cat.name}` : ''}</small></div>
      </div>
      <div className="card-sw sw">
        <div>Disponible hoy<small>{p.available_today ? 'Se puede vender' : 'Aparece como agotado en Vender'}</small></div>
        <button className={'tog' + (p.available_today ? ' on' : '')} aria-label="Disponible hoy" aria-pressed={p.available_today} onClick={disponible} />
      </div>
      <div className="panel">
        <label className="field">
          <span>PRECIO DE VENTA</span>
          <input id="p-precio" inputMode="numeric" value={precio ? pesos(Number(precio)) : ''} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))} />
        </label>
        {Number(precio) !== p.price && Number(precio) > 0 && <button className="btn" onClick={guardarPrecio}>Guardar precio</button>}
      </div>

      <div className="lbl">Receta (se descuenta al vender una unidad)</div>
      {!receta ? (
        <div className="empty">Cargando…</div>
      ) : (
        <div className="box">
          {receta.map((r) => (
            <button key={r.item_id} className="rc" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px dashed var(--line)', textAlign: 'left' }} onClick={() => setEditando(r)}>
              <span>{r.inventory_items.icon} {r.inventory_items.name} · {cant(r.quantity)} {r.inventory_items.unit}</span>
              <span className="v">{Number(r.inventory_items.unit_cost) > 0 ? pesos(r.quantity * Number(r.inventory_items.unit_cost)) : 'Sin costo'}</span>
            </button>
          ))}
          <button className="row-i" onClick={() => setAgregando(true)} disabled={!items}>
            <div className="art" style={{ ['--c' as string]: 'var(--line)' }}>＋</div>
            <div className="tx"><b style={{ color: 'var(--pink)' }}>Agregar ingrediente</b>{!tieneReceta && <small>Sin receta no se descuenta inventario ni se calcula la ganancia</small>}</div>
          </button>
        </div>
      )}
      {!tieneReceta && receta && (
        <div style={{ margin: '10px 16px 0' }}>
          <button className="btn ghost" style={{ width: '100%' }} onClick={controlarComoComprado}>Se compra hecho: controlar unidades</button>
        </div>
      )}

      {tieneReceta && (
        <>
          <div className="marg">
            <div><small>COSTO</small><b>{pesos(costo)}</b></div>
            <div><small>PRECIO</small><b>{pesos(p.price)}</b></div>
            <div className={ganancia >= 0 ? 'g' : 'r'}><small>GANANCIA</small><b>{pesos(ganancia)}</b></div>
          </div>
          <p className="note">
            {p.price > 0 && `Margen ${Math.round((ganancia / p.price) * 100)} %. `}
            El costo usa el último precio de compra de cada ingrediente.
            {sinCosto.length > 0 && ` Falta el costo de: ${sinCosto.map((r) => r.inventory_items.name).join(', ')}.`}
          </p>
        </>
      )}

      <div className="lbl">Opciones y extras</div>
      <div className="box">
        {p.option_groups.map((g) => (
          <button key={g.id} className="row-i" onClick={() => setGrupo(g)}>
            <div className="tx">
              <b>{g.name} <span className="muted" style={{ fontWeight: 700, fontSize: 11.5 }}>{g.required ? 'Obligatorio' : 'Opcional'}{g.multiple ? ' · varias' : ''}</span></b>
              <small>{g.options.map((o) => o.name + (o.price_delta ? ` +${pesos(o.price_delta)}` : '')).join(', ')}</small>
            </div>
            <span className="muted">›</span>
          </button>
        ))}
        <button className="row-i" onClick={() => setGrupo('nuevo')}>
          <div className="art" style={{ ['--c' as string]: 'var(--line)' }}>＋</div>
          <div className="tx"><b style={{ color: 'var(--pink)' }}>Agregar opciones</b><small>Tamaño, sabor, extras…</small></div>
        </button>
      </div>

      <div style={{ margin: '16px 16px 0' }}>
        <button className="btn danger" style={{ width: '100%' }} onClick={ocultar}>Ocultar producto (ya no se vende)</button>
      </div>

      {editandoProducto && <ProductoSheet producto={p} onClose={() => setEditandoProducto(false)} />}
      {grupo && (
        <GrupoSheet productoId={p.id} grupo={grupo === 'nuevo' ? undefined : grupo} sort={p.option_groups.length} onClose={() => setGrupo(null)} />
      )}

      {agregando && items && (
        <IngredienteSheet
          items={items.filter((i) => !(receta ?? []).some((r) => r.item_id === i.id))}
          onClose={() => setAgregando(false)}
          onGuardar={async (itemId, qty) => {
            const { error } = await supabase.from('recipes').insert({ product_id: p.id, item_id: itemId, quantity: qty })
            if (error) return toast(error.message, true)
            setAgregando(false)
            cambiosHechos()
          }}
        />
      )}
      {editando && (
        <IngredienteSheet
          fila={editando}
          items={[editando.inventory_items]}
          onClose={() => setEditando(null)}
          onGuardar={async (_itemId, qty) => {
            const { error } = await supabase.from('recipes').update({ quantity: qty }).eq('product_id', p.id).eq('item_id', editando.item_id)
            if (error) return toast(error.message, true)
            setEditando(null)
            cambiosHechos()
          }}
          onQuitar={async () => {
            const { error } = await supabase.from('recipes').delete().eq('product_id', p.id).eq('item_id', editando.item_id)
            if (error) return toast(error.message, true)
            setEditando(null)
            cambiosHechos()
          }}
        />
      )}
    </div>
  )
}

function IngredienteSheet({ items, fila, onClose, onGuardar, onQuitar }: {
  items: ItemInventario[]; fila?: RecetaConItem; onClose: () => void
  onGuardar: (itemId: string, qty: number) => void; onQuitar?: () => void
}) {
  const [itemId, setItemId] = useState(fila?.item_id ?? items[0]?.id ?? '')
  const [qty, setQty] = useState(fila ? cant(fila.quantity) : '')
  const item = items.find((i) => i.id === itemId)
  const n = leerNumero(qty)
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Ingrediente de la receta">
        <div className="grab" />
        <div className="sh-top"><div className="art">{item?.icon ?? '📦'}</div><div><b>{fila ? fila.inventory_items.name : 'Agregar ingrediente'}</b><small>Cuánto gasta una unidad del producto</small></div></div>
        {!fila && (
          items.length ? (
            <label className="field">
              <span>INGREDIENTE</span>
              <select id="r-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.icon} {i.name} ({i.unit})</option>)}
              </select>
            </label>
          ) : <div className="alert info" style={{ margin: 0 }}>Primero crea los ingredientes en Inventario con el botón +.</div>
        )}
        <label className="field"><span>CANTIDAD ({item?.unit ?? ''})</span><input id="r-qty" inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Ej.: 150" /></label>
        {item && n > 0 && Number(item.unit_cost) > 0 && <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Cuesta {pesos(n * Number(item.unit_cost))}</div>}
        <button className="btn" disabled={!item || !(n > 0)} onClick={() => onGuardar(itemId, n)}>{fila ? 'Guardar' : 'Agregar a la receta'}</button>
        {onQuitar && <button className="btn danger" onClick={onQuitar}>Quitar de la receta</button>}
      </div>
    </>
  )
}

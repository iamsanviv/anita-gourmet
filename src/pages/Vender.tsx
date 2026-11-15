import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarrito, useCatalogo, useToast } from '../lib/store'
import { useMenuHoy } from './MenuDia'
import { colorCategoria } from '../lib/config'
import { cant, pesos } from '../lib/format'
import type { OpcionElegida, Producto } from '../lib/types'

export default function Vender() {
  const { categorias, productos, cargando } = useCatalogo()
  const carrito = useCarrito()
  const nav = useNavigate()
  const [catId, setCatId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<Producto | null>(null)
  const toast = useToast()
  const menu = useMenuHoy()

  const cat = categorias.find((c) => c.id === catId) ?? categorias[0]
  const color = (categoryId: string) => colorCategoria(categorias.find((c) => c.id === categoryId)?.sort ?? 0)

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q) return productos.filter((p) => p.name.toLowerCase().includes(q))
    return productos.filter((p) => p.category_id === cat?.id)
  }, [productos, cat, busqueda])

  const enCarrito = (id: string) => carrito.items.filter((i) => i.product_id === id).reduce((a, i) => a + i.quantity, 0)

  function tocar(p: Producto) {
    if (p.option_groups.length) return setAbierto(p)
    avisarStock(p, 1)
    carrito.agregar({ product_id: p.id, name: p.name, icon: p.icon, unit_price: p.price, quantity: 1, options: [], note: '' })
  }

  /** Solo avisa: la venta nunca se bloquea por inventario. */
  function avisarStock(p: Producto, n: number) {
    const faltan = faltantes(p, enCarrito(p.id) + n, carrito.items, productos)
    if (faltan.length) toast(`Ojo: ${faltan.join(', ')}. Puedes vender igual.`, true)
  }

  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div className="screen">
      <div className="hdr">
        <img src="/logo.png" alt="Anita Gourmet" />
        <div className="who">
          <small>{hoy}</small>
          <b>{carrito.editando ? `Editando pedido #${carrito.editando.number}` : 'Nueva venta'}</b>
        </div>
      </div>
      <label className="search">
        <span aria-hidden="true">🔍</span>
        <input id="buscar" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </label>

      {menu && !busqueda && (
        <div className="menu-dia">
          <span className="em">🍛</span>
          <div><small>MENÚ DEL DÍA</small><b>{menu.title}</b>{menu.description && <p>{menu.description}</p>}</div>
        </div>
      )}

      {!busqueda && (
        <div className="cats" role="tablist">
          {categorias.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === cat?.id} className={'cat' + (c.id === cat?.id ? ' on' : '')} onClick={() => setCatId(c.id)}>
              <span className="bub" style={{ ['--c' as string]: colorCategoria(c.sort) }}>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sec-t">
        <b>{busqueda ? 'Resultados' : cat?.name ?? ''}</b>
        <span>{lista.length} productos</span>
      </div>

      {cargando ? (
        <div className="empty">Cargando productos…</div>
      ) : lista.length === 0 ? (
        <div className="empty"><b>Sin resultados</b>Prueba con otro nombre.</div>
      ) : (
        <div className="grid">
          {lista.map((p) => {
            const n = enCarrito(p.id)
            const off = !p.available_today
            const sinStock = p.recipes.some((r) => r.inventory_items && r.inventory_items.stock < r.quantity)
            return (
              <div key={p.id} className={'card' + (off ? ' off' : '')}>
                <div className="art" style={{ ['--c' as string]: color(p.category_id) }}>{p.icon}</div>
                {p.option_groups.length > 0 && <span className="tag opc">Con opciones</span>}
                {off && <span className="tag ago">Agotado hoy</span>}
                {!off && sinStock && <span className="tag low">Poco inventario</span>}
                <div className="nm">{p.name}</div>
                <div className="row">
                  <span className="pr">{p.option_groups.length ? 'desde ' : ''}{pesos(p.price)}</span>
                  <button className="add" aria-label={`Agregar ${p.name}`} onClick={() => tocar(p)}>+</button>
                </div>
                {n > 0 && <span className="qty">{n}</span>}
              </div>
            )
          })}
        </div>
      )}

      {carrito.cantidad > 0 && (
        <button className="cartbar" onClick={() => nav('/pedido')}>
          <span className="n">{carrito.cantidad}</span>
          <span className="t">
            Ver pedido
            <small>{carrito.items.map((i) => `${i.quantity} ${i.name}`).join(', ')}</small>
          </span>
          <span className="tot">{pesos(carrito.total)}</span>
        </button>
      )}

      {abierto && <OpcionesSheet producto={abierto} onClose={() => setAbierto(null)} onAgregar={(n) => avisarStock(abierto, n)} />}
    </div>
  )
}

/** Ingredientes que no alcanzan si se venden `unidades` de este producto (contando lo que ya va en el pedido). */
function faltantes(p: Producto, unidades: number, items: { product_id: string | null; quantity: number }[], productos: Producto[]) {
  return p.recipes.flatMap((r) => {
    const inv = r.inventory_items
    if (!inv) return []
    // Lo que otros productos del pedido ya gastan de este mismo ingrediente
    const otros = items.reduce((a, i) => {
      if (i.product_id === p.id || !i.product_id) return a
      const rec = productos.find((x) => x.id === i.product_id)?.recipes.find((x) => x.inventory_items?.id === inv.id)
      return a + (rec ? rec.quantity * i.quantity : 0)
    }, 0)
    const queda = inv.stock - otros
    return queda < r.quantity * unidades ? [`quedan ${cant(Math.max(0, queda))} ${inv.unit} de ${inv.name}`] : []
  })
}

function OpcionesSheet({ producto, onClose, onAgregar }: { producto: Producto; onClose: () => void; onAgregar: (n: number) => void }) {
  const carrito = useCarrito()
  const [sel, setSel] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(producto.option_groups.map((g) => [g.id, g.required && !g.multiple && g.options[0] ? [g.options[0].id] : []])),
  )
  const [nota, setNota] = useState('')
  const [cant, setCant] = useState(1)

  const elegidas: OpcionElegida[] = producto.option_groups.flatMap((g) =>
    g.options.filter((o) => sel[g.id]?.includes(o.id)).map((o) => ({ group: g.name, name: o.name, price_delta: o.price_delta })),
  )
  const unit = producto.price + elegidas.reduce((a, o) => a + o.price_delta, 0)
  const faltan = producto.option_groups.some((g) => g.required && !(sel[g.id]?.length))

  function toggle(gid: string, oid: string, multiple: boolean, required: boolean) {
    setSel((s) => {
      const cur = s[gid] ?? []
      if (multiple) return { ...s, [gid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] }
      if (cur.includes(oid) && !required) return { ...s, [gid]: [] }
      return { ...s, [gid]: [oid] }
    })
  }

  function agregar() {
    onAgregar(cant)
    carrito.agregar({ product_id: producto.id, name: producto.name, icon: producto.icon, unit_price: unit, quantity: cant, options: elegidas, note: nota.trim() })
    onClose()
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={producto.name}>
        <div className="grab" />
        <div className="sh-top">
          <div className="art">{producto.icon}</div>
          <div><b>{producto.name}</b><small>desde {pesos(producto.price)}</small></div>
        </div>
        {producto.option_groups.map((g) => (
          <div className="grp" key={g.id}>
            <div className="l">{g.name} {g.required ? <em>Obligatorio</em> : <span className="muted" style={{ fontSize: 12 }}>Opcional</span>}</div>
            <div className="chips">
              {g.options.map((o) => (
                <button key={o.id} className={'ch' + (sel[g.id]?.includes(o.id) ? ' on' : '')} onClick={() => toggle(g.id, o.id, g.multiple, g.required)}>
                  {o.name} {o.price_delta !== 0 && <small>{o.price_delta > 0 ? '+' : ''}{pesos(o.price_delta)}</small>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <label className="field">
          <span>NOTA PARA COCINA (OPCIONAL)</span>
          <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: sin cebolla" />
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="stepper">
            <button aria-label="Menos" onClick={() => setCant((c) => Math.max(1, c - 1))}>−</button>
            {cant}
            <button aria-label="Más" onClick={() => setCant((c) => c + 1)}>+</button>
          </div>
          <button className="btn split" disabled={faltan} onClick={agregar}>
            <span>Agregar</span><span>{pesos(unit * cant)}</span>
          </button>
        </div>
      </div>
    </>
  )
}

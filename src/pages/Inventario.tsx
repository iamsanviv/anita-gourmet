import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogo, useToast } from '../lib/store'
import { UNIDADES } from '../lib/config'
import { cant, fechaCorta, horaCorta, leerNumero, pesos } from '../lib/format'
import type { ItemInventario, MovStock, Unidad } from '../lib/types'

export const bajo = (i: ItemInventario) => i.stock <= 0 || (i.min_stock > 0 && i.stock < i.min_stock)
const nivel = (i: ItemInventario) => {
  const tope = i.min_stock > 0 ? i.min_stock * 2 : Math.max(i.stock, 1)
  return Math.max(0, Math.min(100, (i.stock / tope) * 100))
}

/** Lista de ítems de inventario activos (para compras, recetas y mermas). */
export function useInventario() {
  const [items, setItems] = useState<ItemInventario[] | null>(null)
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('active', true).order('name')
    setItems((data as ItemInventario[]) ?? [])
  }, [])
  useEffect(() => { cargar() }, [cargar])
  return { items, cargar }
}

export default function Inventario() {
  const nav = useNavigate()
  const { items, cargar } = useInventario()
  const [tab, setTab] = useState<'ingrediente' | 'producto'>('ingrediente')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<ItemInventario | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [merma, setMerma] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (items ?? [])
      .filter((i) => i.kind === tab && (!t || i.name.toLowerCase().includes(t)))
      .sort((a, b) => Number(bajo(b)) - Number(bajo(a)) || a.name.localeCompare(b.name))
  }, [items, tab, q])
  const bajos = (items ?? []).filter((i) => i.kind === tab && bajo(i)).length
  const nombreTab = tab === 'ingrediente' ? 'ingredientes' : 'productos comprados'

  return (
    <div className="screen">
      <div className="top"><h1>Inventario</h1></div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'ingrediente'} className={tab === 'ingrediente' ? 'on' : ''} onClick={() => setTab('ingrediente')}>Ingredientes</button>
        <button role="tab" aria-selected={tab === 'producto'} className={tab === 'producto' ? 'on' : ''} onClick={() => setTab('producto')}>Productos comprados</button>
      </div>
      {bajos > 0 && <div className="alert">⚠️ {bajos} {bajos === 1 ? (tab === 'ingrediente' ? 'ingrediente' : 'producto') : nombreTab} por debajo del mínimo</div>}
      <div className="two-b">
        <button className="btn" onClick={() => nav('/inventario/compra')}>+ Registrar compra</button>
        <button className="btn soft" onClick={() => setMerma(true)} disabled={!items?.length}>Registrar merma</button>
      </div>
      <label className="search" style={{ marginTop: 12 }}>
        <span aria-hidden="true">🔍</span>
        <input id="buscar-inv" placeholder="Buscar en inventario…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {!items ? (
        <div className="empty">Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="empty">
          <b>{q ? 'Sin resultados' : `Aún no hay ${nombreTab}`}</b>
          {q ? '' : tab === 'ingrediente'
            ? 'Crea los ingredientes con el botón + y luego arma las recetas desde Más → Productos.'
            : 'Lo que compras hecho y vendes tal cual (gaseosas, paquetes). Créalo con + o desde la ficha del producto.'}
        </div>
      ) : (
        <>
          <div className="lbl">{nombreTab}</div>
          <div className="box">
            {lista.map((i) => (
              <button key={i.id} className={'st' + (bajo(i) ? ' low' : '')} onClick={() => setAbierto(i)}>
                <div className="r1">
                  <span className="ic">{i.icon}</span>
                  <div className="tx"><b>{i.name}</b><small>Mínimo {cant(i.min_stock)} {i.unit}{i.unit_cost > 0 ? ` · ${pesos(i.unit_cost)} c/${i.unit}` : ''}</small></div>
                  <div className="q">{cant(i.stock)}<small>{i.unit}</small></div>
                </div>
                <div className="lvl"><i style={{ width: nivel(i) + '%' }} /></div>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="fab" aria-label="Nuevo ítem de inventario" onClick={() => setNuevo(true)}>+</button>
      {abierto && <ItemSheet item={abierto} onClose={() => setAbierto(null)} onCambio={cargar} />}
      {nuevo && <ItemSheet tipo={tab} onClose={() => setNuevo(false)} onCambio={cargar} />}
      {merma && items && <MermaSheet items={items} onClose={() => setMerma(false)} onCambio={cargar} />}
    </div>
  )
}

const NOMBRE_MOV: Record<MovStock['kind'], string> = {
  compra: 'Compra', venta: 'Venta', merma: 'Merma', ajuste: 'Ajuste por conteo', anulacion: 'Pedido anulado',
}

/** Crear o editar un ítem: datos, ajuste por conteo y últimos movimientos. */
export function ItemSheet({ item, tipo, onClose, onCambio }: {
  item?: ItemInventario; tipo?: 'ingrediente' | 'producto'; onClose: () => void; onCambio: () => void
}) {
  const toast = useToast()
  const { recargar } = useCatalogo()
  const [f, setF] = useState({
    name: item?.name ?? '', icon: item?.icon ?? '📦', unit: (item?.unit ?? 'und') as Unidad,
    kind: item?.kind ?? tipo ?? 'ingrediente',
    min_stock: item ? cant(item.min_stock) : '', unit_cost: item ? String(Math.round(item.unit_cost)) : '',
  })
  const [conteo, setConteo] = useState(item ? '' : '')
  const [movs, setMovs] = useState<MovStock[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!item) return
    supabase.from('stock_movements').select('*').eq('item_id', item.id).order('created_at', { ascending: false }).limit(15)
      .then(({ data }) => setMovs((data as MovStock[]) ?? []))
  }, [item])

  async function guardar() {
    const min = f.min_stock ? leerNumero(f.min_stock) : 0
    const costo = f.unit_cost ? leerNumero(f.unit_cost) : 0
    if (!f.name.trim()) return toast('Escribe el nombre', true)
    if (Number.isNaN(min) || min < 0 || Number.isNaN(costo) || costo < 0) return toast('Revisa el mínimo y el costo', true)
    const contado = conteo.trim() ? leerNumero(conteo) : null
    if (contado !== null && (Number.isNaN(contado) || contado < 0)) return toast('Revisa la cantidad contada', true)
    setEnviando(true)
    const datos = { name: f.name.trim(), icon: f.icon.trim() || '📦', unit: f.unit, kind: f.kind, min_stock: min, unit_cost: costo }
    let id = item?.id
    if (item) {
      const { error } = await supabase.from('inventory_items').update(datos).eq('id', item.id)
      if (error) { setEnviando(false); return toast(error.code === '23505' ? 'Ya existe un ítem con ese nombre' : error.message, true) }
    } else {
      const { data, error } = await supabase.from('inventory_items').insert(datos).select('id').single()
      if (error) { setEnviando(false); return toast(error.code === '23505' ? 'Ya existe un ítem con ese nombre' : error.message, true) }
      id = data.id as string
    }
    if (contado !== null && id) {
      const { error } = await supabase.rpc('adjust_stock', { p_item_id: id, p_counted: contado, p_note: item ? 'Conteo' : 'Stock inicial' })
      if (error) { setEnviando(false); return toast(error.message, true) }
    }
    setEnviando(false)
    toast(item ? 'Cambios guardados' : `${datos.name} creado`)
    onCambio()
    recargar()
    onClose()
  }

  async function archivar() {
    if (!item) return
    const { error } = await supabase.from('inventory_items').update({ active: false }).eq('id', item.id)
    if (error) return toast(error.message, true)
    toast(`${item.name} ya no aparece en el inventario`)
    onCambio()
    onClose()
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={item ? item.name : 'Nuevo ítem'}>
        <div className="grab" />
        <div className="sh-top">
          <div className="art">{f.icon || '📦'}</div>
          <div>
            <b>{item ? item.name : 'Nuevo ítem'}</b>
            <small>{item ? `Hay ${cant(item.stock)} ${item.unit}` : 'Ingrediente o producto que se compra'}</small>
          </div>
        </div>
        <div className="row2">
          <label className="field"><span>NOMBRE</span><input id="i-nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Pan de hamburguesa" /></label>
          <label className="field"><span>ÍCONO</span><input id="i-icono" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} maxLength={4} /></label>
        </div>
        <div className="row2">
          <label className="field">
            <span>TIPO</span>
            <select id="i-tipo" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'ingrediente' | 'producto' })}>
              <option value="ingrediente">Ingrediente</option>
              <option value="producto">Producto comprado</option>
            </select>
          </label>
          <label className="field">
            <span>SE MIDE EN</span>
            <select id="i-unidad" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Unidad })}>
              {UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field"><span>MÍNIMO ({f.unit})</span><input id="i-min" inputMode="decimal" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} placeholder="0" /></label>
          <label className="field"><span>COSTO POR {f.unit.toUpperCase()}</span><input id="i-costo" inputMode="decimal" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} placeholder="$0" /></label>
        </div>
        <label className="field">
          <span>{item ? `CONTÉ (DEJA VACÍO SI NO CAMBIA) · HOY HAY ${cant(item.stock)} ${item.unit}` : `CUÁNTO HAY HOY (${f.unit})`}</span>
          <input id="i-conteo" inputMode="decimal" value={conteo} onChange={(e) => setConteo(e.target.value)} placeholder={item ? cant(item.stock) : '0'} />
        </label>
        <button className="btn" disabled={enviando} onClick={guardar}>{item ? 'Guardar cambios' : 'Crear ítem'}</button>
        {item && movs.length > 0 && (
          <div>
            <div className="lbl" style={{ padding: '4px 0 6px' }}>Últimos movimientos</div>
            {movs.map((m) => (
              <div key={m.id} className="rc">
                <span>{NOMBRE_MOV[m.kind]}{m.note && m.kind !== 'compra' ? ` · ${m.note}` : ''}<br /><small className="muted">{fechaCorta(m.created_at)} {horaCorta(m.created_at)}</small></span>
                <span className="v" style={{ color: m.quantity < 0 ? 'var(--orange)' : 'var(--green)' }}>{m.quantity > 0 ? '+' : ''}{cant(m.quantity)} {item.unit}</span>
              </div>
            ))}
          </div>
        )}
        {item && <button className="btn danger" onClick={archivar}>Quitar del inventario</button>}
      </div>
    </>
  )
}

function MermaSheet({ items, onClose, onCambio }: { items: ItemInventario[]; onClose: () => void; onCambio: () => void }) {
  const toast = useToast()
  const { recargar } = useCatalogo()
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [nota, setNota] = useState('')
  const item = items.find((i) => i.id === itemId)
  const n = leerNumero(qty)

  async function guardar() {
    if (!item || !(n > 0)) return
    const { data, error } = await supabase.rpc('register_waste', { p_item_id: item.id, p_quantity: n, p_note: nota })
    if (error) return toast(error.message, true)
    toast(`Merma registrada. Quedan ${cant(data as number)} ${item.unit} de ${item.name}`)
    onCambio()
    recargar()
    onClose()
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Registrar merma">
        <div className="grab" />
        <div className="sh-top"><div className="art">🗑️</div><div><b>Registrar merma</b><small>Lo que se dañó, se venció o se botó. Se descuenta del inventario.</small></div></div>
        <label className="field">
          <span>QUÉ SE PERDIÓ</span>
          <select id="m-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.icon} {i.name} · hay {cant(i.stock)} {i.unit}</option>)}
          </select>
        </label>
        <label className="field"><span>CANTIDAD ({item?.unit})</span><input id="m-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></label>
        <label className="field"><span>MOTIVO (OPCIONAL)</span><input id="m-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: se venció" /></label>
        <button className="btn" disabled={!(n > 0)} onClick={guardar}>Registrar merma</button>
      </div>
    </>
  )
}

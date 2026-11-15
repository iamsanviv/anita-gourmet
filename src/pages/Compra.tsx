import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCatalogo, useToast } from '../lib/store'
import { METODOS_COMPRA } from '../lib/config'
import { cant, hoyBogota, leerNumero, pesos } from '../lib/format'
import type { ItemInventario, Proveedor } from '../lib/types'
import { ItemSheet, useInventario } from './Inventario'

type Linea = { item: ItemInventario; qty: string; total: string }

export default function Compra() {
  const nav = useNavigate()
  const toast = useToast()
  const { recargar } = useCatalogo()
  const { items, cargar } = useInventario()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedor, setProveedor] = useState('')
  const [nuevoProv, setNuevoProv] = useState('')
  const [fecha, setFecha] = useState(hoyBogota())
  const [metodo, setMetodo] = useState<string>('efectivo')
  const [nota, setNota] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [eligiendo, setEligiendo] = useState(false)
  const [creandoItem, setCreandoItem] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }) => setProveedores((data as Proveedor[]) ?? []))
  }, [])

  const total = lineas.reduce((a, l) => a + (leerNumero(l.total) || 0), 0)
  const validas = lineas.length > 0 && lineas.every((l) => leerNumero(l.qty) > 0 && leerNumero(l.total) >= 0)

  function agregar(item: ItemInventario) {
    if (!lineas.some((l) => l.item.id === item.id)) setLineas((ls) => [...ls, { item, qty: '', total: '' }])
    setEligiendo(false)
  }
  const cambiar = (id: string, campo: 'qty' | 'total', v: string) =>
    setLineas((ls) => ls.map((l) => (l.item.id === id ? { ...l, [campo]: v } : l)))

  async function guardar() {
    if (!validas) return toast('Revisa cantidades y valores', true)
    setEnviando(true)
    let supplierId: string | null = proveedor && proveedor !== 'nuevo' ? proveedor : null
    if (proveedor === 'nuevo') {
      if (!nuevoProv.trim()) { setEnviando(false); return toast('Escribe el nombre del proveedor', true) }
      const { data, error } = await supabase.from('suppliers').insert({ name: nuevoProv.trim() }).select('id').single()
      if (error) { setEnviando(false); return toast(error.code === '23505' ? 'Ese proveedor ya existe: búscalo en la lista' : error.message, true) }
      supplierId = data.id as string
    }
    const p_items = lineas.map((l) => {
      const q = leerNumero(l.qty)
      return { item_id: l.item.id, quantity: q, unit_cost: (leerNumero(l.total) || 0) / q }
    })
    const { error } = await supabase.rpc('register_purchase', {
      p_supplier_id: supplierId, p_date: fecha, p_method: metodo, p_items, p_note: nota,
    })
    setEnviando(false)
    if (error) return toast(error.message, true)
    toast(`Compra guardada · ${pesos(total)}`)
    recargar()
    nav('/inventario')
  }

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/inventario')} aria-label="Volver">‹</button>
        <h1>Nueva compra</h1>
      </div>
      <label className="field">
        <span>PROVEEDOR</span>
        <select id="c-prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="nuevo">+ Proveedor nuevo…</option>
        </select>
      </label>
      {proveedor === 'nuevo' && (
        <label className="field"><span>NOMBRE DEL PROVEEDOR NUEVO</span><input id="c-prov-nuevo" autoFocus value={nuevoProv} onChange={(e) => setNuevoProv(e.target.value)} placeholder="Ej.: Panadería La Espiga" /></label>
      )}
      <label className="field"><span>FECHA</span><input id="c-fecha" type="date" value={fecha} max={hoyBogota()} onChange={(e) => setFecha(e.target.value)} /></label>

      <div className="lbl">Lo que compraste</div>
      <div className="box">
        {lineas.map((l) => {
          const q = leerNumero(l.qty)
          const t = leerNumero(l.total)
          return (
            <div key={l.item.id} className="st">
              <div className="r1">
                <span className="ic">{l.item.icon}</span>
                <div className="tx"><b>{l.item.name}</b><small>{q > 0 && t >= 0 ? `${pesos(t / q)} por ${l.item.unit}` : `Hay ${cant(l.item.stock)} ${l.item.unit}`}</small></div>
                <button className="mini" aria-label={`Quitar ${l.item.name}`} onClick={() => setLineas((ls) => ls.filter((x) => x.item.id !== l.item.id))}>✕</button>
              </div>
              <div className="row2" style={{ marginLeft: 46 }}>
                <label className="field" style={{ marginBottom: 0 }}><span>CANTIDAD ({l.item.unit})</span><input inputMode="decimal" value={l.qty} onChange={(e) => cambiar(l.item.id, 'qty', e.target.value)} placeholder="0" /></label>
                <label className="field" style={{ marginBottom: 0 }}><span>PAGASTE</span><input inputMode="numeric" value={l.total ? pesos(Number(l.total.replace(/\D/g, ''))) : ''} onChange={(e) => cambiar(l.item.id, 'total', e.target.value.replace(/\D/g, ''))} placeholder="$0" /></label>
              </div>
            </div>
          )
        })}
        <button className="row-i" onClick={() => setEligiendo(true)}>
          <div className="art" style={{ ['--c' as string]: 'var(--line)' }}>＋</div>
          <div className="tx"><b style={{ color: 'var(--pink)' }}>Agregar producto</b></div>
        </button>
      </div>
      <div className="sum"><span>Total compra</span><span className="v">{pesos(total)}</span></div>

      <div className="lbl">Pagado con</div>
      <div className="chips" style={{ padding: '0 16px' }}>
        {METODOS_COMPRA.map((m) => (
          <button key={m.id} className={'ch' + (metodo === m.id ? ' on' : '')} onClick={() => setMetodo(m.id)}>{m.icono} {m.nombre}</button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 12 }}><span>NOTA (OPCIONAL)</span><input id="c-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: factura 1234" /></label>

      <div className="dock">
        <button className="btn" disabled={!validas || enviando} onClick={guardar}>Guardar compra</button>
      </div>

      {eligiendo && items && (
        <Elegir items={items} usados={lineas.map((l) => l.item.id)} onElegir={agregar} onNuevo={() => { setEligiendo(false); setCreandoItem(true) }} onClose={() => setEligiendo(false)} />
      )}
      {creandoItem && (
        <ItemSheet tipo="ingrediente" onClose={() => setCreandoItem(false)} onCambio={() => { cargar() }} />
      )}
    </div>
  )
}

function Elegir({ items, usados, onElegir, onNuevo, onClose }: {
  items: ItemInventario[]; usados: string[]; onElegir: (i: ItemInventario) => void; onNuevo: () => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return items.filter((i) => !usados.includes(i.id) && (!t || i.name.toLowerCase().includes(t)))
  }, [items, usados, q])
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Elegir producto">
        <div className="grab" />
        <label className="search" style={{ margin: 0 }}>
          <span aria-hidden="true">🔍</span>
          <input id="c-buscar" autoFocus placeholder="Buscar ingrediente o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div>
          {lista.map((i) => (
            <button key={i.id} className="row-i" onClick={() => onElegir(i)}>
              <div className="art">{i.icon}</div>
              <div className="tx"><b>{i.name}</b><small>{i.kind === 'producto' ? 'Producto comprado' : 'Ingrediente'} · hay {cant(i.stock)} {i.unit}</small></div>
            </button>
          ))}
          {lista.length === 0 && <div className="empty" style={{ margin: '12px 0' }}>No hay coincidencias.</div>}
        </div>
        <button className="btn soft" onClick={onNuevo}>+ Crear ítem nuevo</button>
      </div>
    </>
  )
}

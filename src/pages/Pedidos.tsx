import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useCarrito, useCatalogo, useToast } from '../lib/store'
import { hace, horaCorta, iniciales, pesos } from '../lib/format'
import { METODOS } from '../lib/config'
import type { ItemPedido, OpcionElegida, Pedido } from '../lib/types'

type Fila = Pedido & {
  customers: { full_name: string } | null
  order_items: { product_id: string | null; name: string; unit_price: number; quantity: number; options: OpcionElegida[]; note: string | null }[]
}

export default function Pedidos() {
  const { staff } = useAuth()
  const carrito = useCarrito()
  const { productos } = useCatalogo()
  const toast = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState<'abiertos' | 'hoy'>('abiertos')
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [anulando, setAnulando] = useState<Fila | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pagado, setPagado] = useState<number | null>(null)
  const [devolucion, setDevolucion] = useState<string | null>(null) // null = saldo a favor

  useEffect(() => {
    if (!anulando) return
    setPagado(null)
    setDevolucion(anulando.customer_id ? null : 'efectivo')
    supabase.from('payments').select('amount').eq('order_id', anulando.id).eq('kind', 'venta')
      .then(({ data }) => setPagado((data ?? []).reduce((a, x: { amount: number }) => a + x.amount, 0)))
  }, [anulando])

  const cargar = useCallback(async () => {
    let q = supabase.from('orders').select('*, customers(full_name), order_items(*)')
    if (tab === 'abiertos') q = q.eq('status', 'abierto').order('created_at')
    else {
      const inicio = new Date(); inicio.setHours(0, 0, 0, 0)
      q = q.neq('status', 'abierto').gte('closed_at', inicio.toISOString()).order('closed_at', { ascending: false })
    }
    const { data } = await q
    setFilas((data as Fila[]) ?? [])
  }, [tab])

  useEffect(() => {
    setFilas(null)
    cargar()
    const t = window.setInterval(cargar, 30000)
    return () => window.clearInterval(t)
  }, [cargar])

  function editar(f: Fila) {
    if (carrito.items.length && carrito.editando?.id !== f.id) {
      toast('Tienes otro pedido en curso. Guárdalo o cóbralo antes de editar este.', true)
      return
    }
    const items: ItemPedido[] = f.order_items.map((i) => ({
      key: crypto.randomUUID(),
      product_id: i.product_id,
      name: i.name,
      icon: productos.find((p) => p.id === i.product_id)?.icon ?? '🍽️',
      unit_price: i.unit_price,
      quantity: i.quantity,
      options: i.options ?? [],
      note: i.note ?? '',
    }))
    carrito.cargar(
      { id: f.id, number: f.number },
      items,
      f.customer_id ? { tipo: 'cuenta', id: f.customer_id, nombre: f.customers?.full_name ?? '' } : { tipo: 'ocasional', nombre: f.guest_name ?? '' },
    )
    nav('/pedido')
  }

  async function anular() {
    if (!anulando) return
    const { error } = await supabase.rpc('void_order', {
      p_order_id: anulando.id, p_reason: motivo, p_refund_method: pagado ? devolucion : null,
    })
    if (error) return toast(error.message, true)
    toast(`Pedido #${anulando.number} anulado` + (pagado ? (devolucion ? ' · devolución registrada' : ' · quedó saldo a favor') : ''))
    setAnulando(null)
    setMotivo('')
    cargar()
  }

  const total = (filas ?? []).filter((f) => f.status !== 'anulado').reduce((a, f) => a + f.total, 0)

  return (
    <div className="screen">
      <div className="top">
        <h1>Pedidos</h1>
        {filas && <span className="muted" style={{ fontWeight: 800, fontSize: 13 }}>{filas.length} · {pesos(total)}</span>}
      </div>
      <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
        <button className={tab === 'abiertos' ? 'on' : ''} onClick={() => setTab('abiertos')}>Abiertos</button>
        <button className={tab === 'hoy' ? 'on' : ''} onClick={() => setTab('hoy')}>Cerrados hoy</button>
      </div>

      {!filas ? (
        <div className="empty">Cargando…</div>
      ) : filas.length === 0 ? (
        <div className="empty">
          <b>{tab === 'abiertos' ? 'No hay pedidos abiertos' : 'Aún no hay ventas cerradas hoy'}</b>
          {tab === 'abiertos' ? 'Los pedidos que guardes sin cobrar aparecerán aquí.' : ''}
        </div>
      ) : (
        <div className="orders">
          {filas.map((f) => {
            const nombre = f.customers?.full_name ?? f.guest_name ?? ''
            const tarde = f.status === 'abierto' && Date.now() - new Date(f.created_at).getTime() > 30 * 60000
            return (
              <div key={f.id} className={'ord' + (tarde ? ' late' : '')}>
                <div className="oh">
                  <span>#{f.number}{f.status === 'anulado' ? ' · ANULADO' : ''}</span>
                  <span className="tm">{f.status === 'abierto' ? hace(f.created_at) : horaCorta(f.closed_at!)}</span>
                </div>
                <div className="ow">
                  <div className="av">{f.customer_id ? iniciales(nombre) : '🙋'}</div>
                  <div className="tx">
                    <b>{nombre} {!f.customer_id && <span className="tag oc">OCASIONAL</span>}</b>
                    <small>{f.order_items.map((i) => (i.quantity > 1 ? `${i.quantity} ` : '') + i.name).join(', ')}</small>
                    {f.status === 'anulado' && f.cancel_reason && <small className="muted">Motivo: {f.cancel_reason}</small>}
                  </div>
                </div>
                <div className="of">
                  <span className="tot" style={f.status === 'anulado' ? { textDecoration: 'line-through' } : undefined}>{pesos(f.total)}</span>
                  {staff?.role === 'admin' && f.status !== 'anulado' && (
                    <button className="mini" onClick={() => setAnulando(f)}>Anular</button>
                  )}
                  {f.status === 'abierto' && (
                    <>
                      <button className="mini" onClick={() => editar(f)}>Editar</button>
                      <Link className="mini pri" to={'/cobro/' + f.id}>Cobrar</Link>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {anulando && (
        <>
          <div className="dim" onClick={() => setAnulando(null)} />
          <div className="sheet" role="dialog" aria-label="Anular pedido">
            <div className="grab" />
            <div className="sh-top"><div><b>Anular pedido #{anulando.number}</b><small>{pesos(anulando.total)} · queda registrado quién lo anuló y por qué. Lo que se cargó a la cuenta se descuenta del saldo y lo vendido vuelve al inventario.</small></div></div>
            <label className="field"><span>MOTIVO</span><input id="motivo" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: se registró dos veces" /></label>
            {pagado === null ? (
              <div className="muted">Revisando pagos…</div>
            ) : pagado > 0 && (
              <div className="grp">
                <div className="l">Ya se habían pagado {pesos(pagado)}. ¿Qué hacemos con ese dinero?</div>
                <div className="chips">
                  {anulando.customer_id && (
                    <button className={'ch' + (devolucion === null ? ' on' : '')} onClick={() => setDevolucion(null)}>Dejar saldo a favor</button>
                  )}
                  {METODOS.map((m) => (
                    <button key={m.id} className={'ch' + (devolucion === m.id ? ' on' : '')} onClick={() => setDevolucion(m.id)}>Devolví por {m.nombre}</button>
                  ))}
                </div>
              </div>
            )}
            <button className="btn danger" disabled={!motivo.trim() || pagado === null} onClick={anular}>Anular pedido</button>
          </div>
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useCarrito, useToast } from '../lib/store'
import { METODOS, NEGOCIO, type Metodo } from '../lib/config'
import { fechaCorta, horaCorta, hoyBogota, iniciales, inicioDia, pesos, primerNombre, telefonoWhatsApp } from '../lib/format'
import type { Cliente, Movimiento, OpcionElegida } from '../lib/types'
import NuevoCliente, { normalizarNombre } from './NuevoCliente'

type LineaPedido = { name: string; quantity: number; unit_price: number; options: OpcionElegida[] | null; note: string | null }
type Mov = Movimiento & {
  orders: { number: number; total: number; status: 'abierto' | 'cobrado' | 'anulado'; note: string | null; created_at: string; order_items: LineaPedido[] } | null
}

const opcionesTexto = (l: LineaPedido) => (l.options ?? []).map((o) => o.name).join(', ')

/** Movimientos desde la última vez que la cuenta quedó en cero (en orden cronológico). */
export function movimientosPendientes(movs: Mov[]) {
  const asc = [...movs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  let corte = 0
  let saldo = 0
  asc.forEach((m, i) => {
    saldo += m.amount
    if (saldo <= 0) corte = i + 1
  })
  return asc.slice(corte)
}

const detalle = (m: Mov) =>
  m.orders ? m.orders.order_items.map((i) => (i.quantity > 1 ? `${i.quantity} ` : '') + i.name).join(', ') : m.description ?? ''

export function mensajeWhatsApp(cliente: Cliente, saldo: number, movs: Mov[]) {
  const pend = movimientosPendientes(movs)
  const lineas = pend.map((m) =>
    m.kind === 'cargo'
      ? `• ${fechaCorta(m.created_at)}: ${detalle(m)} — ${pesos(m.amount)}`
      : `• ${fechaCorta(m.created_at)}: ${m.kind === 'abono' ? 'Abono' : 'Ajuste'} — ${pesos(m.amount)}`,
  )
  return [
    `Hola ${primerNombre(cliente.full_name)} 👋 Te enviamos el resumen de tu cuenta en ${NEGOCIO.nombre}.`,
    '',
    ...(lineas.length ? lineas : ['No tienes consumos pendientes.']),
    '',
    `*Saldo pendiente: ${pesos(Math.max(0, saldo))}*`,
    '',
    `Puedes pagar por ${NEGOCIO.pago}`,
    '¡Gracias! 🌸',
  ].join('\n')
}

export default function ClientePage() {
  const { id } = useParams()
  const { staff } = useAuth()
  const carrito = useCarrito()
  const toast = useToast()
  const nav = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [movs, setMovs] = useState<Mov[]>([])
  const [saldo, setSaldo] = useState(0)
  const [hoja, setHoja] = useState<'abono' | 'whatsapp' | 'editar' | 'consumo' | 'unir' | null>(null)
  const [pedido, setPedido] = useState<Mov | null>(null)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: c }, { data: m }, { data: b }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id!).single(),
      supabase.from('account_entries').select('*, orders(number, total, status, note, created_at, order_items(name, quantity, unit_price, options, note))').eq('customer_id', id!).order('created_at', { ascending: false }).limit(200),
      supabase.from('customer_balances').select('balance').eq('customer_id', id!).maybeSingle(),
    ])
    setCliente(c as Cliente)
    setMovs((m as Mov[]) ?? [])
    setSaldo((b?.balance as number) ?? 0)
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  if (!cliente) return <div className="empty">Cargando…</div>

  const montoNum = Number(monto) || 0
  const tel = telefonoWhatsApp(cliente.phone)

  async function abonar() {
    setEnviando(true)
    const { data, error } = await supabase.rpc('register_abono', { p_customer_id: cliente!.id, p_amount: montoNum, p_method: metodo })
    setEnviando(false)
    if (error) return toast(error.message, true)
    toast(`Abono registrado. Saldo: ${pesos(data as number)}`)
    setMonto('')
    await cargar()
    setHoja(tel ? 'whatsapp' : null)
  }

  async function bloquear() {
    const { error } = await supabase.from('customers').update({ blocked: !cliente!.blocked }).eq('id', cliente!.id)
    if (error) return toast(error.message, true)
    toast(cliente!.blocked ? 'Cuenta desbloqueada' : 'Cuenta bloqueada: solo podrá pagar de contado')
    cargar()
  }

  function vender() {
    if (carrito.items.length && carrito.editando) return toast('Termina primero el pedido que estás editando', true)
    carrito.setCliente({ tipo: 'cuenta', id: cliente!.id, nombre: cliente!.full_name })
    nav('/')
  }

  const texto = mensajeWhatsApp(cliente, saldo, movs)
  const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`

  return (
    <div className="screen">
      <div className="top">
        <Link className="round" to="/clientes" aria-label="Volver">‹</Link>
        <h1></h1>
        <button className="mini" onClick={() => setHoja('editar')}>Editar</button>
      </div>
      <div className="prof">
        <div className="av">{iniciales(cliente.full_name)}</div>
        <b>{cliente.full_name}</b>
        <small>{[cliente.cedula && 'C.C. ' + cliente.cedula, cliente.phone].filter(Boolean).join(' · ') || 'Sin cédula ni celular'}</small>
        {cliente.blocked && <span className="tag blo">BLOQUEADA</span>}
      </div>
      <div className={'big-bal' + (saldo <= 0 ? ' zero' : '')}>
        <small>{saldo > 0 ? 'SALDO PENDIENTE' : saldo < 0 ? 'SALDO A FAVOR' : 'AL DÍA'}</small>
        <b>{pesos(Math.abs(saldo))}</b>
      </div>
      <div className="acts">
        <button className="act" onClick={() => setHoja('abono')}><i>💵</i>Abonar</button>
        <button className="act wa" onClick={() => setHoja('whatsapp')}><i>💬</i>WhatsApp</button>
        <button className="act" onClick={vender}><i>🛍️</i>Vender</button>
      </div>

      <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Movimientos</span>
        {movs.some((m) => m.orders) && <button className="mini" onClick={() => setHoja('consumo')}>Consumo por producto</button>}
      </div>
      {movs.length === 0 ? (
        <div className="empty">Aún no hay movimientos en la cuenta.</div>
      ) : (
        <div className="box">
          {movs.map((m) => {
            const Fila = m.orders ? 'button' : 'div'
            return (
            <Fila key={m.id} className="row-i" {...(m.orders ? { onClick: () => setPedido(m), 'aria-label': `Ver pedido #${m.orders.number}` } : {})}>
              <div className="art" style={{ ['--c' as string]: m.amount > 0 ? 'var(--orange-soft)' : 'var(--green-soft)' }}>
                {m.kind === 'cargo' ? '🧾' : m.kind === 'abono' ? '💵' : '↩️'}
              </div>
              <div className="tx">
                <b>{m.orders ? `Pedido #${m.orders.number}` : m.description}</b>
                <small>{fechaCorta(m.created_at)} {horaCorta(m.created_at)}{m.orders ? ' · ' + detalle(m) : ''}</small>
              </div>
              <span className={'am ' + (m.amount > 0 ? 'up' : 'down')}>{m.amount > 0 ? '+' : '−'}{pesos(Math.abs(m.amount))}</span>
              {m.orders && <span className="muted" aria-hidden="true">›</span>}
            </Fila>
            )
          })}
        </div>
      )}

      {staff?.role === 'admin' && (
        <div style={{ padding: '16px' }}>
          <button className="btn ghost" style={{ width: '100%', marginBottom: 10 }} onClick={() => setHoja('unir')}>Unir con otra cuenta (cliente repetido)</button>
          <button className="btn ghost" style={{ width: '100%' }} onClick={bloquear}>
            {cliente.blocked ? 'Desbloquear cuenta' : 'Bloquear cuenta (solo pago de contado)'}
          </button>
        </div>
      )}

      {hoja === 'abono' && (
        <>
          <div className="dim" onClick={() => setHoja(null)} />
          <div className="sheet" role="dialog" aria-label="Registrar abono">
            <div className="grab" />
            <div className="sh-top"><div><b>Abono de {primerNombre(cliente.full_name)}</b><small>Saldo actual {pesos(saldo)}</small></div></div>
            <label className="field big">
              <span>MONTO</span>
              <input id="monto" inputMode="numeric" autoFocus placeholder="$0" value={montoNum ? pesos(montoNum) : ''} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} />
            </label>
            {saldo > 0 && (
              <button className="mini" style={{ alignSelf: 'flex-start' }} onClick={() => setMonto(String(saldo))}>Pagar todo ({pesos(saldo)})</button>
            )}
            <div className="pays">
              {METODOS.map((m) => (
                <button key={m.id} className={'pay' + (metodo === m.id ? ' on' : '')} onClick={() => setMetodo(m.id)}><i>{m.icono}</i>{m.nombre}</button>
              ))}
            </div>
            {montoNum > 0 && <div className="newbal" style={{ margin: 0 }}><span>Queda</span><b>{pesos(saldo - montoNum)}</b></div>}
            <button className="btn ok" disabled={!montoNum || enviando} onClick={abonar}>Guardar abono</button>
          </div>
        </>
      )}

      {hoja === 'whatsapp' && (
        <>
          <div className="dim" onClick={() => setHoja(null)} />
          <div className="sheet" role="dialog" aria-label="Resumen por WhatsApp">
            <div className="grab" />
            <div className="sh-top"><div><b>Resumen para {primerNombre(cliente.full_name)}</b><small>{tel ? 'Se abre WhatsApp con este mensaje; tú lo envías.' : 'Este cliente no tiene celular registrado.'}</small></div></div>
            <div className="bubble">{texto}</div>
            {tel ? (
              <a className="btn wa" href={waUrl} target="_blank" rel="noreferrer" onClick={() => setHoja(null)}>Abrir WhatsApp</a>
            ) : (
              <button className="btn soft" onClick={() => setHoja('editar')}>Agregar celular</button>
            )}
          </div>
        </>
      )}

      {pedido?.orders && <DetallePedido m={pedido} onClose={() => setPedido(null)} onConsumo={() => { setPedido(null); setHoja('consumo') }} />}
      {hoja === 'consumo' && <ConsumoSheet clienteId={cliente.id} nombre={primerNombre(cliente.full_name)} pendientes={movimientosPendientes(movs)} onClose={() => setHoja(null)} />}

      {hoja === 'unir' && <UnirSheet cliente={cliente} onClose={() => setHoja(null)} onUnido={() => { setHoja(null); cargar() }} />}

      {hoja === 'editar' && (
        <NuevoCliente cliente={cliente} onClose={() => setHoja(null)} onCreado={() => { setHoja(null); cargar() }} />
      )}
    </div>
  )
}

/** Detalle de un pedido de la cuenta: producto por producto. */
function DetallePedido({ m, onClose, onConsumo }: { m: Mov; onClose: () => void; onConsumo: () => void }) {
  const o = m.orders!
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Pedido #${o.number}`}>
        <div className="grab" />
        <div className="sh-top">
          <div className="art">🧾</div>
          <div>
            <b>Pedido #{o.number} {o.status === 'anulado' && <span className="tag blo">ANULADO</span>}{o.status === 'abierto' && <span className="tag oc">ABIERTO</span>}</b>
            <small>{fechaCorta(m.created_at)} {horaCorta(m.created_at)}</small>
          </div>
        </div>
        <div>
          {o.order_items.map((l, i) => (
            <div key={i} className="rc" style={{ borderBottom: '1px dashed var(--line)', alignItems: 'flex-start' }}>
              <span>
                <b>{l.quantity} × {l.name}</b>
                {opcionesTexto(l) && <small className="muted" style={{ display: 'block' }}>{opcionesTexto(l)}</small>}
                {l.note && <small className="muted" style={{ display: 'block' }}>Nota: {l.note}</small>}
                {l.quantity > 1 && <small className="muted" style={{ display: 'block' }}>{pesos(l.unit_price)} c/u</small>}
              </span>
              <span className="v">{pesos(l.unit_price * l.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="sum" style={{ margin: 0 }}><span>Total</span><span className="v" style={o.status === 'anulado' ? { textDecoration: 'line-through' } : undefined}>{pesos(o.total)}</span></div>
        {o.note && <p className="note" style={{ margin: 0 }}>Nota del pedido: {o.note}</p>}
        <button className="btn soft" onClick={onConsumo}>Ver todo lo consumido por producto</button>
      </div>
    </>
  )
}

type Consumo = { name: string; cantidad: number; total: number; pedidos: number }

/** Todo lo que el cliente ha consumido, agrupado por producto (sin pedidos anulados). */
function ConsumoSheet({ clienteId, nombre, pendientes, onClose }: { clienteId: string; nombre: string; pendientes: Mov[]; onClose: () => void }) {
  const [rango, setRango] = useState<'pendiente' | 'mes' | 'todo'>('pendiente')
  const [lineas, setLineas] = useState<(LineaPedido & { order_id: string; orders: { created_at: string } })[] | null>(null)

  useEffect(() => {
    supabase.from('order_items')
      .select('name, quantity, unit_price, options, note, order_id, orders!inner(customer_id, status, created_at)')
      .eq('orders.customer_id', clienteId).neq('orders.status', 'anulado')
      .then(({ data }) => setLineas((data as never) ?? []))
  }, [clienteId])

  const filas = useMemo(() => {
    if (!lineas) return null
    const idsPend = new Set(pendientes.filter((m) => m.kind === 'cargo' && m.order_id).map((m) => m.order_id))
    const inicioMes = hoyBogota().slice(0, 8) + '01'
    const elegidas = lineas.filter((l) =>
      rango === 'todo' ? true : rango === 'pendiente' ? idsPend.has(l.order_id) : l.orders.created_at >= inicioDia(inicioMes))
    const map = new Map<string, Consumo & { ids: Set<string> }>()
    for (const l of elegidas) {
      const c = map.get(l.name) ?? { name: l.name, cantidad: 0, total: 0, pedidos: 0, ids: new Set<string>() }
      c.cantidad += l.quantity
      c.total += l.quantity * l.unit_price
      c.ids.add(l.order_id)
      c.pedidos = c.ids.size
      map.set(l.name, c)
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  }, [lineas, rango, pendientes])

  const total = (filas ?? []).reduce((a, f) => a + f.total, 0)
  const unidades = (filas ?? []).reduce((a, f) => a + f.cantidad, 0)

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Consumo por producto">
        <div className="grab" />
        <div className="sh-top"><div className="art">📊</div><div><b>Lo que ha consumido {nombre}</b><small>Agrupado por producto · sin pedidos anulados</small></div></div>
        <div className="seg" style={{ margin: 0 }}>
          <button className={rango === 'pendiente' ? 'on' : ''} onClick={() => setRango('pendiente')}>Por pagar</button>
          <button className={rango === 'mes' ? 'on' : ''} onClick={() => setRango('mes')}>Este mes</button>
          <button className={rango === 'todo' ? 'on' : ''} onClick={() => setRango('todo')}>Todo</button>
        </div>
        {!filas ? <div className="empty" style={{ margin: 0 }}>Cargando…</div> : filas.length === 0 ? (
          <div className="empty" style={{ margin: 0 }}>{rango === 'pendiente' ? 'No tiene consumos pendientes por pagar.' : 'No hay consumos en este periodo.'}</div>
        ) : (
          <div>
            {filas.map((f) => (
              <div key={f.name} className="rc" style={{ borderBottom: '1px dashed var(--line)' }}>
                <span><b>{f.cantidad} × {f.name}</b><small className="muted" style={{ display: 'block' }}>{f.pedidos === 1 ? '1 pedido' : `${f.pedidos} pedidos`}</small></span>
                <span className="v">{pesos(f.total)}</span>
              </div>
            ))}
          </div>
        )}
        {filas && filas.length > 0 && <div className="sum" style={{ margin: 0 }}><span>{unidades} {unidades === 1 ? 'producto' : 'productos'}</span><span className="v">{pesos(total)}</span></div>}
        {rango === 'pendiente' && <p className="note" style={{ margin: 0 }}>"Por pagar" son los pedidos desde la última vez que la cuenta quedó en cero.</p>}
      </div>
    </>
  )
}

/** Pasa todo lo de otra cuenta (pedidos, abonos, saldo) a esta y borra la otra. Solo administradora. */
function UnirSheet({ cliente, onClose, onUnido }: { cliente: Cliente; onClose: () => void; onUnido: () => void }) {
  const toast = useToast()
  const [otros, setOtros] = useState<(Cliente & { balance: number })[] | null>(null)
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<(Cliente & { balance: number }) | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('*').neq('id', cliente.id).order('full_name'),
      supabase.from('customer_balances').select('customer_id, balance'),
    ]).then(([{ data: c }, { data: b }]) => {
      const saldo = new Map(((b ?? []) as { customer_id: string; balance: number }[]).map((x) => [x.customer_id, x.balance]))
      setOtros(((c as Cliente[]) ?? []).map((x) => ({ ...x, balance: saldo.get(x.id) ?? 0 })))
    })
  }, [cliente.id])

  const mismo = normalizarNombre(cliente.full_name)
  const lista = useMemo(() => {
    const t = normalizarNombre(q)
    return (otros ?? [])
      .filter((o) => (t ? normalizarNombre(o.full_name).includes(t) || (o.cedula ?? '').includes(t) : normalizarNombre(o.full_name) === mismo))
  }, [otros, q, mismo])

  async function unir() {
    if (!elegido) return
    setEnviando(true)
    const { error } = await supabase.rpc('merge_customers', { p_keep: cliente.id, p_remove: elegido.id })
    setEnviando(false)
    if (error) return toast(error.code === 'PGRST202' ? 'Falta activar esta función en la base de datos' : error.message, true)
    toast(`Listo: lo de la otra cuenta quedó en la de ${cliente.full_name}`)
    onUnido()
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Unir cuentas">
        <div className="grab" />
        <div className="sh-top"><div className="art">🔗</div><div><b>Unir con otra cuenta</b><small>Todo pasa a esta cuenta y la otra se borra</small></div></div>
        {!elegido ? (
          <>
            <label className="search" style={{ margin: 0 }}>
              <span aria-hidden="true">🔍</span>
              <input id="unir-buscar" placeholder="Buscar otro cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {!otros ? <div className="empty" style={{ margin: 0 }}>Cargando…</div> : (
              <div>
                {!q && lista.length > 0 && <small className="muted">Con el mismo nombre:</small>}
                {lista.map((o) => (
                  <button key={o.id} className="row-i" onClick={() => setElegido(o)}>
                    <div className="tx">
                      <b>{o.full_name}</b>
                      <small>{[o.cedula && 'C.C. ' + o.cedula, o.phone].filter(Boolean).join(' · ') || 'Sin cédula ni celular'}</small>
                    </div>
                    <span className="muted">{pesos(o.balance)}</span>
                  </button>
                ))}
                {lista.length === 0 && <div className="empty" style={{ margin: 0 }}>{q ? 'No hay coincidencias.' : 'No hay otra cuenta con el mismo nombre. Busca por nombre o cédula.'}</div>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="alert info" style={{ margin: 0 }}>
              Los pedidos, abonos y el saldo de <b>{elegido.full_name}</b>{elegido.cedula ? ` (C.C. ${elegido.cedula})` : ''} pasan a esta cuenta
              {elegido.balance !== 0 ? ` (${elegido.balance > 0 ? 'debe' : 'a favor'} ${pesos(Math.abs(elegido.balance))})` : ''}. Si a esta cuenta le falta la cédula o el celular, se toman de la otra. Esto no se puede deshacer.
            </div>
            <button className="btn" disabled={enviando} onClick={unir}>Unir cuentas</button>
            <button className="btn soft" onClick={() => setElegido(null)}>Elegir otra</button>
          </>
        )}
      </div>
    </>
  )
}

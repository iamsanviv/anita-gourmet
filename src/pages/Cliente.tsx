import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useCarrito, useToast } from '../lib/store'
import { METODOS, NEGOCIO, type Metodo } from '../lib/config'
import { fechaCorta, horaCorta, iniciales, pesos, primerNombre, telefonoWhatsApp } from '../lib/format'
import type { Cliente, Movimiento } from '../lib/types'
import NuevoCliente from './NuevoCliente'

type Mov = Movimiento & { orders: { number: number; order_items: { name: string; quantity: number }[] } | null }

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
  const [hoja, setHoja] = useState<'abono' | 'whatsapp' | 'editar' | null>(null)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: c }, { data: m }, { data: b }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id!).single(),
      supabase.from('account_entries').select('*, orders(number, order_items(name, quantity))').eq('customer_id', id!).order('created_at', { ascending: false }).limit(200),
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

      <div className="lbl">Movimientos</div>
      {movs.length === 0 ? (
        <div className="empty">Aún no hay movimientos en la cuenta.</div>
      ) : (
        <div className="box">
          {movs.map((m) => (
            <div key={m.id} className="row-i">
              <div className="art" style={{ ['--c' as string]: m.amount > 0 ? 'var(--orange-soft)' : 'var(--green-soft)' }}>
                {m.kind === 'cargo' ? '🧾' : m.kind === 'abono' ? '💵' : '↩️'}
              </div>
              <div className="tx">
                <b>{m.orders ? `Pedido #${m.orders.number}` : m.description}</b>
                <small>{fechaCorta(m.created_at)} {horaCorta(m.created_at)}{m.orders ? ' · ' + detalle(m) : ''}</small>
              </div>
              <span className={'am ' + (m.amount > 0 ? 'up' : 'down')}>{m.amount > 0 ? '+' : '−'}{pesos(Math.abs(m.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {staff?.role === 'admin' && (
        <div style={{ padding: '16px' }}>
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

      {hoja === 'editar' && (
        <NuevoCliente cliente={cliente} onClose={() => setHoja(null)} onCreado={() => { setHoja(null); cargar() }} />
      )}
    </div>
  )
}

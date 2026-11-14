import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import { METODOS, type Metodo } from '../lib/config'
import { iniciales, pesos, primerNombre } from '../lib/format'
import type { Cliente, Pedido } from '../lib/types'

type Modo = 'ahora' | 'cuenta' | 'mixto'

export default function Cobro() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [saldo, setSaldo] = useState(0)
  const [modo, setModo] = useState<Modo>('ahora')
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [abono, setAbono] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: o } = await supabase.from('orders').select('*').eq('id', id!).single()
      if (!o) return
      setPedido(o as Pedido)
      if (o.customer_id) {
        const [{ data: c }, { data: b }] = await Promise.all([
          supabase.from('customers').select('*').eq('id', o.customer_id).single(),
          supabase.from('customer_balances').select('balance').eq('customer_id', o.customer_id).maybeSingle(),
        ])
        setCliente(c as Cliente)
        setSaldo((b?.balance as number) ?? 0)
      }
    })()
  }, [id])

  if (!pedido) return <div className="empty">Cargando…</div>
  if (pedido.status !== 'abierto')
    return (
      <div className="screen">
        <div className="top"><Link className="round" to="/pedidos" aria-label="Volver">‹</Link><h1>Pedido #{pedido.number}</h1></div>
        <div className="empty"><b>Este pedido ya está {pedido.status}</b></div>
      </div>
    )

  const puedeCuenta = Boolean(cliente) && !cliente?.blocked
  const total = pedido.total
  const pagaAhora = modo === 'ahora' ? total : modo === 'cuenta' ? 0 : Math.min(total, Number(abono.replace(/\D/g, '')) || 0)
  const aCuenta = total - pagaAhora
  const nombre = cliente?.full_name ?? pedido.guest_name ?? ''
  const mixtoInvalido = modo === 'mixto' && (pagaAhora <= 0 || pagaAhora >= total)

  async function confirmar() {
    setEnviando(true)
    const { error } = await supabase.rpc('checkout_order', {
      p_order_id: pedido!.id,
      p_pay_now: pagaAhora,
      p_method: pagaAhora > 0 ? metodo : null,
    })
    setEnviando(false)
    if (error) return toast(error.message, true)
    toast(`Venta #${pedido!.number} registrada`)
    nav('/')
  }

  return (
    <div className="screen">
      <div className="top">
        <Link className="round" to="/pedidos" aria-label="Volver">‹</Link>
        <h1>Cobrar {pesos(total)}</h1>
      </div>

      <div className="who-card">
        <div className="av">{iniciales(nombre)}</div>
        <div className="tx">
          <b>{nombre}</b>
          <small>{cliente ? (cliente.blocked ? 'Cuenta bloqueada' : 'Cliente con cuenta') : 'Cliente ocasional'} · Pedido #{pedido.number}</small>
        </div>
        {cliente && <div className="bx"><small>Saldo actual</small><b>{pesos(saldo)}</b></div>}
      </div>

      {cliente?.blocked && <div className="alert">Esta cuenta está bloqueada: debe pagar el total ahora.</div>}
      {!cliente && <div className="alert">Cliente ocasional: debe pagar el total ahora.</div>}

      <div className="lbl">¿Cómo paga?</div>
      <div className="seg" role="tablist">
        <button className={modo === 'ahora' ? 'on' : ''} onClick={() => setModo('ahora')}>Ahora</button>
        {puedeCuenta && <button className={modo === 'cuenta' ? 'on' : ''} onClick={() => setModo('cuenta')}>A la cuenta</button>}
        {puedeCuenta && <button className={modo === 'mixto' ? 'on' : ''} onClick={() => setModo('mixto')}>Mixto</button>}
      </div>

      {modo !== 'cuenta' && (
        <div className="panel">
          {modo === 'mixto' && (
            <label className="field big">
              <span>PAGA AHORA</span>
              <input id="paga-ahora" inputMode="numeric" placeholder="$0" value={abono ? pesos(Number(abono.replace(/\D/g, ''))) : ''} onChange={(e) => setAbono(e.target.value.replace(/\D/g, ''))} />
            </label>
          )}
          <div className="pays">
            {METODOS.map((m) => (
              <button key={m.id} className={'pay' + (metodo === m.id ? ' on' : '')} onClick={() => setMetodo(m.id)}>
                <i>{m.icono}</i>{m.nombre}
              </button>
            ))}
          </div>
          {modo === 'mixto' && (
            <>
              <div className="bar"><i style={{ width: `${(pagaAhora / total) * 100}%` }} /></div>
              <div className="legend"><span className="a">Pagado {pesos(pagaAhora)}</span><span className="b">A la cuenta {pesos(aCuenta)}</span></div>
            </>
          )}
        </div>
      )}

      {cliente && aCuenta > 0 && (
        <div className="newbal"><span>Nuevo saldo de {primerNombre(cliente.full_name)}</span><b>{pesos(saldo + aCuenta)}</b></div>
      )}

      <div className="dock">
        <button className="btn ok" disabled={enviando || mixtoInvalido} onClick={confirmar}>✓ Confirmar venta</button>
      </div>
    </div>
  )
}

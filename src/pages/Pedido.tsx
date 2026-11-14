import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCarrito, useToast } from '../lib/store'
import { iniciales, pesos } from '../lib/format'
import type { Cliente } from '../lib/types'
import NuevoCliente from './NuevoCliente'

type ClienteSaldo = Cliente & { balance: number }

/** Busca clientes por nombre o cédula e incluye su saldo. */
export async function buscarClientes(q: string, limite = 8): Promise<ClienteSaldo[]> {
  let query = supabase.from('customers').select('*').order('full_name').limit(limite)
  const t = q.trim().replace(/[%,()]/g, '')
  if (t) query = query.or(`full_name.ilike.%${t}%,cedula.ilike.%${t}%`)
  const { data } = await query
  const clientes = (data as Cliente[]) ?? []
  if (!clientes.length) return []
  const { data: saldos } = await supabase.from('customer_balances').select('customer_id, balance').in('customer_id', clientes.map((c) => c.id))
  const mapa = new Map((saldos ?? []).map((s: { customer_id: string; balance: number }) => [s.customer_id, s.balance]))
  return clientes.map((c) => ({ ...c, balance: mapa.get(c.id) ?? 0 }))
}

export default function PedidoPage() {
  const carrito = useCarrito()
  const toast = useToast()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ClienteSaldo[]>([])
  const [modo, setModo] = useState<'buscar' | 'ocasional'>(carrito.cliente?.tipo === 'ocasional' ? 'ocasional' : 'buscar')
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [notaDe, setNotaDe] = useState<string | null>(null)

  useEffect(() => {
    if (modo !== 'buscar') return
    const t = window.setTimeout(() => buscarClientes(q).then(setResultados), 250)
    return () => window.clearTimeout(t)
  }, [q, modo])

  if (carrito.items.length === 0)
    return (
      <div className="screen">
        <div className="top"><Link className="round" to="/" aria-label="Volver">‹</Link><h1>Tu pedido</h1></div>
        <div className="empty"><b>El pedido está vacío</b>Agrega productos desde Vender.</div>
      </div>
    )

  const c = carrito.cliente
  const listo = c && (c.tipo === 'cuenta' || c.nombre.trim().length > 0)

  async function guardar(): Promise<string | null> {
    if (!c) { toast('Elige el cliente', true); return null }
    setGuardando(true)
    const { data, error } = await supabase.rpc('save_order', {
      p_order_id: carrito.editando?.id ?? null,
      p_customer_id: c.tipo === 'cuenta' ? c.id : null,
      p_guest_name: c.tipo === 'ocasional' ? c.nombre : null,
      p_items: carrito.items.map(({ product_id, name, unit_price, quantity, options, note }) => ({ product_id, name, unit_price, quantity, options, note })),
    })
    setGuardando(false)
    if (error) { toast(error.message, true); return null }
    return (data as { id: string; number: number }).id
  }

  async function guardarYSalir() {
    const id = await guardar()
    if (!id) return
    toast(carrito.editando ? `Pedido #${carrito.editando.number} actualizado` : 'Pedido guardado')
    carrito.vaciar()
    nav('/pedidos')
  }

  async function cobrar() {
    const id = await guardar()
    if (!id) return
    carrito.vaciar()
    nav('/cobro/' + id)
  }

  return (
    <div className="screen">
      <div className="top">
        <Link className="round" to="/" aria-label="Volver">‹</Link>
        <h1>{carrito.editando ? `Pedido #${carrito.editando.number}` : 'Tu pedido'}</h1>
      </div>

      <div className="box">
        {carrito.items.map((i) => (
          <div key={i.key}>
            <div className="row-i">
              <div className="art">{i.icon}</div>
              <div className="tx">
                <b>{i.name}</b>
                {i.options.length > 0 && <small>{i.options.map((o) => o.name).join(' · ')}</small>}
                {i.note && <small className="nt">“{i.note}”</small>}
                <button className="mini link" onClick={() => setNotaDe(notaDe === i.key ? null : i.key)}>
                  {i.note ? 'Editar nota' : '+ Nota'}
                </button>
              </div>
              <div className="stepper" style={{ padding: '4px 6px', gap: 8 }}>
                <button aria-label="Quitar uno" onClick={() => carrito.cambiarCantidad(i.key, -1)}>−</button>
                {i.quantity}
                <button aria-label="Agregar uno" onClick={() => carrito.cambiarCantidad(i.key, 1)}>+</button>
              </div>
              <span className="p">{pesos(i.unit_price * i.quantity)}</span>
            </div>
            {notaDe === i.key && (
              <label className="field" style={{ margin: '0 0 10px' }}>
                <span>NOTA PARA COCINA</span>
                <input id={'nota-' + i.key} autoFocus value={i.note} onChange={(e) => carrito.setNota(i.key, e.target.value)} />
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="sum"><span>Total</span><span className="v">{pesos(carrito.total)}</span></div>

      <div className="lbl">¿Para quién es?</div>
      {c?.tipo === 'cuenta' ? (
        <div className="box">
          <div className="row-i sel">
            <div className="av">{iniciales(c.nombre)}</div>
            <div className="tx"><b>{c.nombre}</b><small>Cliente con cuenta</small></div>
            <button className="mini" onClick={() => carrito.setCliente(null)}>Cambiar</button>
          </div>
        </div>
      ) : modo === 'buscar' ? (
        <>
          <label className="search">
            <span aria-hidden="true">🔍</span>
            <input id="buscar-cliente" placeholder="Nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {resultados.length > 0 && (
            <div className="box" style={{ marginTop: 8 }}>
              {resultados.map((r) => (
                <button key={r.id} className="row-i" onClick={() => carrito.setCliente({ tipo: 'cuenta', id: r.id, nombre: r.full_name })}>
                  <div className="av">{iniciales(r.full_name)}</div>
                  <div className="tx"><b>{r.full_name}</b><small>{r.cedula ? 'C.C. ' + r.cedula : 'Sin cédula'}</small></div>
                  {r.blocked ? <span className="bal blo">Bloqueado</span> : r.balance > 0 ? <span className="bal debe">Debe {pesos(r.balance)}</span> : <span className="bal cero">Al día</span>}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <label className="field">
          <span>NOMBRE PROVISIONAL</span>
          <input id="ocasional" autoFocus placeholder="Ej.: Carlos" value={c?.tipo === 'ocasional' ? c.nombre : ''} onChange={(e) => carrito.setCliente({ tipo: 'ocasional', nombre: e.target.value })} />
        </label>
      )}

      {c?.tipo !== 'cuenta' && (
        <>
          <div className="lbl">¿No tiene cuenta?</div>
          <div className="nocta">
            <button className={'nc' + (modo === 'ocasional' ? ' on' : '')} onClick={() => { setModo(modo === 'ocasional' ? 'buscar' : 'ocasional'); if (modo === 'ocasional') carrito.setCliente(null) }}>
              <span className="e">🙋</span><b>Ocasional</b><small>Con nombre provisional</small>
            </button>
            <button className="nc" onClick={() => setCreando(true)}>
              <span className="e">➕</span><b>Crear cuenta</b><small>Nombre, cédula y celular</small>
            </button>
          </div>
        </>
      )}

      <div className="dock">
        <button className="btn soft" disabled={!listo || guardando} onClick={guardarYSalir}>Guardar pedido</button>
        <button className="btn" disabled={!listo || guardando} onClick={cobrar}>Cobrar ahora →</button>
      </div>

      {creando && (
        <NuevoCliente
          nombreInicial={c?.tipo === 'ocasional' ? c.nombre : q}
          onClose={() => setCreando(false)}
          onCreado={(cl) => { setCreando(false); setModo('buscar'); carrito.setCliente({ tipo: 'cuenta', id: cl.id, nombre: cl.full_name }) }}
        />
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import { NEGOCIO } from '../lib/config'
import { diaCorto, fechaCorta, hoyBogota, iniciales, inicioDia, nombreMes, pesos, primerNombre, telefonoWhatsApp } from '../lib/format'
import type { Cliente, Movimiento } from '../lib/types'

/** Corte del mes: el 1 del mes en curso. El resumen cubre el mes anterior. */
export function corteActual() {
  const corte = hoyBogota().slice(0, 8) + '01'
  const [y, m] = corte.split('-').map(Number)
  const anterior = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
  return { corte, anterior }
}

type Saldo = { customer_id: string; balance: number }

/** Cuántos clientes con saldo al corte aún no tienen su resumen enviado. */
export async function resumenesPendientes() {
  const { corte } = corteActual()
  const [{ data: b }, { data: s }] = await Promise.all([
    supabase.rpc('balances_at', { p_cut: inicioDia(corte) }),
    supabase.from('statement_sends').select('customer_id').eq('period', corte),
  ])
  const enviados = new Set((s ?? []).map((x: { customer_id: string }) => x.customer_id))
  return ((b as Saldo[]) ?? []).filter((x) => x.balance > 0 && !enviados.has(x.customer_id)).length
}

type Mov = Movimiento & { orders: { number: number; order_items: { name: string; quantity: number }[] } | null }
type Fila = { cliente: Cliente; saldo: number; previo: number; movs: Mov[]; enviado: string | null }

const detalle = (m: Mov) =>
  m.orders ? m.orders.order_items.map((i) => (i.quantity > 1 ? `${i.quantity} ` : '') + i.name).join(', ') : m.description ?? ''

export function mensajeMes(f: Fila, corte: string, anterior: string) {
  const mes = nombreMes(anterior).split(' ')[0]
  const cargos = f.movs.filter((m) => m.amount > 0)
  const otros = f.movs.filter((m) => m.amount <= 0)
  return [
    `Hola ${primerNombre(f.cliente.full_name)} 👋 Este es el resumen de tu cuenta en ${NEGOCIO.nombre} con corte al ${diaCorto(corte)}.`,
    '',
    ...(f.previo !== 0 ? [`${f.previo > 0 ? 'Saldo que venía' : 'Saldo a favor que tenías'} al ${diaCorto(anterior)}: ${pesos(Math.abs(f.previo))}`, ''] : []),
    ...(cargos.length ? [`Consumos de ${mes}:`, ...cargos.map((m) => `• ${fechaCorta(m.created_at)}: ${detalle(m)} — ${pesos(m.amount)}`), ''] : []),
    ...(otros.length ? ['Abonos y ajustes:', ...otros.map((m) => `• ${fechaCorta(m.created_at)}: ${m.kind === 'abono' ? 'Abono' : m.description ?? 'Ajuste'} — ${pesos(Math.abs(m.amount))}`), ''] : []),
    `*Total a pagar: ${pesos(f.saldo)}*`,
    '',
    `Puedes pagar por ${NEGOCIO.pago}`,
    '¡Gracias! 🌸',
  ].join('\n')
}

export default function Resumenes() {
  const nav = useNavigate()
  const toast = useToast()
  const { corte, anterior } = corteActual()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [abierta, setAbierta] = useState<Fila | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: b }, { data: bp }, { data: s }] = await Promise.all([
      supabase.rpc('balances_at', { p_cut: inicioDia(corte) }),
      supabase.rpc('balances_at', { p_cut: inicioDia(anterior) }),
      supabase.from('statement_sends').select('customer_id, sent_at').eq('period', corte),
    ])
    const conSaldo = ((b as Saldo[]) ?? []).filter((x) => x.balance > 0)
    const ids = conSaldo.map((x) => x.customer_id)
    if (!ids.length) return setFilas([])
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('customers').select('*').in('id', ids),
      supabase.from('account_entries').select('*, orders(number, order_items(name, quantity))')
        .in('customer_id', ids).gte('created_at', inicioDia(anterior)).lt('created_at', inicioDia(corte)).order('created_at'),
    ])
    const previo = new Map(((bp as Saldo[]) ?? []).map((x) => [x.customer_id, x.balance]))
    const env = new Map((s ?? []).map((x: { customer_id: string; sent_at: string }) => [x.customer_id, x.sent_at]))
    setFilas(conSaldo.map((x) => ({
      cliente: ((c as Cliente[]) ?? []).find((k) => k.id === x.customer_id)!,
      saldo: x.balance,
      previo: previo.get(x.customer_id) ?? 0,
      movs: ((m as Mov[]) ?? []).filter((k) => k.customer_id === x.customer_id),
      enviado: env.get(x.customer_id) ?? null,
    })).filter((f) => f.cliente).sort((a, z) => Number(!!a.enviado) - Number(!!z.enviado) || a.cliente.full_name.localeCompare(z.cliente.full_name)))
  }, [corte, anterior])
  useEffect(() => { cargar() }, [cargar])

  async function marcar(f: Fila) {
    const { error } = await supabase.from('statement_sends').upsert({ customer_id: f.cliente.id, period: corte, balance: f.saldo, sent_at: new Date().toISOString() })
    if (error) return toast(error.message, true)
    setAbierta(null)
    cargar()
  }

  const pendientes = (filas ?? []).filter((f) => !f.enviado).length
  const total = useMemo(() => (filas ?? []).reduce((a, f) => a + f.saldo, 0), [filas])

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/clientes')} aria-label="Volver">‹</button>
        <h1>Resúmenes de {nombreMes(anterior).split(' ')[0]}</h1>
      </div>
      <div className="sumcard">
        <small>SALDO AL CORTE · {diaCorto(corte).toUpperCase()}</small>
        <b>{pesos(total)}</b>
        <span>{filas ? `${filas.length} ${filas.length === 1 ? 'cliente' : 'clientes'} · ${pendientes} por enviar` : ''}</span>
      </div>
      <p className="note">Un mensaje al mes por cliente, con lo que consumió y abonó en {nombreMes(anterior)} y el saldo al corte. Se abre WhatsApp con el texto listo.</p>
      {!filas ? (
        <div className="empty">Cargando…</div>
      ) : filas.length === 0 ? (
        <div className="empty"><b>Nadie quedó debiendo al corte</b>No hay resúmenes por enviar este mes.</div>
      ) : (
        <div className="box" style={{ marginTop: 10 }}>
          {filas.map((f) => (
            <button key={f.cliente.id} className="row-i" onClick={() => setAbierta(f)}>
              <div className="av">{iniciales(f.cliente.full_name)}</div>
              <div className="tx"><b>{f.cliente.full_name}</b><small>{f.enviado ? `Enviado ${fechaCorta(f.enviado)}` : f.cliente.phone ? 'Por enviar' : 'Por enviar · sin celular'}</small></div>
              {f.enviado ? <span className="bal cero">Enviado</span> : <span className="bal debe">{pesos(f.saldo)}</span>}
            </button>
          ))}
        </div>
      )}
      {abierta && (() => {
        const texto = mensajeMes(abierta, corte, anterior)
        const tel = telefonoWhatsApp(abierta.cliente.phone)
        return (
          <>
            <div className="dim" onClick={() => setAbierta(null)} />
            <div className="sheet" role="dialog" aria-label={`Resumen de ${abierta.cliente.full_name}`}>
              <div className="grab" />
              <div className="sh-top"><div className="av">{iniciales(abierta.cliente.full_name)}</div><div><b>{abierta.cliente.full_name}</b><small>{abierta.cliente.phone ?? 'Sin celular registrado'}</small></div></div>
              <div className="bubble">{texto}</div>
              {tel ? (
                <a className="btn wa" href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" onClick={() => marcar(abierta)}>
                  {abierta.enviado ? 'Enviar de nuevo por WhatsApp' : 'Abrir WhatsApp'}
                </a>
              ) : (
                <button className="btn soft" onClick={() => { navigator.clipboard?.writeText(texto); toast('Mensaje copiado') }}>Copiar mensaje</button>
              )}
              {!abierta.enviado && <button className="btn ghost" onClick={() => marcar(abierta)}>Marcar como enviado</button>}
            </div>
          </>
        )
      })()}
    </div>
  )
}

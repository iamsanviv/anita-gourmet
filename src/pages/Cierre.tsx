import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useToast } from '../lib/store'
import { METODOS, nombreMetodo } from '../lib/config'
import { diaCorto, hoyBogota, horaCorta, inicioDia, pesos, sumarDias } from '../lib/format'
import type { Cierre, Reporte } from '../lib/types'
import { traerReporte } from './Reportes'

/** Movimientos de cuenta de un cliente en el día: lo que fió o lo que abonó. */
type PorCliente = { id: string; nombre: string; total: number; detalle: string[] }

function agrupar(filas: { customer_id: string; nombre: string; monto: number; detalle: string }[]): PorCliente[] {
  const m = new Map<string, PorCliente>()
  for (const f of filas) {
    const c = m.get(f.customer_id) ?? { id: f.customer_id, nombre: f.nombre, total: 0, detalle: [] }
    c.total += f.monto
    c.detalle.push(f.detalle)
    m.set(f.customer_id, c)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

/** Quién quedó debiendo (fiado) y quién abonó en el día. Usa los mismos criterios que el reporte. */
async function traerCuentasDelDia(dia: string) {
  const desde = inicioDia(dia)
  const hasta = inicioDia(sumarDias(dia, 1))
  const [cargos, abonos] = await Promise.all([
    supabase.from('account_entries')
      .select('customer_id, amount, customers(full_name), orders!inner(number, status, closed_at)')
      .eq('kind', 'cargo').eq('orders.status', 'cobrado').gte('orders.closed_at', desde).lt('orders.closed_at', hasta),
    supabase.from('payments')
      .select('customer_id, amount, method, customers(full_name)')
      .eq('kind', 'abono').gte('created_at', desde).lt('created_at', hasta),
  ])
  if (cargos.error) throw cargos.error
  if (abonos.error) throw abonos.error
  type Fila = { customer_id: string; amount: number; method?: string; customers: { full_name: string } | null; orders?: { number: number } | null }
  const nombre = (f: Fila) => f.customers?.full_name ?? 'Cliente'
  return {
    fiados: agrupar((cargos.data as unknown as Fila[]).map((f) => ({ customer_id: f.customer_id, nombre: nombre(f), monto: f.amount, detalle: `#${f.orders?.number}` }))),
    abonos: agrupar((abonos.data as unknown as Fila[]).map((f) => ({ customer_id: f.customer_id, nombre: nombre(f), monto: f.amount, detalle: nombreMetodo(f.method ?? '') }))),
  }
}

function ListaCuentas({ titulo, filas, total, signo, vacio }: { titulo: string; filas: PorCliente[]; total: number; signo: string; vacio: string }) {
  const nav = useNavigate()
  return (
    <>
      <div className="lbl">{titulo}</div>
      <div className="box">
        {filas.length === 0 && <div className="rc"><span className="muted">{vacio}</span></div>}
        {filas.map((c) => (
          <button key={c.id} className="rc link" onClick={() => nav('/clientes/' + c.id)}>
            <span>{c.nombre} <small className="muted">· {c.detalle.join(', ')}</small></span>
            <span className="v">{signo}{pesos(c.total)} ›</span>
          </button>
        ))}
        {filas.length > 0 && (
          <div className="rc tot"><span>{filas.length} {filas.length === 1 ? 'cliente' : 'clientes'}</span><span className="v">{signo}{pesos(total)}</span></div>
        )}
      </div>
    </>
  )
}

export default function CierrePage() {
  const nav = useNavigate()
  const toast = useToast()
  const { staff } = useAuth()
  const [dia, setDia] = useState(hoyBogota())
  const [r, setR] = useState<Reporte | null>(null)
  const [cuentas, setCuentas] = useState<{ fiados: PorCliente[]; abonos: PorCliente[] } | null>(null)
  const [cierre, setCierre] = useState<(Cierre & { staff: { full_name: string } | null }) | null>(null)
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setR(null)
    const [rep, cts, { data }] = await Promise.all([
      traerReporte(dia, dia),
      traerCuentasDelDia(dia),
      supabase.from('cash_closings').select('*, staff(full_name)').eq('day', dia).maybeSingle(),
    ])
    setR(rep)
    setCuentas(cts)
    setCierre(data as typeof cierre)
    setContado(data ? String(data.counted_cash) : '')
    setNota(data?.note ?? '')
    setCorrigiendo(false)
  }, [dia])
  useEffect(() => { cargar().catch((e) => toast(e.message, true)) }, [cargar, toast])

  if (!r) return <div className="empty">Cargando…</div>

  const efectivo = r.por_medio.efectivo ?? 0
  const devEfectivo = r.devol_por_medio.efectivo ?? 0
  const comprasEfectivo = r.compras_por_medio.efectivo ?? 0
  const esperado = efectivo - devEfectivo - comprasEfectivo
  const contadoNum = Number(contado) || 0
  const diferencia = contadoNum - esperado
  const editable = !cierre || corrigiendo

  async function cerrar() {
    if (contado === '') return toast('Escribe cuánto efectivo contaste', true)
    setEnviando(true)
    const datos = {
      day: dia, expected_cash: esperado, counted_cash: contadoNum, difference: diferencia, note: nota.trim() || null,
      totals: { por_medio: r!.por_medio, devoluciones: r!.devol_por_medio, compras: r!.compras_por_medio, vendido: r!.vendido, a_cuentas: r!.a_cuentas, abiertos: r!.abiertos,
        fiados: cuentas?.fiados.map((c) => ({ cliente: c.nombre, monto: c.total })) ?? [],
        abonos: cuentas?.abonos.map((c) => ({ cliente: c.nombre, monto: c.total })) ?? [] },
    }
    const { error } = cierre
      ? await supabase.from('cash_closings').update(datos).eq('id', cierre.id)
      : await supabase.from('cash_closings').insert(datos)
    setEnviando(false)
    if (error) return toast(error.code === '23505' ? 'Alguien ya cerró la caja de este día' : error.message, true)
    toast(cierre ? 'Cierre corregido' : 'Caja cerrada')
    cargar()
  }

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/mas')} aria-label="Volver">‹</button>
        <h1>Cierre del {diaCorto(dia)}</h1>
      </div>
      <label className="field"><span>DÍA</span><input id="cierre-dia" type="date" value={dia} max={hoyBogota()} onChange={(e) => e.target.value && setDia(e.target.value)} /></label>
      {dia === hoyBogota() && r.abiertos > 0 && (
        <button className="alert" onClick={() => nav('/pedidos')}>🧾 Hay {r.abiertos} {r.abiertos === 1 ? 'pedido abierto' : 'pedidos abiertos'} sin cobrar ({pesos(r.abiertos_total)}) ›</button>
      )}
      {cierre && (
        <div className="alert ok">✅ Caja cerrada por {cierre.staff?.full_name ?? 'el personal'} a las {horaCorta(cierre.created_at)}</div>
      )}

      <div className="lbl">Cobrado por medio de pago</div>
      <div className="box">
        {METODOS.map((m) => <div key={m.id} className="rc"><span>{m.icono} {m.nombre}</span><span className="v">{pesos(r.por_medio[m.id] ?? 0)}</span></div>)}
        <div className="rc tot"><span>Total cobrado</span><span className="v">{pesos(r.cobrado)}</span></div>
      </div>
      {r.abonos > 0 && <p className="note">Incluye {pesos(r.abonos)} de abonos a cuentas.</p>}

      {cuentas && (
        <>
          <ListaCuentas titulo="Fiado del día (quedó debiendo)" filas={cuentas.fiados} total={r.a_cuentas} signo="+" vacio="Nadie fió este día" />
          <ListaCuentas titulo="Abonos del día (pagó deuda)" filas={cuentas.abonos} total={r.abonos} signo="−" vacio="No hubo abonos este día" />
          {(r.a_cuentas > 0 || r.abonos > 0) && (
            <div className={'diff' + (r.a_cuentas - r.abonos <= 0 ? ' ok' : '')}>
              <span>{r.a_cuentas - r.abonos > 0 ? 'La deuda de los clientes subió' : r.a_cuentas - r.abonos < 0 ? 'La deuda de los clientes bajó' : 'La deuda quedó igual'}</span>
              <b>{r.a_cuentas - r.abonos > 0 ? '+' : r.a_cuentas - r.abonos < 0 ? '−' : ''}{pesos(Math.abs(r.a_cuentas - r.abonos))}</b>
            </div>
          )}
        </>
      )}

      <div className="lbl">Efectivo en caja</div>
      <div className="box">
        <div className="rc"><span>Cobrado en efectivo</span><span className="v">{pesos(efectivo)}</span></div>
        {devEfectivo > 0 && <div className="rc"><span>Devoluciones en efectivo</span><span className="v">−{pesos(devEfectivo)}</span></div>}
        {comprasEfectivo > 0 && <div className="rc"><span>Compras pagadas en efectivo</span><span className="v">−{pesos(comprasEfectivo)}</span></div>}
        <div className="rc tot"><span>Esperado</span><span className="v">{pesos(esperado)}</span></div>
      </div>
      <label className="field big" style={{ marginTop: 10 }}>
        <span>CONTADO</span>
        <input id="contado" inputMode="numeric" disabled={!editable} value={contado !== '' ? pesos(Number(contado)) : ''} onChange={(e) => setContado(e.target.value.replace(/\D/g, ''))} placeholder="$0" />
      </label>
      {contado !== '' && (
        <div className={'diff' + (diferencia === 0 ? ' ok' : '')} style={{ marginTop: 0 }}>
          <span>{diferencia === 0 ? 'Cuadra exacto' : diferencia > 0 ? 'Sobra' : 'Falta'}</span>
          <b>{diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}{pesos(Math.abs(diferencia))}</b>
        </div>
      )}
      <label className="field" style={{ marginTop: 10 }}><span>NOTA (OPCIONAL)</span><input id="cierre-nota" disabled={!editable} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: faltan $2.000 de vueltas" /></label>

      <div className="dock">
        {editable ? (
          <button className="btn" disabled={enviando || contado === ''} onClick={cerrar}>{cierre ? 'Guardar corrección' : 'Cerrar caja del día'}</button>
        ) : staff?.role === 'admin' ? (
          <button className="btn soft" style={{ flex: 1 }} onClick={() => setCorrigiendo(true)}>Corregir cierre</button>
        ) : (
          <button className="btn soft" style={{ flex: 1 }} onClick={() => nav('/mas')}>Listo</button>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useToast } from '../lib/store'
import { METODOS } from '../lib/config'
import { diaCorto, hoyBogota, horaCorta, pesos } from '../lib/format'
import type { Cierre, Reporte } from '../lib/types'
import { traerReporte } from './Reportes'

export default function CierrePage() {
  const nav = useNavigate()
  const toast = useToast()
  const { staff } = useAuth()
  const [dia, setDia] = useState(hoyBogota())
  const [r, setR] = useState<Reporte | null>(null)
  const [cierre, setCierre] = useState<(Cierre & { staff: { full_name: string } | null }) | null>(null)
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setR(null)
    const [rep, { data }] = await Promise.all([
      traerReporte(dia, dia),
      supabase.from('cash_closings').select('*, staff(full_name)').eq('day', dia).maybeSingle(),
    ])
    setR(rep)
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
      totals: { por_medio: r!.por_medio, devoluciones: r!.devol_por_medio, compras: r!.compras_por_medio, vendido: r!.vendido, a_cuentas: r!.a_cuentas, abiertos: r!.abiertos },
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
      {r.abonos > 0 && <p className="note">Incluye {pesos(r.abonos)} de abonos a cuentas. Además quedaron {pesos(r.a_cuentas)} cargados a cuentas.</p>}

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

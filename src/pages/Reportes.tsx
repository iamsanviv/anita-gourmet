import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import { nombreMetodo, nombreMetodoCompra } from '../lib/config'
import { diaCorto, hoyBogota, inicioDia, pesos, sumarDias } from '../lib/format'
import type { Reporte } from '../lib/types'

type Periodo = 'hoy' | 'semana' | 'mes' | 'fechas'

export async function traerReporte(desde: string, hasta: string) {
  const { data, error } = await supabase.rpc('report_summary', { p_from: inicioDia(desde), p_to: inicioDia(sumarDias(hasta, 1)) })
  if (error) throw error
  return data as Reporte
}

function rango(p: Periodo, desde: string, hasta: string): [string, string] {
  const hoy = hoyBogota()
  if (p === 'hoy') return [hoy, hoy]
  if (p === 'semana') {
    const dow = new Date(hoy + 'T12:00:00Z').getUTCDay() // 0 domingo
    return [sumarDias(hoy, -((dow + 6) % 7)), hoy]
  }
  if (p === 'mes') return [hoy.slice(0, 8) + '01', hoy]
  return desde <= hasta ? [desde, hasta] : [hasta, desde]
}

const titulo = (d: string, h: string) => (d === h ? diaCorto(d) : `${diaCorto(d)} al ${diaCorto(h)}`)

export default function Reportes() {
  const nav = useNavigate()
  const toast = useToast()
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [desde, setDesde] = useState(hoyBogota())
  const [hasta, setHasta] = useState(hoyBogota())
  const [r, setR] = useState<Reporte | null>(null)
  const [d, h] = rango(periodo, desde, hasta)

  useEffect(() => {
    let vivo = true
    setR(null)
    traerReporte(d, h).then((x) => vivo && setR(x)).catch((e) => toast(e.message, true))
    return () => { vivo = false }
  }, [d, h, toast])

  function excel() {
    if (!r) return
    const filas: (string | number)[][] = [
      ['Anita Gourmet · Reporte', titulo(d, h)],
      [],
      ['Ventas', r.ventas],
      ['Vendido', r.vendido],
      ['Cobrado (ventas + abonos)', r.cobrado],
      ['  Cobrado en ventas', r.cobrado_ventas],
      ['  Abonos a cuentas', r.abonos],
      ['Quedó a cuentas', r.a_cuentas],
      ['Ganancia estimada', r.ganancia],
      ['Costo de lo vendido', r.costo],
      ['Líneas vendidas sin receta', r.lineas_sin_costo],
      ['Compras a proveedores', r.compras],
      ['Devoluciones', r.devoluciones],
      [],
      ['Cobrado por medio de pago'],
      ...Object.entries(r.por_medio).map(([m, v]) => [nombreMetodo(m), v]),
      [],
      ['Compras por medio de pago'],
      ...Object.entries(r.compras_por_medio).map(([m, v]) => [nombreMetodoCompra(m), v]),
      [],
      ['Productos más vendidos', 'Cantidad', 'Total'],
      ...r.top.map((t) => [t.name, t.cantidad, t.total]),
      [],
      ['Ventas por hora', 'Pedidos'],
      ...Object.entries(r.por_hora).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => [`${k}:00`, v]),
      [],
      ['Vendido por día', 'Total'],
      ...Object.entries(r.por_dia).sort().map(([k, v]) => [k, v]),
    ]
    const csv = filas.map((f) => f.map((c) => {
      const s = String(c)
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-anita-gourmet-${d}${d === h ? '' : '-a-' + h}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const horas = r ? Object.keys(r.por_hora).map(Number) : []
  const hMin = horas.length ? Math.min(...horas, 7) : 7
  const hMax = horas.length ? Math.max(...horas, 14) : 14
  const columnas = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i)
  const pico = Math.max(1, ...Object.values(r?.por_hora ?? {}))

  return (
    <div className="screen reporte">
      <div className="top">
        <button className="round no-print" onClick={() => nav('/mas')} aria-label="Volver">‹</button>
        <h1>Reportes</h1>
        <button className="mini no-print" disabled={!r} onClick={excel}>Excel</button>
        <button className="mini no-print" disabled={!r} onClick={() => window.print()}>PDF</button>
      </div>
      <p className="print-only note">Anita Gourmet · {titulo(d, h)}</p>
      <div className="fchips no-print" style={{ paddingTop: 0 }}>
        {([['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['fechas', 'Elegir fechas']] as [Periodo, string][]).map(([k, l]) => (
          <button key={k} className={'fchip' + (periodo === k ? ' on' : '')} onClick={() => setPeriodo(k)}>{l}</button>
        ))}
      </div>
      {periodo === 'fechas' && (
        <div className="row2 no-print" style={{ padding: '0 16px' }}>
          <label className="field"><span>DESDE</span><input id="r-desde" type="date" value={desde} max={hoyBogota()} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="field"><span>HASTA</span><input id="r-hasta" type="date" value={hasta} max={hoyBogota()} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
      )}

      {!r ? (
        <div className="empty">Cargando…</div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi main"><small>VENDIDO · {titulo(d, h).toUpperCase()} · {r.ventas} {r.ventas === 1 ? 'VENTA' : 'VENTAS'}</small><b>{pesos(r.vendido)}</b></div>
            <div className="kpi g"><small>COBRADO</small><b>{pesos(r.cobrado)}</b>{r.abonos > 0 && <span>Incluye {pesos(r.abonos)} de abonos</span>}</div>
            <div className="kpi o"><small>A CUENTAS</small><b>{pesos(r.a_cuentas)}</b></div>
            <div className="kpi g wide">
              <small>GANANCIA ESTIMADA</small><b>{pesos(r.ganancia)}</b>
              <span>{r.lineas_sin_costo > 0
                ? `Sobre ${pesos(r.vendido_con_costo)} vendidos con receta. ${r.lineas_sin_costo} ${r.lineas_sin_costo === 1 ? 'línea' : 'líneas'} sin receta no cuentan.`
                : r.ventas > 0 ? `Costo de lo vendido ${pesos(r.costo)}` : ''}</span>
            </div>
            <div className="kpi"><small>COMPRAS</small><b>{pesos(r.compras)}</b></div>
            <div className="kpi"><small>DEVOLUCIONES</small><b>{pesos(r.devoluciones)}</b></div>
          </div>

          <div className="chart">
            <div className="t">Ventas por hora</div>
            <div className="bars">
              {columnas.map((hr) => {
                const n = r.por_hora[hr] ?? 0
                return <div key={hr} className={n === pico && n > 0 ? 'pk' : ''} style={{ height: (n / pico) * 100 + '%' }}>{n > 0 && <span>{n}</span>}</div>
              })}
            </div>
            <div className="hrs">{columnas.map((hr) => <span key={hr}>{hr}</span>)}</div>
          </div>

          <div className="lbl">Cobrado por medio de pago</div>
          <div className="box">
            {Object.keys(r.por_medio).length === 0 && <div className="rc"><span className="muted">Sin pagos en este periodo</span></div>}
            {Object.entries(r.por_medio).map(([m, v]) => <div key={m} className="rc"><span>{nombreMetodo(m)}</span><span className="v">{pesos(v)}</span></div>)}
          </div>

          <div className="lbl">Más vendidos</div>
          <div className="box">
            {r.top.length === 0 && <div className="rc"><span className="muted">Sin ventas en este periodo</span></div>}
            {r.top.map((t, i) => (
              <div key={t.name} className="rc"><span>{i + 1}. {t.name} · {t.cantidad}</span><span className="v">{pesos(t.total)}</span></div>
            ))}
          </div>

          {d !== h && Object.keys(r.por_dia).length > 0 && (
            <>
              <div className="lbl">Vendido por día</div>
              <div className="box">
                {Object.entries(r.por_dia).sort().map(([k, v]) => <div key={k} className="rc"><span>{diaCorto(k)}</span><span className="v">{pesos(v)}</span></div>)}
              </div>
            </>
          )}
          {r.abiertos > 0 && <div className="alert">🧾 Hay {r.abiertos} {r.abiertos === 1 ? 'pedido abierto' : 'pedidos abiertos'} sin cobrar ({pesos(r.abiertos_total)}). No cuentan como vendidos hasta que se cobren.</div>}
        </>
      )}
    </div>
  )
}

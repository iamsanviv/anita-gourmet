import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fechaCorta, iniciales, nombreMes, pesos } from '../lib/format'
import type { Cliente } from '../lib/types'
import NuevoCliente from './NuevoCliente'
import { corteActual, resumenesPendientes } from './Resumenes'

type Fila = Cliente & { balance: number; last_movement: string | null }
type Filtro = 'todos' | 'saldo' | 'aldia' | 'bloqueados'

export default function Clientes() {
  const nav = useNavigate()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [creando, setCreando] = useState(false)
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => { resumenesPendientes().then(setPendientes).catch(() => {}) }, [])

  useEffect(() => {
    ;(async () => {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase.from('customers').select('*').order('full_name'),
        supabase.from('customer_balances').select('*'),
      ])
      const mapa = new Map((b ?? []).map((x: { customer_id: string; balance: number; last_movement: string | null }) => [x.customer_id, x]))
      setFilas(((c as Cliente[]) ?? []).map((x) => ({ ...x, balance: mapa.get(x.id)?.balance ?? 0, last_movement: mapa.get(x.id)?.last_movement ?? null })))
    })()
  }, [])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (filas ?? [])
      .filter((f) => !t || f.full_name.toLowerCase().includes(t) || (f.cedula ?? '').includes(t))
      .filter((f) =>
        filtro === 'saldo' ? f.balance > 0 : filtro === 'aldia' ? f.balance <= 0 && !f.blocked : filtro === 'bloqueados' ? f.blocked : true,
      )
      .sort((a, b) => (filtro === 'saldo' ? b.balance - a.balance : 0))
  }, [filas, q, filtro])

  const porCobrar = (filas ?? []).reduce((a, f) => a + Math.max(0, f.balance), 0)
  const conSaldo = (filas ?? []).filter((f) => f.balance > 0).length

  return (
    <div className="screen">
      <div className="top"><h1>Clientes</h1></div>
      <div className="sumcard">
        <small>POR COBRAR</small>
        <b>{pesos(porCobrar)}</b>
        <span>{conSaldo} {conSaldo === 1 ? 'cliente' : 'clientes'} con saldo</span>
      </div>
      <button className={'alert' + (pendientes ? '' : ' info')} onClick={() => nav('/clientes/resumenes')}>
        💬 {pendientes
          ? `Resúmenes de ${nombreMes(corteActual().anterior).split(' ')[0]}: ${pendientes} por enviar ›`
          : `Resúmenes del mes (corte el 1) ›`}
      </button>
      <label className="search" style={{ marginTop: 12 }}>
        <span aria-hidden="true">🔍</span>
        <input id="buscar-clientes" placeholder="Nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="fchips">
        {([['todos', `Todos · ${filas?.length ?? 0}`], ['saldo', 'Con saldo'], ['aldia', 'Al día'], ['bloqueados', 'Bloqueados']] as [Filtro, string][]).map(([k, l]) => (
          <button key={k} className={'fchip' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>

      {!filas ? (
        <div className="empty">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="empty"><b>{filas.length ? 'Sin resultados' : 'Aún no hay clientes'}</b>{filas.length ? '' : 'Crea la primera cuenta con el botón +.'}</div>
      ) : (
        <div className="box">
          {visibles.map((f) => (
            <Link key={f.id} to={'/clientes/' + f.id} className="row-i" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="av">{iniciales(f.full_name)}</div>
              <div className="tx">
                <b>{f.full_name}</b>
                <small>{f.blocked ? 'Bloqueado' : f.last_movement ? 'Último movimiento: ' + fechaCorta(f.last_movement) : 'Sin movimientos'}</small>
              </div>
              {f.blocked ? <span className="bal blo">{pesos(f.balance)}</span> : f.balance > 0 ? <span className="bal debe">{pesos(f.balance)}</span> : <span className="bal cero">Al día</span>}
            </Link>
          ))}
        </div>
      )}

      <button className="fab" aria-label="Nuevo cliente" onClick={() => setCreando(true)}>+</button>
      {creando && <NuevoCliente onClose={() => setCreando(false)} onCreado={(c) => nav('/clientes/' + c.id)} />}
    </div>
  )
}

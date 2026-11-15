import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import { nombreMetodoCompra } from '../lib/config'
import { diaCorto, pesos, telefonoWhatsApp } from '../lib/format'
import type { Compra, Proveedor } from '../lib/types'

type Fila = Proveedor & { purchases: Pick<Compra, 'total' | 'purchased_on'>[] }

export default function Proveedores() {
  const nav = useNavigate()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [abierto, setAbierto] = useState<Proveedor | 'nuevo' | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('suppliers').select('*, purchases(total, purchased_on)').order('name')
    setFilas((data as Fila[]) ?? [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/mas')} aria-label="Volver">‹</button>
        <h1>Proveedores</h1>
        <button className="mini pri" onClick={() => nav('/inventario/compra')}>+ Compra</button>
      </div>
      {!filas ? (
        <div className="empty">Cargando…</div>
      ) : filas.length === 0 ? (
        <div className="empty"><b>Aún no hay proveedores</b>Créalos con el botón + o al registrar una compra.</div>
      ) : (
        <div className="box">
          {filas.map((p) => {
            const ultima = [...p.purchases].sort((a, b) => b.purchased_on.localeCompare(a.purchased_on))[0]
            return (
              <button key={p.id} className="row-i" onClick={() => setAbierto(p)}>
                <div className="art" style={{ ['--c' as string]: 'var(--yellow-soft)' }}>🚚</div>
                <div className="tx">
                  <b>{p.name}</b>
                  <small>{p.purchases.length ? `${p.purchases.length} ${p.purchases.length === 1 ? 'compra' : 'compras'} · última ${diaCorto(ultima.purchased_on)}` : 'Sin compras'}{p.phone ? ` · ${p.phone}` : ''}</small>
                </div>
                <span className="muted">›</span>
              </button>
            )
          })}
        </div>
      )}
      <button className="fab" aria-label="Nuevo proveedor" onClick={() => setAbierto('nuevo')}>+</button>
      {abierto && <ProveedorSheet proveedor={abierto === 'nuevo' ? null : abierto} onClose={() => setAbierto(null)} onCambio={cargar} />}
    </div>
  )
}

function ProveedorSheet({ proveedor, onClose, onCambio }: { proveedor: Proveedor | null; onClose: () => void; onCambio: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: proveedor?.name ?? '', phone: proveedor?.phone ?? '', notes: proveedor?.notes ?? '' })
  const [compras, setCompras] = useState<Compra[]>([])

  useEffect(() => {
    if (!proveedor) return
    supabase.from('purchases').select('*').eq('supplier_id', proveedor.id).order('purchased_on', { ascending: false }).limit(20)
      .then(({ data }) => setCompras((data as Compra[]) ?? []))
  }, [proveedor])

  async function guardar() {
    if (!f.name.trim()) return toast('Escribe el nombre', true)
    const datos = { name: f.name.trim(), phone: f.phone.trim() || null, notes: f.notes.trim() || null }
    const { error } = proveedor
      ? await supabase.from('suppliers').update(datos).eq('id', proveedor.id)
      : await supabase.from('suppliers').insert(datos)
    if (error) return toast(error.code === '23505' ? 'Ya existe un proveedor con ese nombre' : error.message, true)
    toast(proveedor ? 'Cambios guardados' : `${datos.name} agregado`)
    onCambio()
    onClose()
  }

  const tel = telefonoWhatsApp(f.phone)
  return (
    <>
      <div className="dim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={proveedor?.name ?? 'Nuevo proveedor'}>
        <div className="grab" />
        <div className="sh-top"><div className="art">🚚</div><div><b>{proveedor?.name ?? 'Nuevo proveedor'}</b><small>{proveedor ? 'Datos y compras' : 'A quién le compras'}</small></div></div>
        <label className="field"><span>NOMBRE</span><input id="pv-nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Panadería La Espiga" /></label>
        <label className="field"><span>CELULAR (OPCIONAL)</span><input id="pv-tel" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="field"><span>NOTAS (OPCIONAL)</span><input id="pv-notas" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej.: viene los lunes" /></label>
        <button className="btn" onClick={guardar}>{proveedor ? 'Guardar cambios' : 'Agregar proveedor'}</button>
        {proveedor && tel && <a className="btn wa" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>}
        {compras.length > 0 && (
          <div>
            <div className="lbl" style={{ padding: '4px 0 6px' }}>Compras</div>
            {compras.map((c) => (
              <div key={c.id} className="rc"><span>{diaCorto(c.purchased_on)} · {nombreMetodoCompra(c.method)}{c.note ? ` · ${c.note}` : ''}</span><span className="v">{pesos(c.total)}</span></div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

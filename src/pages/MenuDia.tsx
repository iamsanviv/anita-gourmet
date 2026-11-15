import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import { diaLargo, hoyBogota, sumarDias } from '../lib/format'
import type { MenuDia } from '../lib/types'

/** Menú del día de hoy (o null). */
export function useMenuHoy() {
  const [menu, setMenu] = useState<MenuDia | null>(null)
  useEffect(() => {
    supabase.from('daily_menus').select('*').eq('day', hoyBogota()).maybeSingle().then(({ data }) => setMenu(data as MenuDia | null))
  }, [])
  return menu
}

export default function MenuDiaPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [dia, setDia] = useState(hoyBogota())
  const [f, setF] = useState({ title: '', description: '' })
  const [existe, setExiste] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    supabase.from('daily_menus').select('*').eq('day', dia).maybeSingle().then(({ data }) => {
      setF({ title: data?.title ?? '', description: data?.description ?? '' })
      setExiste(!!data)
      setCargando(false)
    })
  }, [dia])

  async function guardar() {
    if (!f.title.trim()) return toast('Escribe el nombre del menú', true)
    const { error } = await supabase.from('daily_menus').upsert({
      day: dia, title: f.title.trim(), description: f.description.trim() || null, updated_at: new Date().toISOString(),
    })
    if (error) return toast(error.message, true)
    setExiste(true)
    toast(dia === hoyBogota() ? 'Menú publicado: ya aparece en Vender' : 'Menú guardado')
  }

  async function copiarAyer() {
    const { data } = await supabase.from('daily_menus').select('*').lt('day', dia).order('day', { ascending: false }).limit(1).maybeSingle()
    if (!data) return toast('No hay un menú anterior para copiar', true)
    setF({ title: data.title, description: data.description ?? '' })
  }

  return (
    <div className="screen">
      <div className="top">
        <button className="round" onClick={() => nav('/mas')} aria-label="Volver">‹</button>
        <h1>Menú del día</h1>
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={dia === hoyBogota() ? 'on' : ''} onClick={() => setDia(hoyBogota())}>Hoy</button>
        <button className={dia === sumarDias(hoyBogota(), 1) ? 'on' : ''} onClick={() => setDia(sumarDias(hoyBogota(), 1))}>Mañana</button>
      </div>
      <p className="note" style={{ marginTop: 0, marginBottom: 10, textTransform: 'capitalize' }}>{diaLargo(dia)}</p>
      {cargando ? <div className="empty">Cargando…</div> : (
        <>
          <label className="field"><span>NOMBRE</span><input id="menu-titulo" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: Almuerzo ejecutivo · Pollo a la plancha" /></label>
          <label className="field"><span>QUÉ INCLUYE (OPCIONAL)</span><textarea id="menu-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ej.: Sopa de verduras, arroz, ensalada, jugo" /></label>
          {(f.title || f.description) && (
            <div className="menu-dia">
              <span className="em">🍛</span>
              <div><small>MENÚ DEL DÍA</small><b>{f.title || '…'}</b>{f.description && <p>{f.description}</p>}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, margin: '12px 16px 0' }}>
            <button className="btn soft" onClick={copiarAyer}>Copiar el anterior</button>
            <button className="btn" style={{ flex: 1 }} onClick={guardar}>{existe ? 'Guardar cambios' : 'Publicar menú'}</button>
          </div>
          <p className="note">El menú aparece arriba en la pantalla Vender el día que corresponde. El precio del almuerzo se maneja como un producto más.</p>
        </>
      )}
    </div>
  )
}

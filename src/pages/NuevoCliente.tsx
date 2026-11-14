import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/store'
import type { Cliente } from '../lib/types'

/** Hoja para crear o editar la cuenta de un cliente. */
export default function NuevoCliente({
  nombreInicial = '',
  cliente,
  onClose,
  onCreado,
}: {
  nombreInicial?: string
  cliente?: Cliente
  onClose: () => void
  onCreado: (c: Cliente) => void
}) {
  const toast = useToast()
  const [f, setF] = useState({
    full_name: cliente?.full_name ?? nombreInicial,
    cedula: cliente?.cedula ?? '',
    phone: cliente?.phone ?? '',
    email: cliente?.email ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!f.full_name.trim()) return toast('Escribe el nombre', true)
    setGuardando(true)
    const datos = {
      full_name: f.full_name.trim(),
      cedula: f.cedula.replace(/\D/g, '') || null,
      phone: f.phone.replace(/\D/g, '') || null,
      email: f.email.trim() || null,
    }
    const res = cliente
      ? await supabase.from('customers').update(datos).eq('id', cliente.id).select().single()
      : await supabase.from('customers').insert(datos).select().single()
    setGuardando(false)
    if (res.error) {
      const dup = res.error.code === '23505'
      return toast(dup ? 'Ya existe un cliente con esa cédula' : res.error.message, true)
    }
    toast(cliente ? 'Cliente actualizado' : 'Cuenta creada')
    onCreado(res.data as Cliente)
  }

  return (
    <>
      <div className="dim" onClick={onClose} />
      <form className="sheet" onSubmit={guardar} aria-label={cliente ? 'Editar cliente' : 'Nueva cuenta'}>
        <div className="grab" />
        <div className="sh-top"><div><b>{cliente ? 'Editar cliente' : 'Nueva cuenta'}</b><small>Los datos sirven para buscarlo y enviarle su resumen.</small></div></div>
        <label className="field"><span>NOMBRE COMPLETO</span><input id="c-nombre" autoFocus value={f.full_name} onChange={set('full_name')} /></label>
        <label className="field"><span>CÉDULA</span><input id="c-cedula" inputMode="numeric" value={f.cedula} onChange={set('cedula')} /></label>
        <label className="field"><span>CELULAR (WHATSAPP)</span><input id="c-cel" inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
        <label className="field"><span>CORREO</span><input id="c-correo" type="email" value={f.email} onChange={set('email')} /></label>
        <button className="btn" disabled={guardando}>{cliente ? 'Guardar cambios' : 'Crear cuenta'}</button>
      </form>
    </>
  )
}

export const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')

export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre

export function hace(fecha: string) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (min < 1) return 'Hace un momento'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Hace ${h} h`
  return fechaCorta(fecha)
}

export const fechaCorta = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

export const horaCorta = (fecha: string) =>
  new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })

/** Solo dígitos; agrega 57 si es un celular colombiano de 10 dígitos. */
export function telefonoWhatsApp(tel: string | null | undefined) {
  const d = (tel ?? '').replace(/\D/g, '')
  if (d.length === 10) return '57' + d
  return d
}

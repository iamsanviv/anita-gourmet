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

/** Cantidad de inventario: hasta 2 decimales, con coma. */
export const cant = (n: number) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 })

/** Lee un número escrito por la persona: acepta coma o punto como decimal. */
export const leerNumero = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** Fecha de hoy en Colombia, como AAAA-MM-DD. */
export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

/** Inicio del día (00:00 en Colombia, que no cambia de horario) como fecha ISO. */
export const inicioDia = (dia: string) => new Date(dia + 'T00:00:00-05:00').toISOString()

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(dia: string, n: number) {
  const d = new Date(dia + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "15 nov." a partir de AAAA-MM-DD, sin correrse por zona horaria. */
export const diaCorto = (dia: string) =>
  new Date(dia + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export const diaLargo = (dia: string) =>
  new Date(dia + 'T12:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export const nombreMes = (dia: string) =>
  new Date(dia + 'T12:00:00Z').toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })

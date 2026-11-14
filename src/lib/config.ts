// Datos del negocio que aparecen en los mensajes a clientes.
export const NEGOCIO = {
  nombre: 'Anita Gourmet',
  whatsapp: '310 232 8666',
  pago: 'Nequi o Llave Bre-B: 310 232 8666',
}

export const METODOS = [
  { id: 'efectivo', nombre: 'Efectivo', icono: '💵' },
  { id: 'nequi', nombre: 'Nequi', icono: '📱' },
  { id: 'breb', nombre: 'Llave Bre‑B', icono: '🔑' },
] as const
export type Metodo = (typeof METODOS)[number]['id']
export const nombreMetodo = (m: string) => METODOS.find((x) => x.id === m)?.nombre ?? m

// Color de fondo por categoría (tokens de styles.css)
const COLORES = ['var(--lilac-soft)', 'var(--yellow-soft)', 'var(--orange-soft)', 'var(--pink-soft)', 'var(--green-soft)']
export const colorCategoria = (sort: number) => COLORES[sort % COLORES.length]

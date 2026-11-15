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

export const UNIDADES = [
  { id: 'und', nombre: 'Unidades' },
  { id: 'g', nombre: 'Gramos' },
  { id: 'kg', nombre: 'Kilos' },
  { id: 'ml', nombre: 'Mililitros' },
  { id: 'L', nombre: 'Litros' },
  { id: 'loncha', nombre: 'Lonchas' },
] as const

// Cómo se pagó una compra a un proveedor
export const METODOS_COMPRA = [
  ...METODOS,
  { id: 'credito', nombre: 'A crédito', icono: '📝' },
] as const
export const nombreMetodoCompra = (m: string | null) => METODOS_COMPRA.find((x) => x.id === m)?.nombre ?? 'Sin dato'

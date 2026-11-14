export type Categoria = { id: string; name: string; icon: string; sort: number; active: boolean }
export type Opcion = { id: string; group_id: string; name: string; price_delta: number; sort: number }
export type GrupoOpciones = {
  id: string; product_id: string; name: string; required: boolean; multiple: boolean; sort: number
  options: Opcion[]
}
export type Producto = {
  id: string; category_id: string; name: string; price: number; icon: string
  active: boolean; available_today: boolean; sort: number
  option_groups: GrupoOpciones[]
}
export type Cliente = {
  id: string; full_name: string; cedula: string | null; phone: string | null; email: string | null
  blocked: boolean; notes: string | null; created_at: string
}
export type OpcionElegida = { group: string; name: string; price_delta: number }
export type ItemPedido = {
  key: string
  product_id: string | null
  name: string
  icon: string
  unit_price: number
  quantity: number
  options: OpcionElegida[]
  note: string
}
export type Pedido = {
  id: string; number: number; customer_id: string | null; guest_name: string | null
  status: 'abierto' | 'cobrado' | 'anulado'; total: number; note: string | null; cancel_reason: string | null
  created_at: string; closed_at: string | null
}
export type Movimiento = {
  id: string; customer_id: string; order_id: string | null; payment_id: string | null
  kind: 'cargo' | 'abono' | 'ajuste'; amount: number; description: string | null; created_at: string
}
export type Personal = { id: string; full_name: string; role: 'admin' | 'empleado'; active: boolean }

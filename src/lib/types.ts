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
  recipes: { quantity: number; inventory_items: { id: string; name: string; stock: number; unit: string } | null }[]
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

/* ---------- Fase 2 ---------- */
export type Unidad = 'und' | 'g' | 'kg' | 'ml' | 'L' | 'loncha'
export type ItemInventario = {
  id: string; name: string; kind: 'ingrediente' | 'producto'; unit: Unidad
  stock: number; min_stock: number; unit_cost: number; icon: string; active: boolean
}
export type Receta = { product_id: string; item_id: string; quantity: number }
export type RecetaConItem = Receta & { inventory_items: ItemInventario }
export type Proveedor = { id: string; name: string; phone: string | null; notes: string | null }
export type MovStock = {
  id: string; item_id: string; kind: 'compra' | 'venta' | 'merma' | 'ajuste' | 'anulacion'
  quantity: number; order_id: string | null; purchase_id: string | null; note: string | null; created_at: string
}
export type Compra = {
  id: string; supplier_id: string | null; purchased_on: string; method: string | null; total: number; note: string | null; created_at: string
}
export type Reporte = {
  ventas: number; vendido: number; a_cuentas: number; cobrado: number; cobrado_ventas: number; abonos: number
  por_medio: Record<string, number>; devoluciones: number; devol_por_medio: Record<string, number>
  compras: number; compras_por_medio: Record<string, number>
  costo: number; ganancia: number; vendido_con_costo: number; lineas_sin_costo: number
  por_hora: Record<string, number>; por_dia: Record<string, number>
  top: { name: string; cantidad: number; total: number }[]
  abiertos: number; abiertos_total: number
}
export type Cierre = {
  id: string; day: string; expected_cash: number; counted_cash: number; difference: number
  totals: Record<string, unknown>; note: string | null; closed_by: string | null; created_at: string
}
export type MenuDia = { day: string; title: string; description: string | null }

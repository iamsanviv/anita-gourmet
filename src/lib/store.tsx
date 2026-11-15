import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Categoria, ItemPedido, Personal, Producto } from './types'

/* ---------------- Sesión y personal ---------------- */
type AuthState = { session: Session | null; staff: Personal | null; loading: boolean; recovery: boolean }
const AuthCtx = createContext<AuthState & { refresh: () => Promise<void>; clearRecovery: () => void }>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, staff: null, loading: true, recovery: false })

  const load = useCallback(async (session: Session | null, recovery = false) => {
    if (!session) return setState({ session: null, staff: null, loading: false, recovery: false })
    const { data } = await supabase.from('staff').select('*').eq('id', session.user.id).maybeSingle()
    setState((s) => ({ session, staff: (data as Personal) ?? null, loading: false, recovery: recovery || s.recovery }))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      load(session, event === 'PASSWORD_RECOVERY')
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const value = useMemo(
    () => ({
      ...state,
      refresh: async () => load((await supabase.auth.getSession()).data.session),
      clearRecovery: () => setState((s) => ({ ...s, recovery: false })),
    }),
    [state, load],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)

/* ---------------- Avisos ---------------- */
type Toast = { text: string; error?: boolean } | null
const ToastCtx = createContext<(text: string, error?: boolean) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null)
  const show = useCallback((text: string, error?: boolean) => {
    setToast({ text, error })
    window.setTimeout(() => setToast(null), error ? 4500 : 2500)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={'toast' + (toast.error ? ' err' : '')} role="status">
          {toast.text}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

/* ---------------- Catálogo ---------------- */
type Catalogo = { categorias: Categoria[]; productos: Producto[]; cargando: boolean; recargar: () => Promise<void> }
const CatCtx = createContext<Catalogo>(null!)
export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const recargar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('*').eq('active', true).order('sort'),
      supabase.from('products').select('*, option_groups(*, options(*)), recipes(quantity, inventory_items(id, name, stock, unit))').eq('active', true).order('sort'),
    ])
    setCategorias((c.data as Categoria[]) ?? [])
    const prods = ((p.data as Producto[]) ?? []).map((x) => ({
      ...x,
      recipes: x.recipes ?? [],
      option_groups: [...(x.option_groups ?? [])]
        .sort((a, b) => a.sort - b.sort)
        .map((g) => ({ ...g, options: [...g.options].sort((a, b) => a.sort - b.sort) })),
    }))
    setProductos(prods)
    setCargando(false)
  }, [])
  useEffect(() => {
    recargar()
  }, [recargar])
  return <CatCtx.Provider value={{ categorias, productos, cargando, recargar }}>{children}</CatCtx.Provider>
}
export const useCatalogo = () => useContext(CatCtx)

/* ---------------- Pedido en curso ---------------- */
export type ClienteElegido =
  | { tipo: 'cuenta'; id: string; nombre: string }
  | { tipo: 'ocasional'; nombre: string }
  | null

type Carrito = {
  items: ItemPedido[]
  cliente: ClienteElegido
  editando: { id: string; number: number } | null
  agregar: (item: Omit<ItemPedido, 'key'>) => void
  cambiarCantidad: (key: string, delta: number) => void
  setNota: (key: string, note: string) => void
  setCliente: (c: ClienteElegido) => void
  cargar: (pedido: { id: string; number: number }, items: ItemPedido[], cliente: ClienteElegido) => void
  vaciar: () => void
  total: number
  cantidad: number
}
const CartCtx = createContext<Carrito>(null!)

const firma = (i: Omit<ItemPedido, 'key' | 'quantity'>) =>
  [i.product_id, i.options.map((o) => o.group + ':' + o.name).join('|'), i.note.trim()].join('#')

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemPedido[]>([])
  const [cliente, setCliente] = useState<ClienteElegido>(null)
  const [editando, setEditando] = useState<Carrito['editando']>(null)

  const value = useMemo<Carrito>(() => {
    const total = items.reduce((a, i) => a + i.unit_price * i.quantity, 0)
    const cantidad = items.reduce((a, i) => a + i.quantity, 0)
    return {
      items, cliente, editando, total, cantidad, setCliente,
      agregar: (item) =>
        setItems((prev) => {
          const f = firma(item)
          const i = prev.findIndex((x) => firma(x) === f)
          if (i >= 0) return prev.map((x, k) => (k === i ? { ...x, quantity: x.quantity + item.quantity } : x))
          return [...prev, { ...item, key: crypto.randomUUID() }]
        }),
      cambiarCantidad: (key, delta) =>
        setItems((prev) =>
          prev.map((x) => (x.key === key ? { ...x, quantity: x.quantity + delta } : x)).filter((x) => x.quantity > 0),
        ),
      setNota: (key, note) => setItems((prev) => prev.map((x) => (x.key === key ? { ...x, note } : x))),
      cargar: (pedido, its, cli) => {
        setEditando(pedido)
        setItems(its)
        setCliente(cli)
      },
      vaciar: () => {
        setItems([])
        setCliente(null)
        setEditando(null)
      },
    }
  }, [items, cliente, editando])
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}
export const useCarrito = () => useContext(CartCtx)

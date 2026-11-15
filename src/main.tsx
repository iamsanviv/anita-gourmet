import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './styles.css'
import { configured, supabase } from './lib/supabase'
import { AuthProvider, CarritoProvider, CatalogoProvider, ToastProvider, useAuth } from './lib/store'
import Login, { CrearClave } from './pages/Login'
import Vender from './pages/Vender'
import PedidoPage from './pages/Pedido'
import Cobro from './pages/Cobro'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import ClientePage from './pages/Cliente'
import Mas, { Productos } from './pages/Mas'
import Inventario from './pages/Inventario'
import Compra from './pages/Compra'
import ProductoPage from './pages/Producto'
import Reportes from './pages/Reportes'
import CierrePage from './pages/Cierre'
import Proveedores from './pages/Proveedores'
import MenuDiaPage from './pages/MenuDia'
import Resumenes from './pages/Resumenes'

const ICONOS: Record<string, string> = {
  vender: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pedidos: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  inventario: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  mas: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
}

function Nav() {
  const [abiertos, setAbiertos] = useState(0)
  useEffect(() => {
    const contar = () =>
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'abierto')
        .then(({ count }) => setAbiertos(count ?? 0))
    contar()
    const ch = supabase.channel('nav-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, contar)
      .subscribe()
    const t = window.setInterval(contar, 60000)
    return () => { supabase.removeChannel(ch); window.clearInterval(t) }
  }, [])
  const links: [string, string, string][] = [
    ['/', 'vender', 'Vender'],
    ['/pedidos', 'pedidos', 'Pedidos'],
    ['/clientes', 'clientes', 'Clientes'],
    ['/inventario', 'inventario', 'Inventario'],
    ['/mas', 'mas', 'Más'],
  ]
  return (
    <nav className="nav" aria-label="Secciones">
      <div className="in">
        {links.map(([to, ic, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {ic === 'pedidos' && abiertos > 0 && <span className="nb">{abiertos}</span>}
            <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONOS[ic] }} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function App() {
  const { session, staff, loading, recovery } = useAuth()
  if (!configured)
    return (
      <div className="empty"><b>Falta configurar Supabase</b>Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</div>
    )
  if (loading) return <div className="empty">Cargando…</div>
  if (!session) return <Login />
  if (recovery) return <CrearClave />
  if (!staff)
    return (
      <div className="login">
        <div className="empty">
          <b>Tu usuario no tiene acceso</b>
          Pídele a Anita que te registre como parte del personal.
        </div>
        <button className="btn soft" style={{ margin: '0 16px' }} onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    )
  return (
    <CatalogoProvider>
      <CarritoProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<Vender />} />
            <Route path="/pedido" element={<PedidoPage />} />
            <Route path="/cobro/:id" element={<Cobro />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClientePage />} />
            <Route path="/clientes/resumenes" element={<Resumenes />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/inventario/compra" element={<Compra />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/productos/:id" element={<ProductoPage />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/cierre" element={<CierrePage />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/menu" element={<MenuDiaPage />} />
            <Route path="/mas" element={<Mas />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Nav />
        </div>
      </CarritoProvider>
    </CatalogoProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)

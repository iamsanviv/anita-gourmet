import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useCarrito } from './store'

/** Cada cuánto se pregunta si hay una versión nueva publicada. */
const CADA_MS = 60_000
/** Pantallas con datos a medio llenar: ahí no se recarga sola, se ofrece un botón. */
const OCUPADAS = ['/pedido', '/cobro', '/inventario/compra', '/cierre', '/menu']

let aplicar: (() => void) | null = null
const avisos = new Set<() => void>()
let registrado = false

function registrar() {
  if (registrado || !('serviceWorker' in navigator)) return
  registrado = true
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      aplicar = () => { void updateSW(true) }
      avisos.forEach((f) => f())
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const revisar = () => { if (navigator.onLine) reg.update().catch(() => {}) }
      window.setInterval(revisar, CADA_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar() })
      window.addEventListener('focus', revisar)
    },
  })
}

/**
 * Busca versiones nuevas cada minuto (y al volver a la app) y se actualiza sola.
 * Si hay un pedido en curso, una hoja abierta o un formulario a medias, espera
 * y muestra un aviso para actualizar con un toque.
 */
export function Actualizador() {
  const carrito = useCarrito()
  const { pathname } = useLocation()
  const [hay, setHay] = useState(false)
  const [, tic] = useState(0)

  useEffect(() => {
    registrar()
    const f = () => setHay(true)
    avisos.add(f)
    if (aplicar) setHay(true)
    return () => { avisos.delete(f) }
  }, [])

  const ocupada = carrito.items.length > 0 || OCUPADAS.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (!hay) return
    if (!ocupada && !document.querySelector('.sheet')) { aplicar?.(); return }
    const t = window.setInterval(() => tic((n) => n + 1), 3000) // vuelve a mirar si ya se cerró la hoja
    return () => window.clearInterval(t)
  })

  if (!hay || !ocupada) return null
  return (
    <button className="update-bar" onClick={() => aplicar?.()}>
      Hay una versión nueva de la app · <b>Actualizar</b>
    </button>
  )
}

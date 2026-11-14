import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useToast } from '../lib/store'

/** Marca de agua: siluetas de comida repetidas (café, dona, hamburguesa, helado, pizza, cupcake, jugo, croissant, huevo, cubiertos). */
function Comidas({ id, className = 'auth-deco' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <pattern id={id} width="240" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          {/* taza de café */}
          <g transform="translate(14 18)"><path d="M2 12h24v10a10 10 0 0 1-10 10h-4A10 10 0 0 1 2 22z" /><path d="M26 15h3a5 5 0 0 1 0 10h-3" /><path d="M10 2c-2 3 2 5 0 8M17 2c-2 3 2 5 0 8" /></g>
          {/* dona */}
          <g transform="translate(92 10)"><circle cx="17" cy="17" r="16" /><circle cx="17" cy="17" r="5" /><path d="M6 10l2 1M26 8l-1 2M28 22l-2-1M10 27l1-2M17 4v2" /></g>
          {/* hamburguesa */}
          <g transform="translate(172 22)"><path d="M3 14a15 11 0 0 1 30 0z" /><path d="M2 19h32" /><path d="M3 24c4 2 7-2 11 0s7 2 11 0 6-2 9 0" /><path d="M4 28h28a0 0 0 0 1 0 0 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /></g>
          {/* helado */}
          <g transform="translate(36 92)"><circle cx="14" cy="12" r="10" /><path d="M5 17l9 23 9-23" /><path d="M9 25l9-3M11 31l6-2" /></g>
          {/* pizza */}
          <g transform="translate(110 96)"><path d="M2 4c12-5 24-5 36 0L20 40z" /><path d="M4 9c10-4 22-4 32 0" /><circle cx="15" cy="16" r="2.5" /><circle cx="24" cy="22" r="2.5" /><circle cx="19" cy="29" r="2" /></g>
          {/* cupcake */}
          <g transform="translate(184 96)"><path d="M5 18h26l-4 18H9z" /><path d="M12 18l1 18M18 18v18M24 18l-1 18" /><path d="M4 18a7 7 0 0 1 4-12 10 8 0 0 1 20 0 7 7 0 0 1 4 12" /><circle cx="18" cy="3" r="2" /></g>
          {/* jugo con pitillo */}
          <g transform="translate(18 172)"><path d="M4 10h22l-3 30H7z" /><path d="M5 18h20" /><path d="M17 10l5-10h6" /><circle cx="25" cy="10" r="4" /></g>
          {/* croissant */}
          <g transform="translate(86 182)"><path d="M2 22c4-12 14-18 22-18s18 6 22 18c-5 2-9 0-11-3-3 3-7 4-11 4s-8-1-11-4c-2 3-6 5-11 3z" /><path d="M16 8l3 14M32 8l-3 14M24 4v19" /></g>
          {/* huevo frito */}
          <g transform="translate(160 176)"><path d="M10 6c6-6 16-4 20 2s8 8 4 16-14 12-22 8S0 22 2 14s4-4 8-8z" /><circle cx="18" cy="18" r="6" /></g>
          {/* cubiertos */}
          <g transform="translate(212 170)"><path d="M4 2v12a4 4 0 0 0 8 0V2M8 2v40" /><path d="M20 2c-4 4-4 14 0 18v22" /></g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} stroke="none" />
    </svg>
  )
}

/** Marco del inicio de sesión: franja rosa con el logo y una tarjeta con el formulario. */
function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="auth">
      <Comidas id="pat-fondo" className="auth-fondo" />
      <header className="auth-hero">
        <Comidas id="pat-hero" />
        <div className="auth-logo"><img src="/logo-login.png" alt="Anita Gourmet" /></div>
        <p>Ventas y cuentas</p>
      </header>
      <div className="auth-card">
        <h1>{titulo}</h1>
        {children}
      </div>
      <p className="auth-pie">Anita Gourmet · Solo personal autorizado</p>
    </div>
  )
}

export default function Login() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setEnviando(false)
    if (error) toast('Correo o contraseña incorrectos', true)
  }

  async function recuperar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setEnviando(false)
    if (error) toast('No se pudo enviar el correo: ' + error.message, true)
    else {
      toast('Te enviamos un enlace para crear una nueva contraseña')
      setModo('entrar')
    }
  }

  return (
    <Marco titulo={modo === 'entrar' ? 'Iniciar sesión' : 'Recuperar contraseña'}>
      <form onSubmit={modo === 'entrar' ? entrar : recuperar}>
        {modo === 'recuperar' && <p className="auth-ayuda">Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</p>}
        <label className="field">
          <span>CORREO</span>
          <input id="email" type="email" autoComplete="email" placeholder="tu@correo.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {modo === 'entrar' && (
          <label className="field">
            <span>CONTRASEÑA</span>
            <input id="clave" type="password" autoComplete="current-password" placeholder="••••••••" required value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
        )}
        <button className="btn" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Enviar enlace'}
        </button>
      </form>
      <button type="button" className="auth-link" onClick={() => setModo(modo === 'entrar' ? 'recuperar' : 'entrar')}>
        {modo === 'entrar' ? 'Olvidé mi contraseña' : 'Volver a entrar'}
      </button>
    </Marco>
  )
}

/** Se muestra al abrir el enlace de recuperación, o desde Más → Cambiar contraseña. */
export function CrearClave({ onDone }: { onDone?: () => void }) {
  const toast = useToast()
  const { clearRecovery } = useAuth()
  const [clave, setClave] = useState('')
  const [otra, setOtra] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (clave.length < 8) return toast('Usa al menos 8 caracteres', true)
    if (clave !== otra) return toast('Las contraseñas no coinciden', true)
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) return toast('No se pudo guardar: ' + error.message, true)
    toast('Contraseña guardada')
    clearRecovery()
    onDone?.()
  }

  return (
    <Marco titulo="Crea tu contraseña">
      <form onSubmit={guardar}>
        <label className="field">
          <span>NUEVA CONTRASEÑA</span>
          <input id="nueva" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        <label className="field">
          <span>REPÍTELA</span>
          <input id="nueva2" type="password" autoComplete="new-password" value={otra} onChange={(e) => setOtra(e.target.value)} />
        </label>
        <button className="btn">Guardar contraseña</button>
      </form>
      {onDone && <button type="button" className="auth-link" onClick={onDone}>Cancelar</button>}
    </Marco>
  )
}

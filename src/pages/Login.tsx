import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useToast } from '../lib/store'

/** Marco del inicio de sesión: franja rosa con el logo y una tarjeta con el formulario. */
function Marco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="auth">
      <header className="auth-hero">
        <svg className="auth-deco" aria-hidden="true" viewBox="0 0 390 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <g transform="translate(34 48)"><path d="M0 14h26M3 14c0 9 4 14 10 14s10-5 10-14M8 0v6M14 0v6M20 0v6" /></g>
          <g transform="translate(326 58)"><circle cx="14" cy="14" r="13" /><path d="M7 14h14M14 7v14" /></g>
          <g transform="translate(40 220)"><path d="M2 20 L14 2 L26 20 Z" /><path d="M8 14h12" /></g>
          <g transform="translate(322 214)"><path d="M4 10h20l-3 16H7z" /><path d="M10 10V5h8v5" /></g>
        </svg>
        <div className="auth-logo"><img src="/logo.png" alt="Anita Gourmet" /></div>
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

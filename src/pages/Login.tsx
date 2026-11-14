import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, useToast } from '../lib/store'

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
    <div className="app">
      <div className="login">
        <img src="/logo.png" alt="Anita Gourmet" />
        <form onSubmit={modo === 'entrar' ? entrar : recuperar}>
          <label className="field">
            <span>CORREO</span>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {modo === 'entrar' && (
            <label className="field">
              <span>CONTRASEÑA</span>
              <input id="clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
            </label>
          )}
          <button className="btn" disabled={enviando}>
            {modo === 'entrar' ? 'Entrar' : 'Enviar enlace'}
          </button>
        </form>
        <button className="btn ghost" style={{ margin: '10px 16px 0', border: 0 }} onClick={() => setModo(modo === 'entrar' ? 'recuperar' : 'entrar')}>
          {modo === 'entrar' ? 'Olvidé mi contraseña' : 'Volver a entrar'}
        </button>
      </div>
    </div>
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
    <div className="app">
      <div className="login">
        <img src="/logo.png" alt="Anita Gourmet" />
        <form onSubmit={guardar}>
          <label className="field">
            <span>NUEVA CONTRASEÑA</span>
            <input id="nueva" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
          <label className="field">
            <span>REPÍTELA</span>
            <input id="nueva2" type="password" autoComplete="new-password" value={otra} onChange={(e) => setOtra(e.target.value)} />
          </label>
          <button className="btn">Guardar contraseña</button>
        </form>
      </div>
    </div>
  )
}

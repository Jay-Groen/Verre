import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from './ui'

export function Login({ themeButton }: { themeButton: ReactNode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password' | 'signup'>('magic')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const redirect = window.location.origin + window.location.pathname
    const res =
      mode === 'magic'
        ? await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        : mode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
          : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (res.error) setMsg({ ok: false, text: res.error.message })
    else if (mode === 'magic') setMsg({ ok: true, text: 'Check je mail: we hebben je een inloglink gestuurd.' })
    else if (mode === 'signup') setMsg({ ok: true, text: 'Account aangemaakt. Bevestig je e-mailadres via de link in je mail.' })
  }

  return (
    <div className="login">
      <div className="login-corner">{themeButton}</div>
      <div className="login-card">
        <div className="brand big">
          <img className="logo" src="/favicon.svg" alt="" />
          <Wordmark />
        </div>
        <p className="muted">Plan je reis overzichtelijk: ideeën, dagen, verblijven, kaart en budget op één plek.</p>
        <div className="seg">
          <button className={mode === 'magic' ? 'on' : ''} onClick={() => setMode('magic')}>Inloglink</button>
          <button className={mode === 'password' ? 'on' : ''} onClick={() => setMode('password')}>Wachtwoord</button>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Account maken</button>
        </div>
        <form onSubmit={submit} className="stack">
          <input type="email" required placeholder="jij@voorbeeld.nl" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== 'magic' && (
            <input
              type="password"
              required
              minLength={6}
              placeholder="Wachtwoord"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Even geduld…' : mode === 'magic' ? 'Stuur inloglink' : mode === 'signup' ? 'Account maken' : 'Inloggen'}
          </button>
        </form>
        {msg && <p className={msg.ok ? 'ok' : 'warn-text'}>{msg.text}</p>}
      </div>
    </div>
  )
}

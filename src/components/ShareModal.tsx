import { useEffect, useState } from 'react'
import type { Trip } from '../types'
import { useStore } from '../store'
import { addMember, isEmail, listMembers, removeMember, type Member } from '../lib/sharing'
import { Modal } from './ui'

export function ShareModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { user, access, deleteTrip } = useStore()
  const acc = access[trip.id]
  const isOwner = acc?.owner ?? true
  const me = (user?.email ?? '').toLowerCase()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const load = () =>
    listMembers(trip.id)
      .then(setMembers)
      .catch((e: Error) => {
        setMembers([])
        setError(e.message)
      })
  useEffect(() => {
    load()
    // Alleen bij openen en bij een andere reis.
  }, [trip.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    const e = email.trim().toLowerCase()
    if (!isEmail(e)) return setError('Vul een geldig e-mailadres in')
    if (e === me) return setError('Dat ben jij zelf')
    setBusy(true)
    setError(undefined)
    try {
      await addMember(trip.id, e)
      setEmail('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: Member) => {
    if (!confirm(`${m.email} uit deze reis halen?`)) return
    try {
      await removeMember(trip.id, m.email)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal title="Reis delen" onClose={onClose}>
      <div className="share">
        <p className="muted">
          Medereizigers zien en bewerken dezelfde reis: planning, ideeën, route, boekingen en budget. Wijzigingen
          verschijnen bij de ander vanzelf.
        </p>

        <ul className="members">
          <li>
            <span className="avatar owner" aria-hidden>
              {(isOwner ? me : acc?.ownerEmail ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="grow">
              {isOwner ? me : acc?.ownerEmail ?? 'Eigenaar'}
              {isOwner && <small className="muted"> (jij)</small>}
            </span>
            <span className="badge soft">eigenaar</span>
          </li>
          {members === null && <li className="muted">Laden…</li>}
          {members?.map((m) => (
            <li key={m.email}>
              <span className="avatar" aria-hidden>
                {m.email.charAt(0).toUpperCase()}
              </span>
              <span className="grow">
                {m.email}
                {m.email === me && <small className="muted"> (jij)</small>}
              </span>
              {isOwner && (
                <button className="icon-btn" aria-label={`${m.email} verwijderen`} onClick={() => remove(m)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form
            className="share-add"
            onSubmit={(e) => {
              e.preventDefault()
              invite()
            }}
          >
            <input
              type="email"
              autoFocus
              value={email}
              placeholder="E-mailadres van je medereiziger"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn primary" disabled={busy || !email.trim()}>
              {busy ? 'Bezig…' : 'Uitnodigen'}
            </button>
          </form>
        ) : (
          <button
            className="btn danger ghost"
            onClick={async () => {
              if (!confirm(`“${trip.name}” verlaten? Je ziet de reis daarna niet meer.`)) return
              onClose()
              await deleteTrip(trip.id)
            }}
          >
            Reis verlaten
          </button>
        )}
        {error && <p className="warn-text">{error}</p>}
        {isOwner && (
          <p className="muted small-print">
            Er gaat geen mail uit: laat je medereiziger inloggen in Verre met precies dit e-mailadres, dan verschijnt de reis
            vanzelf in de lijst.
          </p>
        )}
      </div>
    </Modal>
  )
}

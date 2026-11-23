import { useRef, useState } from 'react'
import type { Attachment, Booking } from '../types'
import { useStore } from '../store'
import { MAX_FILE_MB, fmtSize, openFile, removeFiles, saveFile } from '../lib/files'
import { Field } from './ui'

/** Ruimt bijlagen op die bij het opslaan uit een boeking zijn gehaald. */
export function cleanupRemoved(before?: Booking, after?: Booking) {
  const keep = new Set(after?.files?.map((f) => f.id))
  removeFiles(before?.files?.filter((f) => !keep.has(f.id)))
}

/** Maakt een lege boeking undefined, zodat er geen lege objecten worden opgeslagen. */
export function tidyBooking(b?: Booking): Booking | undefined {
  if (!b) return undefined
  const t: Booking = {
    ref: b.ref?.trim() || undefined,
    url: b.url?.trim() || undefined,
    deadline: b.deadline || undefined,
    files: b.files?.length ? b.files : undefined,
  }
  return Object.values(t).some((v) => v !== undefined) ? t : undefined
}

const fileIcon = (a: Attachment) => (a.type.includes('pdf') ? '📄' : a.type.startsWith('image/') ? '🖼️' : '📎')

export function BookingFields({
  value,
  onChange,
  deadlineLabel = 'Boeken / gratis annuleren vóór',
}: {
  value?: Booking
  onChange: (b: Booking) => void
  deadlineLabel?: string
}) {
  const tripId = useStore((s) => s.currentId)
  const b = value ?? {}
  const set = (p: Partial<Booking>) => onChange({ ...b, ...p })
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const upload = async (files: FileList | null) => {
    if (!files?.length || !tripId) return
    setBusy(true)
    setError(undefined)
    const added: Attachment[] = []
    for (const f of Array.from(files)) {
      try {
        added.push(await saveFile(tripId, f))
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`)
      }
    }
    setBusy(false)
    if (added.length) set({ files: [...(b.files ?? []), ...added] })
    if (input.current) input.current.value = ''
  }

  return (
    <>
      <Field label="Bevestigingsnummer">
        <input value={b.ref ?? ''} placeholder="Bijv. ABC123" onChange={(e) => set({ ref: e.target.value })} />
      </Field>
      <Field label={deadlineLabel}>
        <input type="date" value={b.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || undefined })} />
      </Field>
      <Field label="Link naar boeking" wide>
        <input type="url" value={b.url ?? ''} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <div className="field wide">
        <span>Tickets &amp; bevestigingen</span>
        <ul className="files">
          {b.files?.map((f) => (
            <li key={f.id}>
              <button type="button" className="file-open" onClick={() => openFile(f)} title="Openen">
                <span aria-hidden>{fileIcon(f)}</span>
                <span className="file-name">{f.name}</span>
                <small className="muted">{fmtSize(f.size)}</small>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${f.name} verwijderen`}
                onClick={() => set({ files: b.files!.filter((x) => x.id !== f.id) })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn small ghost" disabled={busy || !tripId} onClick={() => input.current?.click()}>
            {busy ? 'Uploaden…' : '+ Bestand toevoegen'}
          </button>
          <small className="muted">PDF of afbeelding, max. {MAX_FILE_MB} MB</small>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept="application/pdf,image/*,.pkpass,.eml,.txt"
          onChange={(e) => upload(e.target.files)}
        />
        {error && <small className="warn-text">{error}</small>}
      </div>
    </>
  )
}

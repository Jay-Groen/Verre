import type { Attachment, Booking } from '../types'
import { supabase } from './supabase'
import { uid } from './plan'

/** Supabase Storage-bucket voor tickets en bevestigingen. */
const BUCKET = 'documents'
export const MAX_FILE_MB = 10

// ---- Lokale opslag (IndexedDB), voor gebruik zonder account ----

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('verre-files', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction('files', mode).objectStore('files'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ---- Publieke functies ----

export async function saveFile(tripId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Bestand is groter dan ${MAX_FILE_MB} MB`)
  const id = uid()
  const base = { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size }
  if (supabase) {
    const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80)
    const path = `${tripId}/${id}-${safe}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: base.type })
    if (error) throw new Error(error.message)
    return { ...base, path, where: 'cloud' }
  }
  await idb('readwrite', (s) => s.put(file, id))
  return { ...base, path: id, where: 'local' }
}

/** Opent een bijlage in een nieuw tabblad. */
export async function openFile(att: Attachment) {
  // Direct een venster openen, anders blokkeert de browser de pop-up na het wachten.
  const w = window.open('', '_blank')
  try {
    let url: string
    if (att.where === 'cloud') {
      if (!supabase) throw new Error('Niet ingelogd')
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.path, 300)
      if (error || !data) throw new Error(error?.message ?? 'Geen link')
      url = data.signedUrl
    } else {
      const blob = await idb<Blob | undefined>('readonly', (s) => s.get(att.path))
      if (!blob) throw new Error('Bestand staat niet op dit apparaat')
      url = URL.createObjectURL(blob)
    }
    if (w) w.location.href = url
    else window.location.href = url
  } catch (e) {
    w?.close()
    alert(`Kan bijlage niet openen: ${(e as Error).message}`)
  }
}

export async function removeFiles(atts: Attachment[] | undefined) {
  if (!atts?.length) return
  const cloud = atts.filter((a) => a.where === 'cloud').map((a) => a.path)
  try {
    if (cloud.length && supabase) await supabase.storage.from(BUCKET).remove(cloud)
    for (const a of atts.filter((x) => x.where === 'local')) await idb('readwrite', (s) => s.delete(a.path))
  } catch {
    /* opruimen is best effort */
  }
}

export const removeBookingFiles = (b?: Booking) => removeFiles(b?.files)

export const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

import type { Attachment, Booking } from '../types'
import { supabase } from './supabase'
import { uid } from './plan'

/** Supabase Storage-bucket voor tickets en bevestigingen. */
const BUCKET = 'documents'
/** Sleutelvoorvoegsel voor offline kopieën van bestanden uit je account. */
const CLOUD = 'cloud:'
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
    // Meteen een offline kopie op dit apparaat.
    await idb('readwrite', (s) => s.put(file, CLOUD + path)).catch(() => undefined)
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
      const cached = await idb<Blob | undefined>('readonly', (s) => s.get(CLOUD + att.path)).catch(() => undefined)
      if (cached) url = URL.createObjectURL(cached)
      else {
        if (!supabase) throw new Error('Niet ingelogd')
        const blob = await downloadCloud(att.path)
        url = URL.createObjectURL(blob)
      }
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
    for (const p of cloud) await idb('readwrite', (s) => s.delete(CLOUD + p))
    for (const a of atts.filter((x) => x.where === 'local')) await idb('readwrite', (s) => s.delete(a.path))
  } catch {
    /* opruimen is best effort */
  }
}

async function downloadCloud(path: string): Promise<Blob> {
  if (!supabase) throw new Error('Niet ingelogd')
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(navigator.onLine ? (error?.message ?? 'Download mislukt') : 'Je bent offline en dit bestand staat nog niet op dit apparaat')
  await idb('readwrite', (s) => s.put(data, CLOUD + path)).catch(() => undefined)
  return data
}

/** Alle bijlagen bij elkaar zoeken (verblijven, vervoer, activiteiten). */
export function allFiles(trip: { stops: { booking?: Booking }[]; legs: { booking?: Booking }[]; activities: { booking?: Booking }[] }) {
  return [...trip.stops, ...trip.legs, ...trip.activities].flatMap((x) => x.booking?.files ?? [])
}

/** Hoeveel bijlagen uit je account staan al op dit apparaat? */
export async function offlineStatus(atts: Attachment[]) {
  const cloud = atts.filter((a) => a.where === 'cloud')
  let have = 0
  for (const a of cloud) if (await idb('readonly', (s) => s.count(CLOUD + a.path)).catch(() => 0)) have++
  return { total: cloud.length, have }
}

/** Downloadt alle bijlagen uit je account naar dit apparaat, voor gebruik zonder internet. */
export async function makeOffline(atts: Attachment[], onProgress?: (done: number) => void) {
  let done = 0
  for (const a of atts.filter((x) => x.where === 'cloud')) {
    const has = await idb('readonly', (s) => s.count(CLOUD + a.path)).catch(() => 0)
    if (!has) await downloadCloud(a.path)
    onProgress?.(++done)
  }
}

/** Wist offline kopieën van bestanden uit je account (bij uitloggen). */
export async function clearCloudFiles() {
  try {
    const d = await db()
    await new Promise<void>((resolve) => {
      const req = d.transaction('files', 'readwrite').objectStore('files').openCursor()
      req.onsuccess = () => {
        const c = req.result
        if (!c) return resolve()
        if (String(c.key).startsWith(CLOUD)) c.delete()
        c.continue()
      }
      req.onerror = () => resolve()
    })
  } catch {
    /* ignore */
  }
}

export const removeBookingFiles = (b?: Booking) => removeFiles(b?.files)

export const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

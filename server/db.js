import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbDir = join(__dirname, '../db')
const dbFile    = join(dbDir, 'inscriptions.json')
const visitFile = join(dbDir, 'visiteurs.json')
const waitFile  = join(dbDir, 'liste-attente.json')
mkdirSync(dbDir, { recursive: true })

function load() {
  try {
    return JSON.parse(readFileSync(dbFile, 'utf8'))
  } catch {
    return { inscriptions: [], nextId: 1 }
  }
}

function save(data) {
  writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8')
}

function loadVisiteurs() {
  try {
    return JSON.parse(readFileSync(visitFile, 'utf8'))
  } catch {
    return { visiteurs: [], nextId: 1 }
  }
}

function saveVisiteurs(data) {
  writeFileSync(visitFile, JSON.stringify(data, null, 2), 'utf8')
}

export function getAllVisiteurs() {
  return loadVisiteurs().visiteurs
}

export function insertVisiteur(data) {
  const db = loadVisiteurs()
  const id = db.nextId++
  db.visiteurs.unshift({
    id,
    created_at: new Date().toISOString(),
    prenom: data.prenom,
    nom: data.nom,
    telephone: data.telephone || '',
    email: data.email || '',
    enfants: data.enfants || '',
    classe_interessee: data.classe_interessee || '',
    semaines_interessees: data.semaines_interessees || [],
    source: data.source || 'visite',
    statut: data.statut || 'a_rappeler',
    notes: data.notes || '',
  })
  saveVisiteurs(db)
  return id
}

export function updateVisiteur(id, data) {
  const db = loadVisiteurs()
  const item = db.visiteurs.find(v => v.id === +id)
  if (item) Object.assign(item, data)
  saveVisiteurs(db)
}

export function deleteVisiteur(id) {
  const db = loadVisiteurs()
  db.visiteurs = db.visiteurs.filter(v => v.id !== +id)
  saveVisiteurs(db)
}

// ── Analytics ────────────────────────────────────────────────────────────────
const analyticsFile = join(dbDir, 'analytics.json')

function loadAnalytics() {
  try { return JSON.parse(readFileSync(analyticsFile, 'utf8')) }
  catch { return { days: {} } }
}

function saveAnalytics(data) {
  writeFileSync(analyticsFile, JSON.stringify(data, null, 2), 'utf8')
}

function getSource(referer) {
  if (!referer) return 'direct'
  if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(referer)) return 'moteur'
  if (/facebook\.|instagram\.|tiktok\.|twitter\.|linkedin\./.test(referer)) return 'reseaux'
  if (/whatsapp\./.test(referer)) return 'whatsapp'
  return 'autre'
}

const visitListeners = []
export function onVisit(cb) { visitListeners.push(cb) }

export function recordVisit({ path, referer, ip }) {
  const db = loadAnalytics()
  const today = new Date().toISOString().slice(0, 10)
  if (!db.days[today]) db.days[today] = { views: 0, uniques: [], pages: {}, sources: {} }
  const day = db.days[today]
  day.views++
  const isNew = !day.uniques.includes(ip)
  if (isNew) day.uniques.push(ip)
  day.pages[path] = (day.pages[path] || 0) + 1
  const src = getSource(referer)
  day.sources[src] = (day.sources[src] || 0) + 1
  const keys = Object.keys(db.days).sort()
  if (keys.length > 90) delete db.days[keys[0]]
  saveAnalytics(db)
  const event = { path, source: src, isNew, time: new Date().toISOString(), todayViews: day.views, todayUniques: day.uniques.length }
  visitListeners.forEach(cb => cb(event))
}

export function getAnalytics() {
  return loadAnalytics()
}

export function insertInscription(data) {
  const db = load()
  const id = db.nextId++
  db.inscriptions.unshift({
    id,
    created_at: new Date().toISOString(),
    parent1_prenom: data.parent1Prenom,
    parent1_nom:    data.parent1Nom,
    parent2_prenom: data.parent2Prenom || '',
    parent2_nom:    data.parent2Nom || '',
    telephone:      data.telephone,
    email:          data.email,
    mode_paiement:  data.modePaiement,
    total:          Number(data.total) || 0,
    accompte:       Number(data.accompte) || 0,
    enfants:        data.enfants,
    statut:                data.statut || 'en_attente',
    email_envoye:          false,
    recu_envoye:           false,
    accompte_mode_paiement: 'cb',
    solde_mode_paiement:   '',
    remise:                0,
    formData:              data,
  })
  save(db)
  return id
}

export function getInscription(id) {
  const db = load()
  return db.inscriptions.find(i => i.id === +id) || null
}

export function markEmailSent(id) {
  const db = load()
  const item = db.inscriptions.find(i => i.id === +id)
  if (item) {
    item.email_envoye = true
    // CB = paiement total → on s'assure qu'accompte reflète le total
    if (item.mode_paiement === 'cb') item.accompte = Number(item.total)
    const isFullyPaid = item.mode_paiement === 'cb' || Number(item.accompte) >= Number(item.total)
    item.statut = isFullyPaid ? 'solde_paye' : 'accompte_paye'
  }
  save(db)
}

export function getAllInscriptions() {
  return load().inscriptions
}

export function markReceiptSent(id) {
  const db = load()
  const item = db.inscriptions.find(i => i.id === +id)
  if (item) item.recu_envoye = true
  save(db)
}

export function updateStatut(id, statut) {
  const db = load()
  const item = db.inscriptions.find(i => i.id === +id)
  if (item) item.statut = statut
  save(db)
}

export function updateInscription(id, data) {
  const db = load()
  const item = db.inscriptions.find(i => i.id === +id)
  if (item) Object.assign(item, data)
  save(db)
}

export function deleteInscription(id) {
  const db = load()
  db.inscriptions = db.inscriptions.filter(i => i.id !== +id)
  save(db)
}

// Compte les enfants par classe ET par semaine (ex: { 'Gan 1': { 1: 5, 2: 3 } })
export function countByClasseAndSemaine() {
  const db = load()
  const counts = {}
  for (const inscription of db.inscriptions) {
    if (inscription.statut === 'annule') continue
    for (const enfant of (inscription.enfants || [])) {
      const { classe, semaines } = enfant
      if (!classe || !semaines) continue
      if (!counts[classe]) counts[classe] = {}
      for (const sid of semaines) {
        counts[classe][sid] = (counts[classe][sid] || 0) + 1
      }
    }
  }
  return counts
}

// ── Liste d'attente ───────────────────────────────────────────────────────────
function loadWait() {
  try { return JSON.parse(readFileSync(waitFile, 'utf8')) } catch { return [] }
}
function saveWait(data) {
  writeFileSync(waitFile, JSON.stringify(data, null, 2), 'utf8')
}

export function getAllListeAttente() {
  return loadWait()
}

export function insertListeAttente(data) {
  const list = loadWait()
  const entry = {
    id: Date.now(),
    created_at: new Date().toISOString(),
    prenom:    data.prenom,
    nom:       data.nom,
    email:     data.email,
    telephone: data.telephone || '',
    classes:   data.classes   || [],
    semaines:  data.semaines  || [],
  }
  list.unshift(entry)
  saveWait(list)
  return entry
}

export function deleteListeAttente(id) {
  const list = loadWait().filter(e => e.id !== Number(id))
  saveWait(list)
}

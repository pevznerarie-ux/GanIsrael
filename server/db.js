import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbDir = join(__dirname, '../db')
const dbFile = join(dbDir, 'inscriptions.json')
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
    total:          data.total,
    accompte:       data.accompte,
    enfants:        data.enfants,
    statut:         'en_attente',
    email_envoye:   false,
    formData:       data,
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
    item.statut = 'accompte_paye'
  }
  save(db)
}

export function getAllInscriptions() {
  return load().inscriptions
}

export function updateStatut(id, statut) {
  const db = load()
  const item = db.inscriptions.find(i => i.id === +id)
  if (item) item.statut = statut
  save(db)
}

export function countByClasse() {
  const db = load()
  const counts = {}
  for (const inscription of db.inscriptions) {
    if (inscription.statut === 'annule') continue
    for (const enfant of (inscription.enfants || [])) {
      if (enfant.classe) counts[enfant.classe] = (counts[enfant.classe] || 0) + 1
    }
  }
  return counts
}

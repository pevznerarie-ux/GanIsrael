import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { insertInscription, getInscription, markEmailSent, getAllInscriptions, updateStatut, countByClasseAndSemaine } from './db.js'
import { sendConfirmationToParent, sendNotificationToAdmin } from './email.js'

const app = express()
const __dirname = dirname(fileURLToPath(import.meta.url))

app.use(express.json())
app.use(cors({ origin: /localhost/ }))

const HA_BASE = 'https://api.helloasso.com'

// Nombre de places maximum par classe (toutes semaines confondues)
const CAPACITES = {
  'Pre Gan': 20,
  'Gan 1':   36,
  'Gan 2':   36,
  'Gan 3':   36,
}

async function getToken() {
  const res = await fetch(`${HA_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.HELLOASSO_CLIENT_ID,
      client_secret: process.env.HELLOASSO_CLIENT_SECRET,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[HelloAsso auth] HTTP ${res.status}: ${body}`)
    throw new Error(`HelloAsso auth failed`)
  }
  const { access_token } = await res.json()
  return access_token
}

function publicUrl(url) {
  const base = process.env.VITE_PUBLIC_URL
  // N'applique la substitution qu'en production (base non-localhost)
  if (!base || base.includes('localhost') || base.includes('127.0.0.1')) return url
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
    return url.includes('merci=1') ? `${base}?merci=1` : base
  }
  return url
}

function authAdmin(req, res) {
  const pwd = req.headers['x-admin-password']
  if (pwd !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Non autorisé' })
    return false
  }
  return true
}

// ── Disponibilités des classes ────────────────────────────────────────────────
app.get('/api/disponibilites', (req, res) => {
  const counts = countByClasseAndSemaine()
  const result = {}
  for (const [classe, max] of Object.entries(CAPACITES)) {
    result[classe] = {}
    for (const sid of [1, 2, 3]) {
      const inscrits = counts[classe]?.[sid] || 0
      result[classe][sid] = { max, inscrits, restantes: Math.max(0, max - inscrits) }
    }
  }
  res.json(result)
})

// ── Checkout HelloAsso ────────────────────────────────────────────────────────
app.post('/api/create-checkout', async (req, res) => {
  const { amount, itemName, returnUrl, backUrl, formData } = req.body

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide' })
  }

  // Vérification des places disponibles par classe × semaine
  if (formData?.enfants) {
    const counts = countByClasseAndSemaine()
    for (const enfant of formData.enfants) {
      const { classe, semaines } = enfant
      if (!classe || !CAPACITES[classe]) continue
      for (const sid of (semaines || [])) {
        if ((counts[classe]?.[sid] || 0) >= CAPACITES[classe]) {
          return res.status(409).json({
            error: `La classe ${classe} est complète pour la semaine ${sid}.`,
            classe, semaine: sid,
          })
        }
      }
    }
  }

  try {
    // 1. Sauvegarde en base de données
    let inscriptionId = null
    if (formData) {
      inscriptionId = insertInscription(formData)
    }

    // 2. Création du checkout HelloAsso (sauf en mode test)
    const safeReturn = publicUrl(returnUrl)
    const safeBack   = publicUrl(backUrl)

    // On inclut l'ID dans l'URL de retour pour confirmer le paiement après
    const returnWithId = safeReturn.includes('?')
      ? `${safeReturn}&id=${inscriptionId}`
      : `${safeReturn}?id=${inscriptionId}`

    let redirectUrl

    if (process.env.TEST_MODE === 'true') {
      console.log('[TEST MODE] Paiement HelloAsso ignoré')
      redirectUrl = returnWithId
    } else {
      const token = await getToken()
      const slug = process.env.HELLOASSO_ORG_SLUG
      console.log(`[HelloAsso] slug="${slug}" amount=${Math.round(amount * 100)} returnUrl=${returnWithId}`)

      const response = await fetch(
        `${HA_BASE}/v5/organizations/${slug}/checkout-intents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            totalAmount: Math.round(amount * 100),
            initialAmount: Math.round(amount * 100),
            itemName,
            backUrl: safeBack,
            errorUrl: safeBack,
            returnUrl: returnWithId,
            containsDonation: false,
          }),
        }
      )

      const rawText = await response.text()
      console.log(`[HelloAsso] HTTP ${response.status}: ${rawText}`)
      if (!response.ok) {
        return res.status(502).json({ error: 'HelloAsso error', status: response.status, body: rawText })
      }
      const data = JSON.parse(rawText)
      if (!data.redirectUrl) {
        return res.status(502).json({ error: 'HelloAsso no redirectUrl', details: data })
      }
      redirectUrl = data.redirectUrl
    }

    res.json({ url: redirectUrl })

  } catch (err) {
    console.error('[checkout]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Confirmation de paiement (appelé depuis la page merci) ───────────────────
app.post('/api/confirm-payment', async (req, res) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'ID manquant' })

  const inscription = getInscription(id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })

  // Éviter l'envoi en double si déjà traité
  if (inscription.email_envoye) {
    console.log(`[confirm-payment] #${id} déjà traité`)
    return res.json({ ok: true, alreadySent: true })
  }

  const formData = inscription.formData
  if (!formData) return res.status(500).json({ error: 'Données manquantes' })

  // Marquer comme traité avant l'envoi async pour éviter les doublons
  markEmailSent(id)

  // Envoi emails
  console.log('[Email] Envoi vers parent:', formData.email)
  sendConfirmationToParent(formData)
    .then(() => console.log('[Email parent] ✓ Envoyé à', formData.email))
    .catch(e => console.error('[Email parent] ✗ ERREUR:', e.message))

  sendNotificationToAdmin(formData, id)
    .then(() => console.log('[Email admin] ✓ Envoyé'))
    .catch(e => console.error('[Email admin] ✗ ERREUR:', e.message))

  // Sync Google Sheets — une ligne par enfant
  const sheetsUrl = process.env.SHEETS_WEBHOOK
  if (sheetsUrl && formData.enfants) {
    formData.enfants.forEach((enfant, idx) => {
      fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          enfantIndex: idx + 1,
          nombreEnfants: formData.enfants.length,
          parent1Prenom: formData.parent1Prenom,
          parent1Nom: formData.parent1Nom,
          parent2Prenom: formData.parent2Prenom || '',
          parent2Nom: formData.parent2Nom || '',
          telephone: formData.telephone,
          email: formData.email,
          modePaiement: formData.modePaiement,
          total: formData.total,
          accompte: formData.accompte,
          enfant,
        }),
      })
        .then(r => r.json())
        .then(r => console.log(`[Sheets] ✓ Enfant ${idx + 1}:`, r))
        .catch(e => console.error('[Sheets] ✗ ERREUR:', e.message))
    })
  }

  res.json({ ok: true })
})

// ── Admin — liste des inscriptions ───────────────────────────────────────────
app.get('/api/admin/inscriptions', (req, res) => {
  if (!authAdmin(req, res)) return
  const rows = getAllInscriptions()
  res.json(rows)
})

// ── Admin — mise à jour statut ────────────────────────────────────────────────
app.patch('/api/admin/inscriptions/:id/statut', (req, res) => {
  if (!authAdmin(req, res)) return
  const { statut } = req.body
  const VALID = ['en_attente', 'accompte_paye', 'solde_paye', 'annule']
  if (!VALID.includes(statut)) return res.status(400).json({ error: 'Statut invalide' })
  updateStatut(req.params.id, statut)
  res.json({ ok: true })
})

// Servir le build React en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')))
  app.get('*', (_, res) => res.sendFile(join(__dirname, '../dist/index.html')))
}

const PORT = process.env.API_PORT || process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`))

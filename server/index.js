import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { insertInscription, getInscription, markEmailSent, getAllInscriptions, updateStatut, updateInscription, deleteInscription, countByClasseAndSemaine, getAllVisiteurs, insertVisiteur, updateVisiteur, deleteVisiteur, recordVisit, getAnalytics, onVisit } from './db.js'
import { sendConfirmationToParent, sendNotificationToAdmin, sendReceiptToParent } from './email.js'
import { generateReceiptPDF } from './receipt.js'

const app = express()
const __dirname = dirname(fileURLToPath(import.meta.url))

app.use(express.json())
app.use(cors({ origin: /localhost/ }))

// ── Tracking des visites (pages HTML uniquement) ──────────────────────────────
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.match(/\.(js|css|png|ico|svg|woff|map)$/)) {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()
    recordVisit({ path: req.path || '/', referer: req.headers.referer || '', ip })
  }
  next()
})

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

function getRole(user, pwd) {
  if (user === process.env.ADMIN_USER && pwd === process.env.ADMIN_PASSWORD) return 'admin'
  if (user === process.env.ANIMATRICE_USER && pwd === process.env.ANIMATRICE_PASSWORD) return 'animatrice'
  return null
}

function authAdmin(req, res) {
  const user = req.headers['x-admin-user']
  const pwd  = req.headers['x-admin-password']
  if (!getRole(user, pwd)) {
    res.status(401).json({ error: 'Non autorisé' })
    return false
  }
  return true
}

app.post('/api/admin/login', (req, res) => {
  const { user, password } = req.body
  const role = getRole(user, password)
  if (!role) return res.status(401).json({ error: 'Identifiants incorrects' })
  res.json({ role })
})

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

// ── Admin — saisie manuelle d'inscription ────────────────────────────────────
app.post('/api/admin/inscriptions', (req, res) => {
  if (!authAdmin(req, res)) return
  const data = req.body
  const id = insertInscription(data)
  // Sync Google Sheets
  const sheetsUrl = process.env.SHEETS_WEBHOOK
  if (sheetsUrl && data.enfants) {
    data.enfants.forEach((enfant, idx) => {
      fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, enfantIndex: idx + 1, nombreEnfants: data.enfants.length,
          parent1Prenom: data.parent1Prenom, parent1Nom: data.parent1Nom,
          parent2Prenom: data.parent2Prenom || '', parent2Nom: data.parent2Nom || '',
          telephone: data.telephone, email: data.email,
          modePaiement: data.modePaiement, total: data.total, accompte: data.accompte, enfant,
        }),
      }).catch(() => {})
    })
  }
  res.json({ ok: true, id })
})

// ── Admin — modifier une inscription (ajouter enfant, totaux…) ──────────────
app.patch('/api/admin/inscriptions/:id', (req, res) => {
  if (!authAdmin(req, res)) return
  updateInscription(req.params.id, req.body)
  res.json({ ok: true })
})

// ── Admin — supprimer une inscription ────────────────────────────────────────
app.delete('/api/admin/inscriptions/:id', (req, res) => {
  if (!authAdmin(req, res)) return
  deleteInscription(req.params.id)
  res.json({ ok: true })
})

// ── Admin — liste des inscriptions ───────────────────────────────────────────
app.get('/api/admin/inscriptions', (req, res) => {
  if (!authAdmin(req, res)) return
  const rows = getAllInscriptions()
  res.json(rows)
})

// ── Admin — analytics ────────────────────────────────────────────────────────
app.get('/api/admin/analytics', (req, res) => {
  if (!authAdmin(req, res)) return
  res.json(getAnalytics())
})

// SSE clients connectés
const liveClients = new Set()
onVisit((event) => {
  for (const client of liveClients) {
    client.write(`data: ${JSON.stringify(event)}\n\n`)
  }
})

app.get('/api/admin/analytics/live', (req, res) => {
  const user = req.headers['x-admin-user']
  const pwd  = req.headers['x-admin-password']
  if (!getRole(user, pwd)) return res.status(401).end()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Envoyer le nombre de clients connectés
  res.write(`data: ${JSON.stringify({ type: 'init', clients: liveClients.size + 1 })}\n\n`)
  liveClients.add(res)

  // Heartbeat toutes les 30s pour garder la connexion ouverte
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 30000)

  req.on('close', () => {
    liveClients.delete(res)
    clearInterval(heartbeat)
  })
})

// ── Admin — visiteurs ─────────────────────────────────────────────────────────
app.get('/api/admin/visiteurs', (req, res) => {
  if (!authAdmin(req, res)) return
  res.json(getAllVisiteurs())
})

app.post('/api/admin/visiteurs', (req, res) => {
  if (!authAdmin(req, res)) return
  const id = insertVisiteur(req.body)
  res.json({ ok: true, id })
})

app.patch('/api/admin/visiteurs/:id', (req, res) => {
  if (!authAdmin(req, res)) return
  updateVisiteur(req.params.id, req.body)
  res.json({ ok: true })
})

app.delete('/api/admin/visiteurs/:id', (req, res) => {
  if (!authAdmin(req, res)) return
  deleteVisiteur(req.params.id)
  res.json({ ok: true })
})

// ── Admin — envoyer le reçu PDF par email ────────────────────────────────────
app.post('/api/admin/inscriptions/:id/send-receipt', async (req, res) => {
  if (!authAdmin(req, res)) return

  const inscription = getInscription(req.params.id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })

  const data = inscription.formData
  if (!data) return res.status(500).json({ error: 'Données manquantes' })

  try {
    const pdfBuffer = await generateReceiptPDF(inscription, inscription.id)
    await sendReceiptToParent(data, inscription.id, pdfBuffer)
    console.log(`[Reçu] ✓ Envoyé à ${data.email} pour inscription #${inscription.id}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Reçu] ✗ ERREUR:', err.message)
    res.status(500).json({ error: err.message })
  }
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

import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import { insertInscription, getInscription, markEmailSent, markReceiptSent, getAllInscriptions, updateStatut, updateInscription, deleteInscription, countByClasseAndSemaine, getAllVisiteurs, insertVisiteur, updateVisiteur, deleteVisiteur, recordVisit, getAnalytics, onVisit, getAllListeAttente, insertListeAttente, deleteListeAttente, updateListeAttente, createToken, getTokenData } from './db.js'
import { sendConfirmationToParent, sendNotificationToAdmin, sendReceiptToParent, sendReminderToParent, sendPaymentRetryEmail, sendWaitingListConfirmation, sendWaitingListAcceptance } from './email.js'
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
  if (!process.env.HELLOASSO_CLIENT_ID || !process.env.HELLOASSO_CLIENT_SECRET) {
    throw new Error('HelloAsso credentials manquants (HELLOASSO_CLIENT_ID / HELLOASSO_CLIENT_SECRET)')
  }
  let res
  try {
    res = await fetch(`${HA_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.HELLOASSO_CLIENT_ID,
        client_secret: process.env.HELLOASSO_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    const cause = err.cause ? ` — cause: ${err.cause?.code || err.cause?.message || String(err.cause)}` : ''
    console.error(`[HelloAsso auth] fetch failed${cause}`)
    throw new Error(`HelloAsso injoignable${cause}`)
  }
  if (!res.ok) {
    const body = await res.text()
    console.error(`[HelloAsso auth] HTTP ${res.status}: ${body}`)
    throw new Error(`HelloAsso auth failed (HTTP ${res.status})`)
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

// ── Diagnostic connectivité HelloAsso ────────────────────────────────────────
app.get('/api/diag/helloasso', async (req, res) => {
  const results = {}
  // Test DNS + TCP vers HelloAsso
  try {
    const r = await fetch('https://api.helloasso.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'test', client_secret: 'test' }),
      signal: AbortSignal.timeout(8000),
    })
    results.network = 'ok'
    results.http_status = r.status
    results.http_body = await r.text()
  } catch (err) {
    results.network = 'FAILED'
    results.error = err.message
    results.cause_code = err.cause?.code || null
    results.cause_msg  = err.cause?.message || null
  }
  results.env = {
    has_client_id:     !!process.env.HELLOASSO_CLIENT_ID,
    has_client_secret: !!process.env.HELLOASSO_CLIENT_SECRET,
    org_slug:          process.env.HELLOASSO_ORG_SLUG || '(manquant)',
    test_mode:         process.env.TEST_MODE || 'false',
  }
  res.json(results)
})

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

    const testMode = process.env.TEST_MODE === 'true'
    if (testMode) {
      console.log('[TEST MODE] Paiement HelloAsso ignoré — désactiver TEST_MODE en prod !')
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

    res.json({ url: redirectUrl, testMode })

  } catch (err) {
    const cause = err.cause ? ` — cause: ${err.cause?.code || err.cause?.message || String(err.cause)}` : ''
    console.error('[checkout]', err.message + cause)
    res.status(500).json({ error: err.message, cause: err.cause?.code || err.cause?.message || null })
  }
})

// ── Confirmation de paiement (appelé depuis la page merci) ───────────────────
app.post('/api/confirm-payment', async (req, res) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'ID manquant' })

  const inscription = getInscription(id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })

  // Déjà traité : si un solde restait dû, ce retour de paiement = paiement de relance
  // → on solde le CRM (couvre aussi les anciens liens sans marqueur solde=1)
  if (inscription.email_envoye) {
    const solde = Number(inscription.total) - Number(inscription.accompte)
    if (solde > 0 && inscription.statut !== 'solde_paye' && inscription.statut !== 'annule') {
      updateInscription(id, {
        accompte:            Number(inscription.total),
        statut:              'solde_paye',
        solde_mode_paiement: 'cb',
      })
      console.log(`[confirm-payment] #${id} → solde réglé via relance (${inscription.total} €)`)
      return res.json({ ok: true, soldePaid: true })
    }
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

// ── Confirmation paiement de solde (retour d'un lien de relance) ─────────────
// Met à jour le CRM : solde réglé → accompte = total, statut = solde_paye
app.post('/api/confirm-solde-payment', async (req, res) => {
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'ID manquant' })

  const inscription = getInscription(id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })

  if (inscription.statut === 'solde_paye') {
    console.log(`[confirm-solde] #${id} déjà soldé`)
    return res.json({ ok: true, alreadyPaid: true })
  }

  updateInscription(id, {
    accompte:            Number(inscription.total),
    statut:              'solde_paye',
    solde_mode_paiement: 'cb',
  })
  console.log(`[confirm-solde] ✓ #${id} → solde réglé via relance (${inscription.total} €)`)
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
    markReceiptSent(req.params.id)
    console.log(`[Reçu] ✓ Envoyé à ${data.email} pour inscription #${inscription.id}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Reçu] ✗ ERREUR:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Admin — relance paiement non abouti ──────────────────────────────────────
// Génère un lien de paiement HelloAsso pour le solde restant d'une inscription.
// `token` optionnel : à fournir pour réutiliser le même token sur une série d'appels (relance générale).
async function createSoldeCheckoutUrl(inscription, token) {
  const base = process.env.VITE_PUBLIC_URL || 'https://ganisrael.up.railway.app'
  // Montant à payer : solde restant (total - accompte) si un acompte a déjà été versé,
  // sinon paiement complet (total)
  const soldeRestant = Number(inscription.total) - Number(inscription.accompte)
  const amount = soldeRestant > 0 ? soldeRestant : Number(inscription.total)
  // solde=1 : au retour, le CRM marque le solde réglé (paiement de relance)
  const returnUrl = `${base}?merci=1&id=${inscription.id}&solde=1`

  if (process.env.TEST_MODE === 'true') {
    console.log('[TEST MODE] Relance paiement — HelloAsso ignoré')
    return returnUrl
  }

  const slug = process.env.HELLOASSO_ORG_SLUG
  const itemName = `Gan Israel — Inscription #${inscription.id}`
  console.log(`[Relance HelloAsso] slug="${slug}" amount=${Math.round(amount * 100)} return=${returnUrl}`)

  const response = await fetch(
    `${HA_BASE}/v5/organizations/${slug}/checkout-intents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token || await getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalAmount:      Math.round(amount * 100),
        initialAmount:    Math.round(amount * 100),
        itemName,
        backUrl:          base,
        errorUrl:         base,
        returnUrl,
        containsDonation: false,
      }),
    }
  )

  const rawText = await response.text()
  console.log(`[Relance HelloAsso] HTTP ${response.status}: ${rawText}`)
  if (!response.ok) throw new Error(`HelloAsso error (HTTP ${response.status}): ${rawText}`)
  const data = JSON.parse(rawText)
  if (!data.redirectUrl) throw new Error(`HelloAsso: pas de redirectUrl reçu — ${rawText}`)
  return data.redirectUrl
}

app.post('/api/admin/inscriptions/:id/relance-paiement', async (req, res) => {
  if (!authAdmin(req, res)) return
  const inscription = getInscription(req.params.id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })

  try {
    const checkoutUrl = await createSoldeCheckoutUrl(inscription)
    await sendPaymentRetryEmail(inscription, checkoutUrl)
    console.log(`[Relance paiement] ✓ #${inscription.id} → ${inscription.email}`)
    res.json({ ok: true })
  } catch (err) {
    const cause = err.cause ? ` — cause: ${err.cause?.code || err.cause?.message || String(err.cause)}` : ''
    console.error('[Relance paiement] ✗', err.message + cause)
    res.status(500).json({ error: err.message + cause })
  }
})

// ── Admin — mise à jour statut ────────────────────────────────────────────────
app.patch('/api/admin/inscriptions/:id/statut', (req, res) => {
  if (!authAdmin(req, res)) return
  const { statut } = req.body
  const VALID = ['en_attente', 'accompte_paye', 'solde_paye', 'annule', 'archive', 'attente_validation']
  if (!VALID.includes(statut)) return res.status(400).json({ error: 'Statut invalide' })

  if (statut === 'solde_paye') {
    const inscription = getInscription(req.params.id)
    if (inscription) {
      updateInscription(req.params.id, { statut, accompte: Number(inscription.total) })
      return res.json({ ok: true })
    }
  }

  updateStatut(req.params.id, statut)
  res.json({ ok: true })
})

// ── Inscription directe espèces (sans HelloAsso) ─────────────────────────────
app.post('/api/inscription-especes', async (req, res) => {
  const { formData } = req.body
  if (!formData?.enfants || !formData.email || !formData.parent1Prenom) {
    return res.status(400).json({ error: 'Données manquantes' })
  }

  // Vérification des places disponibles
  const counts = countByClasseAndSemaine()
  for (const enfant of formData.enfants) {
    const { classe, semaines } = enfant
    if (!classe || !CAPACITES[classe]) continue
    for (const sid of (semaines || [])) {
      if ((counts[classe]?.[sid] || 0) >= CAPACITES[classe]) {
        return res.status(409).json({ error: `La classe ${classe} est complète pour la semaine ${sid}.`, classe, semaine: sid })
      }
    }
  }

  try {
    const id = insertInscription({ ...formData, modePaiement: 'autre', accompte: 0, statut: 'attente_validation' })
    console.log(`[inscription-especes] ✓ Créée #${id} — ${formData.parent1Prenom} ${formData.parent1Nom}`)
    res.json({ ok: true, id })
  } catch (err) {
    console.error('[inscription-especes]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Admin — valider une inscription espèces (envoie l'email) ─────────────────
app.post('/api/admin/inscriptions/:id/valider', async (req, res) => {
  if (!authAdmin(req, res)) return

  const inscription = getInscription(req.params.id)
  if (!inscription) return res.status(404).json({ error: 'Inscription introuvable' })
  if (inscription.email_envoye) return res.json({ ok: true, alreadySent: true })

  const formData = inscription.formData
  if (!formData) return res.status(500).json({ error: 'Données manquantes' })

  try {
    updateInscription(req.params.id, { email_envoye: true, statut: 'en_attente' })

    sendConfirmationToParent(formData)
      .then(() => console.log(`[Valider] ✓ Email parent → ${formData.email}`))
      .catch(e => console.error('[Valider] ✗ Email parent:', e.message))

    sendNotificationToAdmin(formData, inscription.id)
      .then(() => console.log('[Valider] ✓ Email admin'))
      .catch(e => console.error('[Valider] ✗ Email admin:', e.message))

    // Sync Google Sheets
    const sheetsUrl = process.env.SHEETS_WEBHOOK
    if (sheetsUrl && formData.enfants) {
      formData.enfants.forEach((enfant, idx) => {
        fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: inscription.id, enfantIndex: idx + 1, nombreEnfants: formData.enfants.length,
            parent1Prenom: formData.parent1Prenom, parent1Nom: formData.parent1Nom,
            parent2Prenom: formData.parent2Prenom || '', parent2Nom: formData.parent2Nom || '',
            telephone: formData.telephone, email: formData.email,
            modePaiement: 'autre', total: formData.total, accompte: 0, enfant,
          }),
        }).catch(e => console.error('[Sheets]', e.message))
      })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[valider]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Admin — fusionner deux inscriptions (doublons) ───────────────────────────
app.post('/api/admin/inscriptions/merge', (req, res) => {
  if (!authAdmin(req, res)) return
  const { keepId, deleteId } = req.body
  if (!keepId || !deleteId) return res.status(400).json({ error: 'Paramètres manquants' })

  const keeper = getInscription(keepId)
  const other  = getInscription(deleteId)
  if (!keeper || !other) return res.status(404).json({ error: 'Inscription introuvable' })

  // Fusionner les enfants (dédoublonnage par prénom+nom)
  const seen = new Set()
  const enfants = [...keeper.enfants, ...other.enfants].filter(e => {
    const key = `${(e.prenom || '').toLowerCase()}-${(e.nom || '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const total    = Number(keeper.total)    + Number(other.total)
  const accompte = Number(keeper.accompte) + Number(other.accompte)

  // Garder le statut le plus avancé
  const ORDRE = ['attente_validation', 'en_attente', 'accompte_paye', 'solde_paye', 'archive', 'annule']
  const statut = ORDRE.indexOf(keeper.statut) >= ORDRE.indexOf(other.statut) ? keeper.statut : other.statut

  updateInscription(keepId, { enfants, total, accompte, statut })
  deleteInscription(deleteId)
  console.log(`[Merge] #${deleteId} fusionné dans #${keepId}`)
  res.json({ ok: true })
})

// ── Admin — relance email groupée (soldes non réglés) ────────────────────────
app.post('/api/admin/relance-email', async (req, res) => {
  if (!authAdmin(req, res)) return

  const all = getAllInscriptions()
  const avecSolde = all.filter(i =>
    i.statut !== 'annule' &&
    i.statut !== 'solde_paye' &&
    (Number(i.total) - Number(i.accompte)) > 0 &&
    i.email
  )

  // Un seul token HelloAsso réutilisé pour toute la série de liens de paiement
  let token = null
  try {
    if (process.env.TEST_MODE !== 'true') token = await getToken()
  } catch (err) {
    return res.status(502).json({ error: `HelloAsso injoignable : ${err.message}` })
  }

  let sent = 0, errors = []
  for (const insc of avecSolde) {
    try {
      const checkoutUrl = await createSoldeCheckoutUrl(insc, token)
      await sendReminderToParent(insc, checkoutUrl)
      sent++
      console.log(`[Relance] ✓ ${insc.parent1_prenom} ${insc.parent1_nom} <${insc.email}>`)
    } catch (err) {
      errors.push({ id: insc.id, email: insc.email, error: err.message })
      console.error(`[Relance] ✗ #${insc.id} ${insc.email}: ${err.message}`)
    }
  }

  res.json({ ok: true, sent, errors, total: avecSolde.length })
})

// ── Admin — envoi d'un email de relance TEST (une seule adresse, données fictives) ──
app.post('/api/admin/relance-email/test', async (req, res) => {
  if (!authAdmin(req, res)) return
  const email = (req.body?.email || '').trim()
  if (!email) return res.status(400).json({ error: 'Email requis' })

  // Inscription fictive représentative pour visualiser l'email de relance
  const sample = {
    id: 'TEST',
    email,
    parent1_prenom: 'Parent',
    parent1_nom: 'Test',
    total: 525,
    accompte: 180,
    enfants: [{ prenom: 'Lévi', nom: 'Test', classe: 'Gan 1', semaines: [1, 2, 3], garderie: [1] }],
  }

  try {
    const checkoutUrl = await createSoldeCheckoutUrl(sample)
    await sendReminderToParent(sample, checkoutUrl)
    console.log(`[Relance TEST] ✓ → ${email}`)
    res.json({ ok: true, email })
  } catch (err) {
    const cause = err.cause ? ` — cause: ${err.cause?.code || err.cause?.message || String(err.cause)}` : ''
    console.error('[Relance TEST] ✗', err.message + cause)
    res.status(500).json({ error: err.message + cause })
  }
})

// ── Liste d'attente ───────────────────────────────────────────────────────────
app.post('/api/liste-attente', async (req, res) => {
  const { prenom, nom, email, telephone, classes, semaines } = req.body
  if (!prenom || !nom || !email) return res.status(400).json({ error: 'Prenom, nom et email requis' })
  try {
    const entry = insertListeAttente({ prenom, nom, email, telephone, classes, semaines })
    try { await sendWaitingListConfirmation(entry) } catch (e) { console.error('[WL email]', e.message) }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/liste-attente', (req, res) => {
  if (!authAdmin(req, res)) return
  res.json(getAllListeAttente())
})

app.delete('/api/admin/liste-attente/:id', (req, res) => {
  if (!authAdmin(req, res)) return
  deleteListeAttente(req.params.id)
  res.json({ ok: true })
})

app.post('/api/admin/liste-attente/:id/accept', async (req, res) => {
  if (!authAdmin(req, res)) return
  const all = getAllListeAttente()
  const entry = all.find(e => e.id === Number(req.params.id))
  if (!entry) return res.status(404).json({ error: 'Entree introuvable' })

  const token = createToken({ ...entry, listeAttenteId: entry.id })
  const base = process.env.VITE_PUBLIC_URL || 'https://ganisrael.up.railway.app'
  const inscriptionUrl = `${base}/inscription?token=${token.token}`

  try {
    await sendWaitingListAcceptance(entry, inscriptionUrl)
    updateListeAttente(entry.id, { accepted_at: new Date().toISOString(), inscription_url: inscriptionUrl })
    res.json({ ok: true, url: inscriptionUrl })
  } catch (err) {
    console.error('[accept]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/inscription-token/:token', (req, res) => {
  const data = getTokenData(req.params.token)
  if (!data) return res.status(404).json({ error: 'Lien invalide ou expire' })
  res.json(data)
})

// Servir le build React en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')))
  app.get('*', (_, res) => res.sendFile(join(__dirname, '../dist/index.html')))
}

const PORT = process.env.API_PORT || process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`))

import { Resend } from 'resend'
import 'dotenv/config'

let resend = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else {
  console.error('[Email] ⚠️  RESEND_API_KEY manquant — les emails ne seront PAS envoyés')
}

async function sendEmail(options) {
  if (!resend) {
    console.error('[Email] Resend non initialisé — email à', options.to, 'non envoyé (RESEND_API_KEY manquant)')
    return
  }
  await resend.emails.send(options)
}
const LOGO_URL = `${process.env.VITE_PUBLIC_URL || 'https://ganisrael.up.railway.app'}/logo-gan-israel.png`

const SEMAINE_LABELS = { 1: '6–10 juillet', 2: '13–17 juillet', 3: '20–24 juillet' }
const basePrice = (n) => n === 3 ? 525 : n * 180
const garderiePrice = (garderie) => (garderie?.length || 0) * 20
const totalForChild = (e) => basePrice(e.semaines.length) + garderiePrice(e.garderie)

// ── Email de confirmation au parent ──────────────────────────────────────────
export async function sendConfirmationToParent(data) {
  const { email, parent1Prenom, parent1Nom, enfants, total, accompte, modePaiement } = data
  const solde = total - accompte

  const enfantsHtml = enfants.map(e => {
    const semainesText = e.semaines.map(s => {
      const label = SEMAINE_LABELS[s]
      const hasGarderie = e.garderie?.includes(s)
      return hasGarderie ? `${label} <em>(+ garderie)</em>` : label
    }).join('<br>')
    return `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${e.prenom} ${e.nom}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${e.classe}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${semainesText}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700">${totalForChild(e)} €</td>
    </tr>`
  }).join('')

  const modePaiementLabel = { especes_cheque: 'Espèces / Chèque', cb: 'Carte bancaire' }[modePaiement] || modePaiement

  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: email,
    subject: "Confirmation d'inscription — Gan Israel Beth Hillel",
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Centre Aéré Maternelle — Levallois-Perret</p>
  </div>

  <div style="padding:32px">
    <h2 style="color:#1e3a8a;margin:0 0 8px">Inscription confirmée !</h2>
    <p style="color:#475569;margin:0 0 24px">Bonjour <strong>${parent1Prenom} ${parent1Nom}</strong>,</p>

    <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
      <p style="margin:0 0 12px;color:#1e3a8a;font-size:16px;font-weight:700">
        Bonjour, l'inscription de <strong>${enfants.map(e => `${e.prenom} ${e.nom}`).join(' et ')}</strong> au Gan Israel est bien confirmée.
      </p>
      ${solde > 0
        ? `<p style="margin:0;color:#1e3a8a;font-size:14px">
            Un accompte de <strong>${accompte} €</strong> a bien été reçu.<br>
            Il reste un solde de <strong>${solde} €</strong> à remettre en espèces ou par chèque à <strong>Mora Elodie</strong> avant le <strong>15 juin</strong> au plus tard.
           </p>`
        : `<p style="margin:0;color:#1e3a8a;font-size:15px">
            Maintenant, il vous reste qu'à vous mettre dans la bonne humeur car c'est un mois inoubliable qui vous attend. 🌟
           </p>`
      }
    </div>

    <h3 style="color:#1e3a8a;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Récapitulatif</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#eff6ff">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Enfant</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Classe</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Semaines</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Prix</th>
        </tr>
      </thead>
      <tbody>${enfantsHtml}</tbody>
    </table>

    <table width="100%" style="margin-bottom:24px">
      <tr>
        <td style="padding:4px 0;color:#475569">Total</td>
        <td style="padding:4px 0;text-align:right;font-weight:800;color:#1e3a8a;font-size:18px">${total} €</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#475569">${solde > 0 ? 'Acompte réglé via HelloAsso' : 'Total réglé via HelloAsso 💳'}</td>
        <td style="padding:4px 0;text-align:right;color:#16a34a;font-weight:700">${accompte} € ✓</td>
      </tr>
      ${solde > 0 ? `<tr>
        <td style="padding:4px 0;color:#475569">Reste à régler (${modePaiementLabel})</td>
        <td style="padding:4px 0;text-align:right;font-weight:700;color:#dc2626">${solde} €</td>
      </tr>` : ''}
    </table>

    ${solde > 0 ? `<div style="background:#fef9ee;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px">
      <p style="margin:0;font-size:14px;color:#92400e">💡 Le solde de <strong>${solde} €</strong> est à remettre en espèces ou par chèque à <strong>Mora Elodie</strong> avant le <strong>15 juin</strong> au plus tard.</p>
    </div>` : ''}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
  })
}

// ── Envoi du reçu PDF au parent ──────────────────────────────────────────────
export async function sendReceiptToParent(data, inscriptionId, pdfBuffer) {
  const { email, parent1Prenom, parent1Nom, enfants } = data
  const enfantsNoms = enfants.map(e => `${e.prenom} ${e.nom}`).join(' et ')

  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: email,
    subject: `Votre reçu d'inscription — Gan Israel Beth Hillel`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Centre Aéré Maternelle — Levallois-Perret</p>
  </div>

  <div style="padding:32px">
    <p style="color:#475569;margin:0 0 20px;font-size:15px">
      Bonjour <strong>${parent1Prenom} ${parent1Nom}</strong>,
    </p>
    <p style="color:#475569;margin:0 0 20px;font-size:15px;line-height:1.7">
      Veuillez trouver ci-joint votre <strong>reçu d'inscription</strong> pour
      <strong>${enfantsNoms}</strong> au Gan Israel Beth Hillel.
    </p>
    <p style="color:#475569;margin:0 0 20px;font-size:15px;line-height:1.7">
      N'hésitez pas à nous contacter pour toute question.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
    attachments: [
      {
        filename: `recu-inscription-${inscriptionId}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}

// ── Relance de solde aux parents ─────────────────────────────────────────────
export async function sendReminderToParent(insc, checkoutUrl) {
  const email   = insc.email
  const prenom  = insc.parent1_prenom
  const nom     = insc.parent1_nom
  const enfants = insc.enfants || []
  const solde   = Number(insc.total) - Number(insc.accompte)
  const enfantsNoms = enfants.map(e => `${e.prenom} ${e.nom}`).join(' et ')

  const semainesHtml = enfants.map(e => {
    const lignes = (e.semaines || []).map(s => {
      const hasGarderie = e.garderie?.includes(s)
      return `S${s} — ${SEMAINE_LABELS[s] || `Semaine ${s}`}${hasGarderie ? ' <em>(+ garderie)</em>' : ''}`
    }).join('<br>') || '—'
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${e.prenom} ${e.nom}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${e.classe || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${lignes}</td>
    </tr>`
  }).join('')

  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: email,
    subject: `⚠️ Rappel règlement — Solde de ${solde} € à régler — Gan Israel Beth Hillel`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Centre Aéré Maternelle — Levallois-Perret</p>
  </div>

  <div style="padding:32px">
    <p style="color:#475569;margin:0 0 16px;font-size:15px">Bonjour <strong>${prenom} ${nom}</strong>,</p>

    <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
      <p style="margin:0 0 8px;color:#9a3412;font-size:16px;font-weight:700">
        Nous sommes aujourd'hui le <strong>15 juin</strong>, date limite de règlement, et nous n'avons toujours pas reçu le solde de <strong>${solde} €</strong> pour l'inscription de <strong>${enfantsNoms}</strong>.
      </p>
      <p style="margin:0 0 8px;color:#9a3412;font-size:14px">
        ${checkoutUrl
          ? `Le plus simple : réglez en ligne par carte bancaire en un clic via le bouton ci-dessous. Vous pouvez aussi régler en espèces ou par chèque à l'ordre de <strong>Beth Menahem Lis</strong> remis à <strong>Mora Elodie</strong>.`
          : `Merci de remettre ce règlement en espèces ou par chèque à l'ordre de <strong>Beth Menahem Lis</strong> à <strong>Mora Elodie</strong> dès aujourd'hui.`}
      </p>
      <p style="margin:0;color:#991b1b;font-size:14px;font-weight:700">
        ⚠️ Sans règlement de votre part, la place sera attribuée à une famille de la liste d'attente.
      </p>
    </div>

    ${checkoutUrl ? `
    <div style="text-align:center;margin:0 0 28px">
      <a href="${checkoutUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:17px;font-weight:800;letter-spacing:0.02em">
        💳 Payer ${solde} € en ligne
      </a>
      <div style="margin-top:10px;font-size:12px;color:#94a3b8">Paiement sécurisé par carte bancaire via HelloAsso</div>
    </div>` : ''}

    <h3 style="color:#1e3a8a;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Récapitulatif de l'inscription</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#eff6ff">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Enfant</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Classe</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#475569;text-transform:uppercase">Semaines</th>
        </tr>
      </thead>
      <tbody>${semainesHtml}</tbody>
    </table>

    <table width="100%" style="margin-bottom:24px">
      <tr>
        <td style="padding:4px 0;color:#475569">Total inscription</td>
        <td style="padding:4px 0;text-align:right;font-weight:800;color:#1e3a8a;font-size:18px">${insc.total} €</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#475569">Acompte déjà réglé</td>
        <td style="padding:4px 0;text-align:right;color:#16a34a;font-weight:700">${insc.accompte} € ✓</td>
      </tr>
      <tr style="border-top:2px solid #e2e8f0">
        <td style="padding:8px 0;color:#9a3412;font-weight:700">Solde restant</td>
        <td style="padding:8px 0;text-align:right;font-weight:800;color:#dc2626;font-size:20px">${solde} €</td>
      </tr>
    </table>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:24px">
      <p style="margin:0;font-size:14px;color:#991b1b">
        📅 <strong>Date limite : 15 juin (aujourd'hui)</strong>${checkoutUrl
          ? ` — le plus rapide est de régler en ligne via le bouton vert ci-dessus.`
          : ` — Règlement en espèces ou par chèque à l'ordre de <strong>Beth Menahem Lis</strong>, à remettre à Mora Elodie.`}
      </p>
    </div>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
  })
}

// ── Relance paiement non abouti (lien HelloAsso personnalisé) ────────────────
// installmentPlan (optionnel) : { n, montant, schedule: [{ amount, date, immediate }] } → paiement en plusieurs fois
// opts (optionnel) : { amount: <€ exact à régler>, isPartial: <paiement partiel> }
export async function sendPaymentRetryEmail(insc, checkoutUrl, installmentPlan = null, opts = {}) {
  const email   = insc.email || insc.formData?.email
  const prenom  = insc.parent1_prenom || insc.formData?.parent1Prenom
  const nom     = insc.parent1_nom    || insc.formData?.parent1Nom
  const enfants = insc.enfants || []
  const enfantsNoms = enfants.map(e => `${e.prenom} ${e.nom}`).join(' et ') || 'votre enfant'
  const totalNet = Number(insc.total) - Number(insc.remise || 0)
  const soldeRestant = totalNet - Number(insc.accompte)
  const montantDu = soldeRestant > 0 ? soldeRestant : totalNet
  const isPartial = !!opts.isPartial
  const montant = opts.amount != null ? Number(opts.amount) : montantDu
  const isFullCB = insc.mode_paiement === 'cb'
  const resteApres = Math.max(0, montantDu - montant) // solde restant après un paiement partiel

  const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtEur  = (n) => Number.isInteger(n) ? `${n} €` : `${Number(n).toFixed(2)} €`

  // Bloc échéancier (paiement en plusieurs fois)
  const echeancier = installmentPlan ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 18px;margin-bottom:24px">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#15803d">
        🗓️ Paiement en ${installmentPlan.n} fois — total ${fmtEur(installmentPlan.montant)}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${installmentPlan.schedule.map((t, idx) => `
        <tr>
          <td style="padding:5px 0;color:#475569">Échéance ${idx + 1}${t.immediate ? ' <span style="color:#16a34a;font-weight:700">(aujourd\'hui)</span>' : ` — le ${fmtDate(t.date)}`}</td>
          <td style="padding:5px 0;text-align:right;font-weight:700;color:#1e3a8a">${fmtEur(t.amount)}</td>
        </tr>`).join('')}
      </table>
      <p style="margin:10px 0 0;font-size:12px;color:#15803d;line-height:1.5">
        Vous réglez la 1<sup>re</sup> échéance maintenant ; les suivantes sont prélevées automatiquement aux dates indiquées.
      </p>
    </div>` : ''

  // Bloc paiement partiel (orange)
  const blocPartiel = (isPartial && !installmentPlan) ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 18px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:800;color:#c2410c">🟠 Paiement partiel — ${fmtEur(montant)}</p>
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6">
        Vous réglez aujourd'hui une partie de votre inscription.${resteApres > 0 ? ` Il restera <strong>${fmtEur(resteApres)}</strong> à régler ultérieurement.` : ''}
      </p>
    </div>` : ''

  const montantBouton = installmentPlan ? installmentPlan.schedule[0].amount : montant
  const sousTitreBouton = installmentPlan
    ? `1<sup>re</sup> échéance sur ${installmentPlan.n} — paiement sécurisé via HelloAsso`
    : isPartial
    ? `Paiement partiel sécurisé via HelloAsso${resteApres > 0 ? ` — solde restant ${fmtEur(resteApres)}` : ''}`
    : `Paiement sécurisé via HelloAsso${isFullCB ? ' — paiement total' : ' — acompte de réservation'}`

  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: email,
    subject: installmentPlan
      ? `💳 Inscription Gan Israel — votre paiement en ${installmentPlan.n} fois`
      : isPartial
      ? `💶 Inscription Gan Israel — votre paiement partiel de ${fmtEur(montant)}`
      : `⚠️ Inscription Gan Israel — votre paiement n'a pas abouti`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Centre Aéré Maternelle — Levallois-Perret</p>
  </div>

  <div style="padding:32px">
    <p style="color:#475569;margin:0 0 16px;font-size:15px">Bonjour <strong>${prenom} ${nom}</strong>,</p>

    <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
      <p style="margin:0 0 10px;color:#9a3412;font-size:16px;font-weight:700">
        ${installmentPlan
          ? `Pour faciliter le règlement de l'inscription de <strong>${enfantsNoms}</strong> au Gan Israel, nous vous proposons un paiement échelonné en <strong>${installmentPlan.n} fois</strong>.`
          : isPartial
          ? `Pour l'inscription de <strong>${enfantsNoms}</strong> au Gan Israel, voici votre lien pour régler un <strong>paiement partiel de ${fmtEur(montant)}</strong>.`
          : `Votre demande d'inscription pour <strong>${enfantsNoms}</strong> au Gan Israel a bien été reçue, mais votre paiement de <strong>${fmtEur(montant)}</strong> n'a pas abouti.`}
      </p>
      <p style="margin:0;color:#9a3412;font-size:14px;line-height:1.6">
        Nous vous avons préparé un lien de paiement direct — cliquez simplement sur le bouton ci-dessous pour finaliser votre inscription en quelques secondes.
      </p>
    </div>

    ${echeancier}${blocPartiel}

    <div style="text-align:center;margin:28px 0">
      <a href="${checkoutUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:17px;font-weight:800;letter-spacing:0.02em">
        💳 Payer ${fmtEur(montantBouton)} et finaliser mon inscription
      </a>
      <div style="margin-top:12px;font-size:12px;color:#94a3b8">
        ${sousTitreBouton}
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:24px">
      <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6">
        💡 Ce lien est valable pendant 24h. Si vous rencontrez un problème, contactez-nous directement par email ou WhatsApp.
      </p>
    </div>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
  })
}

// ── Notification à l'admin ────────────────────────────────────────────────────
export async function sendNotificationToAdmin(data, inscriptionId) {
  const { parent1Prenom, parent1Nom, parent2Prenom, parent2Nom, email, telephone, enfants, total, accompte, modePaiement } = data

  const enfantsHtml = enfants.map(e => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${e.prenom} ${e.nom}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${e.classe}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">
        ${e.semaines.map(s => `S${s}${e.garderie?.includes(s) ? ' 🌅' : ''}`).join(', ')}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${totalForChild(e)} €</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-size:12px">
        ${[e.allergiesAlimentaires, e.traitementEnCours, e.maladiesChroniques].filter(Boolean).join(' · ') || '—'}
      </td>
    </tr>`).join('')

  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: 'ganisrael@bethmenahem-lis.com',
    subject: `📋 Nouvelle inscription #${inscriptionId} — ${parent1Prenom} ${parent1Nom}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#1e3a8a;padding:20px 28px;display:flex;align-items:center;gap:14px">
    <img src="${LOGO_URL}" alt="Gan Israel" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.25);flex-shrink:0" />
    <div>
      <h2 style="color:white;margin:0;font-size:16px">📋 Nouvelle inscription #${inscriptionId}</h2>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">${new Date().toLocaleDateString('fr-FR', { dateStyle: 'full' })}</p>
    </div>
  </div>
  <div style="padding:28px">
    <table width="100%" style="margin-bottom:20px">
      <tr><td style="padding:4px 0;color:#475569;width:160px">Parent 1</td><td style="font-weight:700">${parent1Prenom} ${parent1Nom}</td></tr>
      ${parent2Prenom ? `<tr><td style="padding:4px 0;color:#475569">Parent 2</td><td style="font-weight:700">${parent2Prenom} ${parent2Nom}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#475569">Email</td><td><a href="mailto:${email}" style="color:#2563eb">${email}</a></td></tr>
      <tr><td style="padding:4px 0;color:#475569">Téléphone</td><td>${telephone}</td></tr>
      <tr><td style="padding:4px 0;color:#475569">Mode paiement</td><td>${modePaiement}</td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead><tr style="background:#eff6ff">
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569">Enfant</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569">Classe</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569">Semaines</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569">Prix</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569">Santé</th>
      </tr></thead>
      <tbody>${enfantsHtml}</tbody>
    </table>

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between">
      <span style="color:#475569">Total : <strong style="color:#1e3a8a">${total} €</strong></span>
      <span style="color:#475569">Accompte : <strong style="color:#16a34a">${accompte} €</strong></span>
      <span style="color:#475569">Solde : <strong style="color:#dc2626">${total - accompte} €</strong></span>
    </div>
  </div>
</div>
</body>
</html>`,
  })
}

// ── Place disponible — lien inscription reservee ─────────────────────────────
export async function sendWaitingListAcceptance(entry, inscriptionUrl) {
  const classesText  = (entry.classes  || []).join(', ') || '—'
  const semainesText = (entry.semaines || []).map(s => `S${s}`).join(', ') || '—'
  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: entry.email,
    subject: "Une place est disponible — Gan Israel Beth Hillel",
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#16a34a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#bbf7d0;margin:4px 0 0;font-size:13px">Centre Aere Maternelle — Levallois-Perret</p>
  </div>
  <div style="padding:32px">
    <div style="font-size:40px;text-align:center;margin-bottom:16px">🎉</div>
    <h2 style="color:#15803d;margin:0 0 8px;text-align:center">Bonne nouvelle — une place est disponible !</h2>
    <p style="color:#475569;margin:0 0 20px">Bonjour <strong>${entry.prenom} ${entry.nom}</strong>,</p>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
      <p style="margin:0 0 8px;color:#15803d;font-size:15px;font-weight:700">
        Une place vient de se liberer au Gan Israel Beth Hillel ete 2026.
      </p>
      <p style="margin:0;color:#166534;font-size:14px;line-height:1.6">
        Classe(s) : <strong>${classesText}</strong><br>
        Semaine(s) : <strong>${semainesText}</strong>
      </p>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:28px">
      <p style="margin:0;font-size:14px;color:#92400e">
        ⚡ Ce lien est personnel et valable pour vous uniquement. Finalisez votre inscription rapidement — la place sera attribuee a la prochaine personne sur liste si vous ne completez pas dans les 48h.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:28px">
      <a href="${inscriptionUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:16px 36px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.01em">
        Finaliser mon inscription
      </a>
    </div>
    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0">
      Ou copiez ce lien dans votre navigateur :<br>
      <span style="color:#2563eb;word-break:break-all">${inscriptionUrl}</span>
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
  })
}

// ── Confirmation liste d'attente ─────────────────────────────────────────────
export async function sendWaitingListConfirmation(entry) {
  const classesText = (entry.classes || []).join(', ') || '—'
  const semainesText = (entry.semaines || []).map(s => `S${s}`).join(', ') || '—'
  await sendEmail({
    from: 'Gan Israel Beth Hillel <ganisrael@bethmenahem-lis.com>',
    to: entry.email,
    subject: "Liste d'attente confirmee — Gan Israel Beth Hillel",
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <img src="${LOGO_URL}" alt="Gan Israel Beth Hillel" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <h1 style="color:white;margin:0;font-size:20px;font-weight:800">Gan Israel Beth Hillel</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Centre Aere Maternelle — Levallois-Perret</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#1e3a8a;margin:0 0 8px">Inscription sur liste d'attente confirmee</h2>
    <p style="color:#475569;margin:0 0 20px">Bonjour <strong>${entry.prenom} ${entry.nom}</strong>,</p>
    <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
      <p style="margin:0 0 8px;color:#1e3a8a;font-size:15px;font-weight:700">
        Vous etes bien inscrit(e) sur la liste d'attente du Gan Israel Beth Hillel ete 2026.
      </p>
      <p style="margin:0;color:#1e3a8a;font-size:14px;line-height:1.6">
        Classe(s) souhaitee(s) : <strong>${classesText}</strong><br>
        Semaine(s) souhaitee(s) : <strong>${semainesText}</strong>
      </p>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:24px">
      <p style="margin:0;font-size:14px;color:#14532d">
        Nous vous contacterons directement par email ou telephone des qu'une place se libere.
      </p>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#1e3a8a;font-size:14px;font-weight:700;margin:0 0 4px">La Direction</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Gan Israel Beth Hillel · 89 rue Carnot, 92300 Levallois-Perret<br>
      <a href="mailto:ganisrael@bethmenahem-lis.com" style="color:#2563eb">ganisrael@bethmenahem-lis.com</a>
    </p>
  </div>
</div>
</body>
</html>`,
  })
}

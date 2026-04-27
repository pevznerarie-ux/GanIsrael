import nodemailer from 'nodemailer'
import 'dotenv/config'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
})

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

  await transporter.sendMail({
    from: `"Gan Israel Beth Hillel" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Confirmation d'inscription — Gan Israel Beth Hillel",
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

  <div style="background:#1e3a8a;padding:24px 32px;text-align:center">
    <div style="font-size:28px;margin-bottom:6px">✡</div>
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
        <td style="padding:4px 0;color:#475569">Accompte réglé via HelloAsso</td>
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

  await transporter.sendMail({
    from: `"Gan Israel Site" <${process.env.SMTP_USER}>`,
    to: 'ganisrael@bethmenahem-lis.com',
    subject: `📋 Nouvelle inscription #${inscriptionId} — ${parent1Prenom} ${parent1Nom}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#1e3a8a;padding:20px 28px">
    <h2 style="color:white;margin:0;font-size:16px">📋 Nouvelle inscription #${inscriptionId}</h2>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">${new Date().toLocaleDateString('fr-FR', { dateStyle: 'full' })}</p>
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

import PDFDocument from 'pdfkit'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOGO_PATH      = join(__dirname, 'assets', 'logo.png')
const SIGNATURE_PATH = join(__dirname, 'assets', 'signature.png')

// ── Montant en lettres (français) ─────────────────────────────────────────────
const ONES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
              'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
              'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function below100(n) {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  const d = Math.floor(n / 10), u = n % 10
  if (d === 7) return 'soixante-' + ONES[10 + u]
  if (d === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + ONES[u]
  if (d === 9) return 'quatre-vingt-' + ONES[10 + u]
  const liaison = u === 1 ? ' et ' : u > 0 ? '-' : ''
  return TENS[d] + liaison + (u > 0 ? ONES[u] : '')
}

function below1000(n) {
  if (n === 0) return ''
  if (n < 100) return below100(n)
  const h = Math.floor(n / 100), r = n % 100
  const cent = h === 1 ? 'cent' : ONES[h] + ' cent' + (r === 0 ? 's' : '')
  return cent + (r > 0 ? ' ' + below100(r) : '')
}

function amountToWords(n) {
  if (!n || n === 0) return 'Zéro euro'
  let result = ''
  if (n >= 1000) {
    const t = Math.floor(n / 1000), r = n % 1000
    result = (t === 1 ? 'mille' : below1000(t) + ' mille') + (r > 0 ? ' ' + below1000(r) : '')
  } else {
    result = below1000(n)
  }
  const cap = result.charAt(0).toUpperCase() + result.slice(1)
  return cap + (n > 1 ? ' euros' : ' euro')
}

// ── Génération du PDF ─────────────────────────────────────────────────────────
export function generateReceiptPDF(inscription, id) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const data   = inscription.formData || inscription
    const { parent1Prenom, parent1Nom, parent2Prenom, parent2Nom,
            enfants, total, accompte } = data
    const amount = accompte || total || 0

    // Nom de famille pour "Mr et Mme ..."
    const familyName = parent1Nom || ''
    const dateEmis   = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // Images
    const logoData = fs.existsSync(LOGO_PATH)      ? fs.readFileSync(LOGO_PATH)      : null
    const sigData  = fs.existsSync(SIGNATURE_PATH) ? fs.readFileSync(SIGNATURE_PATH) : null

    // ── Ligne décorative haut ────────────────────────────────────────────────
    doc.rect(0, 0, 595.28, 6).fill('#8B1C13')

    // ── En-tête : logo + infos institution ──────────────────────────────────
    const headerY = 22
    if (logoData) {
      // Logo : largeur ~160px, hauteur proportionnelle (original ~310x100)
      doc.image(logoData, 40, headerY, { width: 170 })
    }

    // Bloc institution (à droite du logo)
    const instX = 230
    doc.fillColor('#8B1C13').font('Helvetica-Bold').fontSize(13)
       .text('Les Institutions SINAI', instX, headerY + 4, { lineBreak: false })
    doc.fillColor('#333333').font('Helvetica').fontSize(10)
       .text('Ecole Maternelle & Primaire BETH HILLEL', instX, headerY + 20, { lineBreak: false })
    doc.fillColor('#555555').fontSize(9)
       .text('89 Rue Carnot - 92300 Levallois-Perret', instX, headerY + 34, { lineBreak: false })
       .text('ecolebethhillel@gmail.com', instX, headerY + 46, { lineBreak: false })

    // Séparateur
    const sepY = headerY + 70
    doc.moveTo(40, sepY).lineTo(555.28, sepY).strokeColor('#8B1C13').lineWidth(1.5).stroke()

    // ── Titre RECU ──────────────────────────────────────────────────────────
    const titleY = sepY + 30
    doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(24)
       .text('RECU', 0, titleY, { align: 'center', width: 595.28 })

    // Soulignement manuel du titre
    const titleW  = doc.widthOfString('RECU', { fontSize: 24 })
    const titleX  = (595.28 - titleW) / 2
    const titleBY = titleY + 28
    doc.moveTo(titleX, titleBY).lineTo(titleX + titleW, titleBY)
       .strokeColor('#1a1a1a').lineWidth(1.2).stroke()

    // ── Corps du texte ───────────────────────────────────────────────────────
    const bodyX = 55
    const bodyW = 485
    let y = titleY + 52

    // Paragraphe 1 : attestation
    doc.fillColor('#1a1a1a').font('Helvetica').fontSize(13)
       .text(
         'Je soussignee Mme Sim\'ha Nemni, Directrice de l\'Ecole Primaire',
         bodyX, y, { width: bodyW, lineBreak: false }
       )
    y += 20
    doc.text(
      'BETH HILLEL atteste par la presente avoir recu',
      bodyX, y, { width: bodyW, lineBreak: false }
    )

    // Montant en chiffres
    y += 34
    doc.font('Helvetica-Bold').fontSize(20)
       .text(`${amount} €`, 0, y, { align: 'center', width: 595.28 })

    // Montant en lettres
    y += 30
    doc.font('Helvetica-Bold').fontSize(14)
       .text(amountToWords(amount), 0, y, { align: 'center', width: 595.28 })

    // "De Mr et Mme [NOM]"
    y += 36
    doc.font('Helvetica').fontSize(13)
       .text('De ', bodyX, y, { continued: true, lineBreak: false })
    doc.font('Helvetica-Bold')
       .text(`Mr et Mme ${familyName}`, { lineBreak: false })

    // Enfants inscrits (si disponibles)
    if (enfants && enfants.length > 0) {
      y += 22
      const enfantsNoms = enfants.map(e => `${e.prenom} ${e.nom}`).join(', ')
      doc.font('Helvetica').fontSize(11).fillColor('#444444')
         .text(`Enfant(s) : ${enfantsNoms}`, bodyX, y, { width: bodyW, lineBreak: false })
      doc.fillColor('#1a1a1a')
    }

    // "Au titre des frais de..."
    y += 30
    doc.font('Helvetica').fontSize(13)
       .text('Au titre des frais de ', bodyX, y, { continued: true, lineBreak: false })
    doc.font('Helvetica-Bold')
       .text('garderie et activite extra scolaire', { continued: true, lineBreak: false })
    doc.font('Helvetica')
       .text(' du ', { continued: true, lineBreak: false })
    doc.font('Helvetica-Bold')
       .text('mois de juillet 2026', { lineBreak: false })

    // ── Date et lieu ────────────────────────────────────────────────────────
    y += 46
    doc.font('Helvetica').fontSize(12)
       .text(`Fait a Levallois-Perret, le ${dateEmis}`, bodyX, y, { lineBreak: false })

    // ── Signature ────────────────────────────────────────────────────────────
    y += 40
    const sigX = 360

    doc.font('Helvetica-Bold').fontSize(12)
       .text('La Directrice', sigX, y, { width: 180, align: 'center', lineBreak: false })

    if (sigData) {
      y += 16
      // Signature image (~150px large, centrée dans le bloc)
      doc.image(sigData, sigX + 10, y, { width: 155 })
      y += 100
    } else {
      y += 60
    }

    doc.font('Helvetica-Bold').fontSize(12)
       .text('S. NEMNI', sigX, y, { width: 180, align: 'center', lineBreak: false })

    // ── Ligne décorative bas ─────────────────────────────────────────────────
    doc.rect(0, 825, 595.28, 6).fill('#8B1C13')

    doc.end()
  })
}

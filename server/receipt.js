import PDFDocument from 'pdfkit'

const SEMAINE_LABELS = {
  1: '6-10 juillet',
  2: '13-17 juillet',
  3: '20-24 juillet',
}

const basePrice = (n) => n === 3 ? 525 : n * 180
const garderiePrice = (garderie) => (garderie?.length || 0) * 20
const totalForChild = (e) => basePrice(e.semaines.length) + garderiePrice(e.garderie)

// ── Helpers de dessin ─────────────────────────────────────────────────────────
function drawTwoCol(doc, label, value, y, valueColor = '#1e293b', bold = false) {
  doc.fillColor('#64748b').font('Helvetica').fontSize(10)
     .text(label, 55, y, { lineBreak: false })
  doc.fillColor(valueColor).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
     .text(value, 220, y, { lineBreak: false })
}

function drawFinRow(doc, label, value, y, valueColor = '#1e293b') {
  doc.fillColor('#64748b').font('Helvetica').fontSize(11)
     .text(label, 55, y, { lineBreak: false })
  doc.fillColor(valueColor).font('Helvetica-Bold').fontSize(11)
     .text(value, 310, y, { width: 230, align: 'right', lineBreak: false })
}

// ── Génération du PDF ─────────────────────────────────────────────────────────
export function generateReceiptPDF(inscription, id) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const data = inscription.formData || inscription
    const {
      parent1Prenom, parent1Nom,
      parent2Prenom, parent2Nom,
      email, telephone,
      enfants, total, accompte,
    } = data
    const solde = (total || 0) - (accompte || 0)

    // ── En-tête bleu ────────────────────────────────────────────────────────
    doc.rect(0, 0, 595.28, 90).fill('#1e3a8a')

    doc.fillColor('white').font('Helvetica-Bold').fontSize(19)
       .text('Gan Israel Beth Hillel', 50, 20, { lineBreak: false })

    doc.fillColor('#93c5fd').font('Helvetica').fontSize(11)
       .text('Centre Aere Maternelle - Levallois-Perret', 50, 44, { lineBreak: false })

    doc.fillColor('#bfdbfe').fontSize(9)
       .text('89 rue Carnot, 92300 Levallois-Perret  |  ganisrael@bethmenahem-lis.com', 50, 62, { lineBreak: false })

    // ── Titre + numéro ───────────────────────────────────────────────────────
    let y = 108
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(20)
       .text('RECU D\'INSCRIPTION', 50, y, { align: 'center', width: 495.28 })

    y += 28
    const dateEmis = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.fillColor('#64748b').font('Helvetica').fontSize(11)
       .text(`N ${id}  |  Emis le : ${dateEmis}`, 50, y, { align: 'center', width: 495.28 })

    // Séparateur
    y += 22
    doc.moveTo(50, y).lineTo(545.28, y).strokeColor('#dbeafe').lineWidth(1.5).stroke()
    y += 16

    // ── Famille ─────────────────────────────────────────────────────────────
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(11)
       .text('FAMILLE', 50, y, { lineBreak: false })
    y += 14

    drawTwoCol(doc, 'Parent 1 :', `${parent1Prenom} ${parent1Nom}`, y, '#1e293b', true); y += 16
    if (parent2Prenom) {
      drawTwoCol(doc, 'Parent 2 :', `${parent2Prenom} ${parent2Nom}`, y, '#1e293b', true); y += 16
    }
    drawTwoCol(doc, 'Email :', email, y); y += 16
    drawTwoCol(doc, 'Telephone :', telephone || '—', y); y += 20

    // Séparateur
    doc.moveTo(50, y).lineTo(545.28, y).strokeColor('#dbeafe').lineWidth(1.5).stroke()
    y += 16

    // ── Tableau enfants ──────────────────────────────────────────────────────
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(11)
       .text('DETAIL DES INSCRIPTIONS', 50, y, { lineBreak: false })
    y += 10

    const tX = 50
    const tW = 495.28
    const cols = { enfant: 0, classe: 155, semaines: 235, prix: 430 }
    const colW = { enfant: 150, classe: 75, semaines: 190, prix: 65 }
    const thH = 22

    // En-tête tableau
    doc.rect(tX, y, tW, thH).fill('#dbeafe')
    doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(9)
    doc.text('ENFANT',   tX + cols.enfant  + 5, y + 7, { width: colW.enfant  - 5, lineBreak: false })
    doc.text('CLASSE',   tX + cols.classe  + 5, y + 7, { width: colW.classe  - 5, lineBreak: false })
    doc.text('SEMAINES', tX + cols.semaines + 5, y + 7, { width: colW.semaines - 5, lineBreak: false })
    doc.text('PRIX',     tX + cols.prix   + 5, y + 7, { width: colW.prix   - 10, align: 'right', lineBreak: false })
    y += thH

    const thStart = y - thH  // Pour la bordure finale

    // Lignes enfants
    enfants.forEach((e, idx) => {
      const rowH = 26
      if (idx % 2 === 0) doc.rect(tX, y, tW, rowH).fill('#f8fafc')

      const semainesText = (e.semaines || [])
        .slice().sort((a, b) => a - b)
        .map(s => e.garderie?.includes(s) ? `${SEMAINE_LABELS[s]} (+gard.)` : SEMAINE_LABELS[s])
        .join(', ')

      const prix = totalForChild(e)

      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9.5)
         .text(`${e.prenom} ${e.nom}`, tX + cols.enfant + 5, y + 8, { width: colW.enfant - 5, lineBreak: false })
      doc.font('Helvetica').fontSize(9.5)
         .text(e.classe, tX + cols.classe + 5, y + 8, { width: colW.classe - 5, lineBreak: false })
         .text(semainesText, tX + cols.semaines + 5, y + 8, { width: colW.semaines - 10, lineBreak: false })
      doc.font('Helvetica-Bold')
         .text(`${prix} EUR`, tX + cols.prix + 5, y + 8, { width: colW.prix - 10, align: 'right', lineBreak: false })
      y += rowH
    })

    // Bordure tableau
    doc.rect(tX, thStart, tW, y - thStart).strokeColor('#bfdbfe').lineWidth(1).stroke()
    doc.moveTo(tX + cols.classe, thStart).lineTo(tX + cols.classe, y).strokeColor('#bfdbfe').lineWidth(0.5).stroke()
    doc.moveTo(tX + cols.semaines, thStart).lineTo(tX + cols.semaines, y).strokeColor('#bfdbfe').lineWidth(0.5).stroke()
    doc.moveTo(tX + cols.prix, thStart).lineTo(tX + cols.prix, y).strokeColor('#bfdbfe').lineWidth(0.5).stroke()

    y += 16
    doc.moveTo(50, y).lineTo(545.28, y).strokeColor('#dbeafe').lineWidth(1.5).stroke()
    y += 16

    // ── Récapitulatif financier ──────────────────────────────────────────────
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(11)
       .text('RECAPITULATIF FINANCIER', 50, y, { lineBreak: false })
    y += 14

    drawFinRow(doc, 'Total inscription :', `${total} EUR`, y, '#1e3a8a'); y += 22
    drawFinRow(doc, 'Accompte regle via HelloAsso :', `${accompte} EUR  OK`, y, '#16a34a'); y += 22

    if (solde > 0) {
      drawFinRow(doc, 'Solde restant a regler :', `${solde} EUR`, y, '#dc2626'); y += 22

      // Encadré avertissement solde
      y += 6
      doc.rect(50, y, 495.28, 36).fill('#fffbeb')
      doc.rect(50, y, 4, 36).fill('#f59e0b')
      doc.fillColor('#92400e').font('Helvetica').fontSize(10)
         .text(
           `Le solde de ${solde} EUR est a remettre en especes ou par cheque a Mora Elodie avant le 15 juin.`,
           62, y + 11, { width: 475, lineBreak: false }
         )
      y += 48
    } else {
      drawFinRow(doc, 'Paiement :', 'Integral regle', y, '#16a34a'); y += 22
    }

    // ── Pied de page ────────────────────────────────────────────────────────
    doc.moveTo(50, 790).lineTo(545.28, 790).strokeColor('#e2e8f0').lineWidth(1).stroke()
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8.5)
       .text(
         'Gan Israel Beth Hillel  |  89 rue Carnot, 92300 Levallois-Perret  |  ganisrael@bethmenahem-lis.com',
         50, 796, { align: 'center', width: 495.28 }
       )
       .text(`Document emis le ${dateEmis}`, 50, 807, { align: 'center', width: 495.28 })

    doc.end()
  })
}

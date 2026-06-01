import { useState, useEffect, useMemo } from 'react'

const STATUTS = {
  attente_validation: { label: '⏳ Validation admin', color: '#7c3aed', bg: '#ede9fe' },
  en_attente:         { label: 'En attente',          color: '#f59e0b', bg: '#fef3c7' },
  accompte_paye:      { label: 'Acompte payé',        color: '#2563eb', bg: '#dbeafe' },
  solde_paye:         { label: 'Soldé',               color: '#16a34a', bg: '#dcfce7' },
  annule:             { label: 'Annulé',              color: '#dc2626', bg: '#fee2e2' },
  archive:            { label: 'Archivé',             color: '#94a3b8', bg: '#f1f5f9' },
}

const SEMAINES = [
  { id: 1, label: '6–10 juillet',  short: 'S1' },
  { id: 2, label: '13–17 juillet', short: 'S2' },
  { id: 3, label: '20–24 juillet', short: 'S3' },
]

const CLASSES = ['Pre Gan', 'Gan 1', 'Gan 2', 'Gan 3']
const CAPACITES = { 'Pre Gan': 20, 'Gan 1': 36, 'Gan 2': 36, 'Gan 3': 36 }

const CLASSE_COLORS = {
  'Pre Gan': { bg: '#fef3c7', color: '#92400e', bar: '#f59e0b' },
  'Gan 1':   { bg: '#dbeafe', color: '#1e40af', bar: '#2563eb' },
  'Gan 2':   { bg: '#dcfce7', color: '#14532d', bar: '#16a34a' },
  'Gan 3':   { bg: '#ede9fe', color: '#4c1d95', bar: '#7c3aed' },
}

function formatPhone(tel) {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('33')) return digits
  if (digits.startsWith('0')) return '33' + digits.slice(1)
  return '33' + digits
}

function displayPhone(tel) {
  if (!tel) return ''
  const d = tel.replace(/\D/g, '')
  const local = d.startsWith('33') ? '0' + d.slice(2) : d.startsWith('0') ? d : '0' + d
  return local.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

function waLink(tel, message = '') {
  const phone = formatPhone(tel)
  if (!phone) return '#'
  const url = `https://wa.me/${phone}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}

function soldeMessage(parent1Prenom, enfants, solde) {
  const noms = enfants.map(e => e.prenom).join(' et ')
  return `Bonjour ${parent1Prenom},\n\nNous vous rappelons qu'un solde de ${solde} € est à régler pour l'inscription de ${noms} au Gan Israel Beth Hillel.\n\nMerci de remettre ce règlement à Mora Elodie avant le 15 juin.\n\nCordialement,\nLa Direction`
}

// ── Détection des doublons ────────────────────────────────────────────────────
// Doublon = même nom d'enfant dans deux inscriptions distinctes
function isDuplicate(a, b) {
  const keysB = new Set(
    (b.enfants || []).map(e => `${(e.prenom || '').toLowerCase().trim()}-${(e.nom || '').toLowerCase().trim()}`)
  )
  return (a.enfants || []).some(e => {
    const k = `${(e.prenom || '').toLowerCase().trim()}-${(e.nom || '').toLowerCase().trim()}`
    return k.length > 2 && keysB.has(k)
  })
}

function detectDuplicates(inscriptions, ignoredPairs = []) {
  const pairKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`
  const ignoredSet = new Set(ignoredPairs.map(([a, b]) => pairKey(a, b)))

  const n = inscriptions.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const union = (x, y) => { parent[find(x)] = find(y) }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (isDuplicate(inscriptions[i], inscriptions[j]) &&
          !ignoredSet.has(pairKey(inscriptions[i].id, inscriptions[j].id)))
        union(i, j)
  const comps = {}
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!comps[r]) comps[r] = []
    comps[r].push(inscriptions[i])
  }
  return Object.values(comps).filter(g => g.length > 1)
}

function exportCSV(inscriptions) {
  const headers = ['ID', 'Date', 'Parent 1', 'Parent 2', 'Email', 'Téléphone', 'Enfants', 'Classes', 'Semaines', 'Mode paiement accompte', 'Total brut (€)', 'Remise (€)', 'Total net (€)', 'Acompte (€)', 'Solde (€)', 'Mode paiement solde', 'Statut', 'Reçu envoyé']
  const rows = inscriptions.map(i => {
    const remise = Number(i.remise || 0)
    const totalNet = Number(i.total) - remise
    return [
      i.id,
      i.created_at,
      `${i.parent1_prenom} ${i.parent1_nom}`,
      i.parent2_prenom ? `${i.parent2_prenom} ${i.parent2_nom}` : '',
      i.email,
      i.telephone,
      i.enfants.map(e => `${e.prenom} ${e.nom}`).join(' | '),
      i.enfants.map(e => e.classe).join(' | '),
      i.enfants.map(e => e.semaines.map(s => `S${s}`).join('+')).join(' | '),
      i.mode_paiement,
      i.total,
      remise,
      totalNet,
      i.accompte,
      i.total - i.accompte,
      i.solde_mode_paiement || '',
      STATUTS[i.statut]?.label || i.statut,
      i.recu_envoye ? 'Oui' : 'Non',
    ]
  })
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inscriptions_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Onglet Dashboard ──────────────────────────────────────────────────────────
const ACOMPTE_PAR_ENFANT = 50 // Acompte fixe : 50 € par enfant

function TabDashboard({ inscriptions }) {
  // Exclure les annulés et archivés de tous les calculs financiers
  const actives = inscriptions.filter(i => i.statut !== 'annule' && i.statut !== 'archive')

  const nonAnnules = inscriptions.filter(i => i.statut !== 'annule')
  const totalEnfants = nonAnnules.reduce((s, i) => s + i.enfants.length, 0)
  const totalRevenu = actives.reduce((s, i) => s + Number(i.total), 0)

  // L'acompte est TOUJOURS 50 €/enfant, peu importe le mode de paiement.
  // En CB, accompte = total dans la DB, mais financièrement seul 50 €/enfant est l'acompte.
  const acompteTheo = (i) => ACOMPTE_PAR_ENFANT * (i.enfants || []).length
  const totalAccomptes = actives.reduce((s, i) => s + acompteTheo(i), 0)

  // Solde théorique restant = total - acompte théorique
  const totalSoldes = totalRevenu - totalAccomptes

  // Solde encaissé = pour les inscriptions soldées, ce qui dépasse l'acompte théorique
  const soldesPayes = actives.filter(i => i.statut === 'solde_paye')
  const soldeEncaisse = soldesPayes.reduce((s, i) => s + (Number(i.total) - acompteTheo(i)), 0)

  // Comptage par statut sur toutes les inscriptions (pour voir les annulés/archivés)
  const byStatut = Object.fromEntries(Object.keys(STATUTS).map(k => [k, inscriptions.filter(i => i.statut === k).length]))

  // Occupancy par classe × semaine
  const occupancy = useMemo(() => {
    const counts = {}
    for (const classe of CLASSES) {
      counts[classe] = { 1: 0, 2: 0, 3: 0 }
    }
    for (const i of inscriptions) {
      if (i.statut === 'annule') continue
      for (const e of i.enfants) {
        for (const s of (e.semaines || [])) {
          if (counts[e.classe]) counts[e.classe][s] = (counts[e.classe][s] || 0) + 1
        }
      }
    }
    return counts
  }, [inscriptions])

  return (
    <div className="crm-dashboard">
      {/* Cartes stats */}
      <div className="admin-stats" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {[
          { label: 'Familles', value: nonAnnules.length, icon: '👨‍👩‍👧' },
          { label: 'Enfants', value: totalEnfants, icon: '👶' },
          { label: 'Revenus prévus', value: `${totalRevenu} €`, icon: '💰' },
          { label: 'Acomptes reçus', value: `${totalAccomptes} €`, icon: '✅' },
          { label: 'Soldes restants', value: `${totalSoldes - soldeEncaisse} €`, icon: '⏳' },
        ].map(s => (
          <div key={s.label} className="admin-stat-card">
            <div className="asc-icon">{s.icon}</div>
            <div className="asc-value">{s.value}</div>
            <div className="asc-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="crm-dash-grid">
        {/* Statuts */}
        <div className="crm-card">
          <div className="crm-card-title">Statuts des inscriptions</div>
          {Object.entries(STATUTS).map(([k, v]) => (
            <div key={k} className="crm-statut-row">
              <span style={{ background: v.bg, color: v.color, padding: '2px 10px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700 }}>{v.label}</span>
              <span className="crm-statut-count">{byStatut[k] || 0}</span>
              <div className="crm-bar-bg">
                <div className="crm-bar-fill" style={{ width: `${inscriptions.length ? ((byStatut[k] || 0) / inscriptions.length) * 100 : 0}%`, background: v.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Finances */}
        <div className="crm-card">
          <div className="crm-card-title">Finances</div>
          <div className="crm-finance-row">
            <span>Total attendu</span>
            <strong style={{ color: '#1e3a8a' }}>{totalRevenu} €</strong>
          </div>
          <div className="crm-finance-row">
            <span>Acomptes encaissés</span>
            <strong style={{ color: '#16a34a' }}>{totalAccomptes} €</strong>
          </div>
          <div className="crm-finance-row">
            <span>Soldes encaissés</span>
            <strong style={{ color: '#16a34a' }}>{soldeEncaisse} €</strong>
          </div>
          <div className="crm-finance-row" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
            <span>Restant à encaisser</span>
            <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>{totalSoldes - soldeEncaisse} €</strong>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
              <span>Progression encaissement</span>
              <span>{totalRevenu > 0 ? Math.round(((totalAccomptes + soldeEncaisse) / totalRevenu) * 100) : 0}%</span>
            </div>
            <div className="crm-bar-bg">
              <div className="crm-bar-fill" style={{ width: `${totalRevenu > 0 ? ((totalAccomptes + soldeEncaisse) / totalRevenu) * 100 : 0}%`, background: '#16a34a' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy par classe */}
      <div className="crm-card" style={{ marginTop: '1rem' }}>
        <div className="crm-card-title">Places par classe et par semaine</div>
        <div className="crm-occupancy-grid">
          {CLASSES.map(classe => {
            const col = CLASSE_COLORS[classe]
            const cap = CAPACITES[classe]
            return (
              <div key={classe} className="crm-occupancy-classe">
                <div className="crm-occ-header" style={{ background: col.bg, color: col.color }}>{classe}</div>
                {SEMAINES.map(s => {
                  const inscrits = occupancy[classe]?.[s.id] || 0
                  const pct = Math.min(100, (inscrits / cap) * 100)
                  const full = inscrits >= cap
                  return (
                    <div key={s.id} className="crm-occ-row">
                      <span className="crm-occ-sem">{s.label}</span>
                      <div className="crm-bar-bg" style={{ flex: 1 }}>
                        <div className="crm-bar-fill" style={{ width: `${pct}%`, background: full ? '#dc2626' : col.bar }} />
                      </div>
                      <span className="crm-occ-count" style={{ color: full ? '#dc2626' : col.color }}>
                        {inscrits}/{cap}
                        {full && ' COMPLET'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Formulaire d'édition d'une inscription existante ─────────────────────────
const ENFANT_EDIT_VIDE = {
  prenom: '', nom: '', dateNaissance: '', classe: 'Gan 1',
  semaines: [], garderie: [],
  allergiesAlimentaires: '', traitementEnCours: '', maladiesChroniques: '',
  vaccinsAJour: true, autorisationSoins: true, autorisationTransport: true,
}

function FormEditInscription({ inscription, user, password, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({
    parent1Prenom: inscription.parent1_prenom || '',
    parent1Nom:    inscription.parent1_nom || '',
    parent2Prenom: inscription.parent2_prenom || '',
    parent2Nom:    inscription.parent2_nom || '',
    telephone:     inscription.telephone || '',
    email:         inscription.email || '',
    modePaiement:  inscription.mode_paiement || 'especes_cheque',
    total:         inscription.total ?? '',
    accompte:      inscription.accompte ?? '',
    statut:        inscription.statut || 'en_attente',
    enfants: (inscription.enfants || []).map(e => ({
      prenom:               e.prenom || '',
      nom:                  e.nom || '',
      dateNaissance:        e.dateNaissance || '',
      classe:               e.classe || 'Gan 1',
      semaines:             e.semaines || [],
      garderie:             e.garderie || [],
      allergiesAlimentaires: e.allergiesAlimentaires || '',
      traitementEnCours:    e.traitementEnCours || '',
      maladiesChroniques:   e.maladiesChroniques || '',
      vaccinsAJour:         e.vaccinsAJour ?? true,
      autorisationSoins:    e.autorisationSoins ?? true,
      autorisationTransport: e.autorisationTransport ?? true,
    })),
  }))
  const [saving, setSaving] = useState(false)
  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  const setField   = (f, v)      => setForm(p => ({ ...p, [f]: v }))
  const setEnfant  = (idx, f, v) => setForm(p => { const e = [...p.enfants]; e[idx] = { ...e[idx], [f]: v }; return { ...p, enfants: e } })
  const toggleSem  = (idx, s)    => setForm(p => {
    const e = [...p.enfants]
    const sems = e[idx].semaines.includes(s) ? e[idx].semaines.filter(x => x !== s) : [...e[idx].semaines, s]
    const gard = (e[idx].garderie || []).filter(x => sems.includes(x)) // retire garderie des semaines déselectionnées
    e[idx] = { ...e[idx], semaines: sems, garderie: gard }
    return { ...p, enfants: e }
  })
  const toggleGarderie = (idx, s) => setForm(p => {
    const e = [...p.enfants]
    const gard = (e[idx].garderie || []).includes(s)
      ? (e[idx].garderie || []).filter(x => x !== s)
      : [...(e[idx].garderie || []), s]
    e[idx] = { ...e[idx], garderie: gard }
    return { ...p, enfants: e }
  })
  const addEnfant    = ()    => setForm(p => ({ ...p, enfants: [...p.enfants, { ...ENFANT_EDIT_VIDE }] }))
  const removeEnfant = (idx) => setForm(p => ({ ...p, enfants: p.enfants.filter((_, i) => i !== idx) }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      parent1_prenom: form.parent1Prenom,
      parent1_nom:    form.parent1Nom,
      parent2_prenom: form.parent2Prenom,
      parent2_nom:    form.parent2Nom,
      telephone:      form.telephone,
      email:          form.email,
      mode_paiement:  form.modePaiement,
      total:          Number(form.total),
      accompte:       Number(form.accompte),
      statut:         form.statut,
      enfants:        form.enfants,
      // Mise à jour de formData pour que les emails futurs utilisent les bonnes données
      formData: {
        parent1Prenom: form.parent1Prenom,
        parent1Nom:    form.parent1Nom,
        parent2Prenom: form.parent2Prenom,
        parent2Nom:    form.parent2Nom,
        telephone:     form.telephone,
        email:         form.email,
        modePaiement:  form.modePaiement,
        total:         Number(form.total),
        accompte:      Number(form.accompte),
        enfants:       form.enfants,
      },
    }
    await fetch(`/api/admin/inscriptions/${inscription.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify(payload),
    })
    onSaved()
    setSaving(false)
    onClose()
  }

  const sectionStyle = { fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 800, margin: '1rem 0 0.5rem' }

  return (
    <div className="crm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" style={{ maxWidth: 720 }}>
        <div className="crm-modal-header">
          <strong>✏️ Modifier #{inscription.id} — {inscription.parent1_prenom} {inscription.parent1_nom}</strong>
          <button className="crm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="crm-modal-body">

          {/* Parents */}
          <div style={sectionStyle}>Parents</div>
          <div className="crm-form-row">
            <div className="form-field"><label>Prénom parent 1 *</label><input required value={form.parent1Prenom} onChange={e => setField('parent1Prenom', e.target.value)} /></div>
            <div className="form-field"><label>Nom parent 1 *</label><input required value={form.parent1Nom} onChange={e => setField('parent1Nom', e.target.value)} /></div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Prénom parent 2</label><input value={form.parent2Prenom} onChange={e => setField('parent2Prenom', e.target.value)} /></div>
            <div className="form-field"><label>Nom parent 2</label><input value={form.parent2Nom} onChange={e => setField('parent2Nom', e.target.value)} /></div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Téléphone *</label><input required value={form.telephone} onChange={e => setField('telephone', e.target.value)} /></div>
            <div className="form-field"><label>Email *</label><input required type="email" value={form.email} onChange={e => setField('email', e.target.value)} /></div>
          </div>

          {/* Enfants */}
          <div style={sectionStyle}>
            Enfants
            <button type="button" onClick={addEnfant} style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 100, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Ajouter</button>
          </div>
          {form.enfants.map((en, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>Enfant {idx + 1}</strong>
                {form.enfants.length > 1 && <button type="button" onClick={() => removeEnfant(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem' }}>Supprimer</button>}
              </div>
              <div className="crm-form-row">
                <div className="form-field"><label>Prénom *</label><input required value={en.prenom} onChange={e => setEnfant(idx, 'prenom', e.target.value)} /></div>
                <div className="form-field"><label>Nom *</label><input required value={en.nom} onChange={e => setEnfant(idx, 'nom', e.target.value)} /></div>
              </div>
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Classe *</label>
                  <select value={en.classe} onChange={e => setEnfant(idx, 'classe', e.target.value)}>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Date de naissance</label><input type="date" value={en.dateNaissance} onChange={e => setEnfant(idx, 'dateNaissance', e.target.value)} /></div>
              </div>
              <div className="form-field">
                <label>Semaines *</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {SEMAINES.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={en.semaines.includes(s.id)} onChange={() => toggleSem(idx, s.id)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              {en.semaines.length > 0 && (
                <div className="form-field">
                  <label>🌅 Garderie (semaines sélectionnées)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {SEMAINES.filter(s => en.semaines.includes(s.id)).map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={(en.garderie || []).includes(s.id)} onChange={() => toggleGarderie(idx, s.id)} />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="crm-form-row" style={{ marginTop: '0.5rem' }}>
                <div className="form-field"><label>Allergies alimentaires</label><input value={en.allergiesAlimentaires || ''} onChange={e => setEnfant(idx, 'allergiesAlimentaires', e.target.value)} placeholder="—" /></div>
                <div className="form-field"><label>Traitement en cours</label><input value={en.traitementEnCours || ''} onChange={e => setEnfant(idx, 'traitementEnCours', e.target.value)} placeholder="—" /></div>
              </div>
              {en.maladiesChroniques !== undefined && (
                <div className="form-field"><label>Maladies chroniques</label><input value={en.maladiesChroniques || ''} onChange={e => setEnfant(idx, 'maladiesChroniques', e.target.value)} placeholder="—" /></div>
              )}
            </div>
          ))}

          {/* Paiement */}
          <div style={sectionStyle}>Paiement &amp; Statut</div>
          <div className="crm-form-row">
            <div className="form-field">
              <label>Mode de paiement</label>
              <select value={form.modePaiement} onChange={e => setField('modePaiement', e.target.value)}>
                <option value="especes_cheque">💵 Espèces / Chèque</option>
                <option value="cb">💳 Carte bancaire</option>
                <option value="autre">📋 Autre</option>
              </select>
            </div>
            <div className="form-field">
              <label>Statut</label>
              <select value={form.statut} onChange={e => setField('statut', e.target.value)}>
                {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Total (€) *</label><input required type="number" min="0" value={form.total} onChange={e => setField('total', e.target.value)} /></div>
            <div className="form-field"><label>Acompte reçu (€)</label><input type="number" min="0" value={form.accompte} onChange={e => setField('accompte', e.target.value)} /></div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn-refresh" style={{ borderRadius: 8 }} onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit" style={{ padding: '0.5rem 1.5rem' }} disabled={saving}>
              {saving ? '⏳ Enregistrement…' : '✅ Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal fusion doublons ─────────────────────────────────────────────────────
function ModalDoublons({ inscriptions, user, password, ignoredPairs, onMerged, onIgnore, onClose }) {
  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }
  const base = inscriptions.filter(i => i.statut !== 'annule')
  const groups = useMemo(() => detectDuplicates(base, ignoredPairs), [inscriptions, ignoredPairs])

  const [keepChoice, setKeepChoice] = useState({})
  const [merging, setMerging]       = useState({})
  const [done, setDone]             = useState({})
  const [errors, setErrors]         = useState({})

  const getKeepId = (gIdx) => keepChoice[gIdx] ?? groups[gIdx]?.[0]?.id

  const handleMerge = async (gIdx) => {
    const group    = groups[gIdx]
    const keepId   = getKeepId(gIdx)
    const toDelete = group.map(i => i.id).filter(id => id !== keepId)
    setMerging(prev => ({ ...prev, [gIdx]: true }))
    setErrors(prev => ({ ...prev, [gIdx]: null }))
    try {
      for (const deleteId of toDelete) {
        const res = await fetch('/api/admin/inscriptions/merge', {
          method: 'POST', headers,
          body: JSON.stringify({ keepId, deleteId }),
        })
        if (!res.ok) throw new Error(`Erreur serveur #${deleteId}`)
      }
      setDone(prev => ({ ...prev, [gIdx]: true }))
      onMerged()
    } catch (err) {
      setErrors(prev => ({ ...prev, [gIdx]: err.message || 'Erreur lors de la fusion' }))
    } finally {
      setMerging(prev => ({ ...prev, [gIdx]: false }))
    }
  }

  return (
    <div className="crm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" style={{ maxWidth: 860, width: '95vw', maxHeight: '88vh', overflow: 'auto' }}>
        <div className="crm-modal-header">
          <strong>🔀 Fusionner les doublons</strong>
          <button className="crm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="crm-modal-body">
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>Aucun doublon détecté</div>
              <div style={{ color: '#64748b', marginTop: '0.25rem' }}>{base.length} inscriptions analysées (email, téléphone, nom)</div>
            </div>
          ) : (
            <>
              <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                <strong style={{ color: '#7c3aed' }}>{groups.length} groupe{groups.length > 1 ? 's' : ''} de doublons</strong> détecté{groups.length > 1 ? 's' : ''}.
                Choisissez quelle inscription garder — les enfants et totaux seront automatiquement combinés.
              </p>

              {groups.map((group, gIdx) => {
                const keepId   = getKeepId(gIdx)
                const toDelete = group.map(i => i.id).filter(id => id !== keepId)
                const isDone   = done[gIdx]
                const isMerging = merging[gIdx]

                // Enfants en doublon
                const reasons = new Set()
                for (let a = 0; a < group.length; a++) {
                  for (let b = a + 1; b < group.length; b++) {
                    const keysB = new Set((group[b].enfants || []).map(e => `${(e.prenom||'').toLowerCase().trim()}-${(e.nom||'').toLowerCase().trim()}`))
                    ;(group[a].enfants || []).forEach(e => {
                      const k = `${(e.prenom||'').toLowerCase().trim()}-${(e.nom||'').toLowerCase().trim()}`
                      if (k.length > 2 && keysB.has(k)) reasons.add(`${e.prenom} ${e.nom}`)
                    })
                  }
                }

                // Prévisualisation résultat fusion
                const keeper = group.find(i => i.id === keepId)
                const previewEnfants = (() => {
                  const seen = new Set()
                  return group.flatMap(i => i.enfants || []).filter(e => {
                    const k = `${(e.prenom||'').toLowerCase()}-${(e.nom||'').toLowerCase()}`
                    if (seen.has(k)) return false
                    seen.add(k); return true
                  })
                })()
                const previewTotal    = group.reduce((s, i) => s + Number(i.total), 0)
                const previewAccompte = group.reduce((s, i) => s + Number(i.accompte), 0)

                return (
                  <div key={gIdx} style={{ border: isDone ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0', borderRadius: 10, marginBottom: '1.25rem', background: isDone ? '#f0fdf4' : 'white', overflow: 'hidden' }}>
                    {/* En-tête groupe */}
                    <div style={{ background: isDone ? '#dcfce7' : '#fef9ee', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: isDone ? '#15803d' : '#92400e' }}>
                        {isDone ? '✅ Fusionné avec succès' : `⚠️ Groupe ${gIdx + 1} — ${group.length} inscriptions similaires`}
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {[...reasons].map(r => (
                          <span key={r} style={{ fontSize: '0.72rem', background: '#ede9fe', color: '#6d28d9', padding: '1px 8px', borderRadius: 100, fontWeight: 700 }}>👶 {r}</span>
                        ))}
                      </div>
                    </div>

                    {!isDone && (
                      <>
                        {/* Liste inscriptions sélectionnables */}
                        <div style={{ padding: '12px 14px 0' }}>
                          {group.map(insc => {
                            const isKeeper = insc.id === keepId
                            return (
                              <label
                                key={insc.id}
                                style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, marginBottom: '0.6rem', cursor: 'pointer', border: isKeeper ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: isKeeper ? '#eff6ff' : '#fafafa', transition: 'all .15s' }}
                              >
                                <input
                                  type="radio"
                                  name={`keep-${gIdx}`}
                                  value={insc.id}
                                  checked={isKeeper}
                                  onChange={() => setKeepChoice(prev => ({ ...prev, [gIdx]: insc.id }))}
                                  style={{ marginTop: 4, accentColor: '#2563eb', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                                    <strong style={{ color: '#1e3a8a', fontSize: '0.9rem' }}>#{insc.id}</strong>
                                    <span style={{ fontWeight: 600 }}>{insc.parent1_prenom} {insc.parent1_nom}</span>
                                    {insc.parent2_prenom && (
                                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>+ {insc.parent2_prenom} {insc.parent2_nom}</span>
                                    )}
                                    <span style={{ fontSize: '0.73rem', background: STATUTS[insc.statut]?.bg, color: STATUTS[insc.statut]?.color, padding: '1px 8px', borderRadius: 100, fontWeight: 700 }}>
                                      {STATUTS[insc.statut]?.label}
                                    </span>
                                    {isKeeper && (
                                      <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 8px', borderRadius: 100, fontWeight: 700 }}>✓ À conserver</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.81rem', color: '#64748b', flexWrap: 'wrap' }}>
                                    {insc.email    && <span>✉ {insc.email}</span>}
                                    {insc.telephone && <span>📞 {displayPhone(insc.telephone)}</span>}
                                    <span>👶 {(insc.enfants || []).map(e => `${e.prenom} ${e.nom}`).join(', ') || '—'}</span>
                                    <span style={{ fontWeight: 700, color: '#1e3a8a' }}>
                                      {insc.total} € <span style={{ fontWeight: 400, color: '#16a34a' }}>(acc. {insc.accompte} €)</span>
                                    </span>
                                    <span style={{ color: '#94a3b8' }}>{new Date(insc.created_at).toLocaleDateString('fr-FR')}</span>
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>

                        {/* Prévisualisation résultat */}
                        <div style={{ margin: '0 14px 10px', padding: '9px 14px', background: '#f0f9ff', borderRadius: 8, fontSize: '0.82rem', color: '#1e3a8a', display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700 }}>Résultat :</span>
                          <span>👶 {previewEnfants.length} enfant{previewEnfants.length > 1 ? 's' : ''}</span>
                          <span>💰 <strong>{previewTotal} €</strong></span>
                          <span>✅ <strong style={{ color: '#16a34a' }}>{previewAccompte} €</strong> accompte</span>
                          <span>⏳ <strong style={{ color: '#dc2626' }}>{previewTotal - previewAccompte} €</strong> solde</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            #{toDelete.join(', #')} sera supprimé{toDelete.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        {errors[gIdx] && (
                          <div style={{ margin: '0 14px 10px', padding: '8px 12px', background: '#fee2e2', borderRadius: 6, fontSize: '0.82rem', color: '#dc2626' }}>
                            ❌ {errors[gIdx]}
                          </div>
                        )}

                        {/* Boutons actions */}
                        <div style={{ padding: '0 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              const ids = group.map(i => i.id)
                              const pairs = []
                              for (let a = 0; a < ids.length; a++)
                                for (let b = a + 1; b < ids.length; b++)
                                  pairs.push([ids[a], ids[b]])
                              onIgnore(pairs)
                            }}
                            style={{ padding: '0.45rem 1rem', background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: '0.84rem' }}
                          >
                            🚫 Ne pas fusionner
                          </button>
                          <button
                            onClick={() => handleMerge(gIdx)}
                            disabled={isMerging}
                            style={{ padding: '0.5rem 1.4rem', background: isMerging ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: isMerging ? 'not-allowed' : 'pointer', fontSize: '0.88rem' }}
                          >
                            {isMerging ? '⏳ Fusion en cours…' : `🔀 Fusionner — garder #${keepId}`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Onglet Familles ───────────────────────────────────────────────────────────
const ENFANT_VIDE = { prenom: '', nom: '', dateNaissance: '', classe: 'Gan 1', semaines: [], garderie: [], allergiesAlimentaires: '', traitementEnCours: '', maladiesChroniques: '' }
const INSC_VIDE = { parent1Prenom: '', parent1Nom: '', parent2Prenom: '', parent2Nom: '', telephone: '', email: '', modePaiement: 'especes_cheque', total: '', accompte: '', statut: 'accompte_paye', enfants: [{ ...ENFANT_VIDE }] }

function FormInscriptionManuelle({ user, password, onSaved, onClose }) {
  const [form, setForm] = useState(INSC_VIDE)
  const [saving, setSaving] = useState(false)
  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setEnfant = (idx, f, v) => setForm(p => { const e = [...p.enfants]; e[idx] = { ...e[idx], [f]: v }; return { ...p, enfants: e } })
  const toggleSem = (idx, s) => setForm(p => {
    const e = [...p.enfants]
    const sems = e[idx].semaines.includes(s) ? e[idx].semaines.filter(x => x !== s) : [...e[idx].semaines, s]
    e[idx] = { ...e[idx], semaines: sems }
    return { ...p, enfants: e }
  })
  const addEnfant = () => setForm(p => ({ ...p, enfants: [...p.enfants, { ...ENFANT_VIDE }] }))
  const removeEnfant = (idx) => setForm(p => ({ ...p, enfants: p.enfants.filter((_, i) => i !== idx) }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const total = Number(form.total)
    const accompte = form.modePaiement === 'cb' ? total : Number(form.accompte)
    // CB = paiement total en ligne → soldé d'emblée ; espèces/chèque = acompte seulement
    const statut = form.modePaiement === 'cb' ? 'solde_paye' : 'accompte_paye'
    const res = await fetch('/api/admin/inscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...form, total, accompte, statut }),
    })
    const { id } = await res.json()
    onSaved(id)
    setSaving(false)
    onClose()
  }

  return (
    <div className="crm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" style={{ maxWidth: 680 }}>
        <div className="crm-modal-header">
          <strong>📋 Saisie manuelle d'inscription</strong>
          <button className="crm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="crm-modal-body">
          {/* Parents */}
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 800, marginBottom: '0.5rem' }}>Parents</div>
          <div className="crm-form-row">
            <div className="form-field"><label>Prénom parent 1 *</label><input required value={form.parent1Prenom} onChange={e => setField('parent1Prenom', e.target.value)} placeholder="Prénom" /></div>
            <div className="form-field"><label>Nom parent 1 *</label><input required value={form.parent1Nom} onChange={e => setField('parent1Nom', e.target.value)} placeholder="Nom" /></div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Prénom parent 2</label><input value={form.parent2Prenom} onChange={e => setField('parent2Prenom', e.target.value)} placeholder="Prénom" /></div>
            <div className="form-field"><label>Nom parent 2</label><input value={form.parent2Nom} onChange={e => setField('parent2Nom', e.target.value)} placeholder="Nom" /></div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Téléphone *</label><input required value={form.telephone} onChange={e => setField('telephone', e.target.value)} placeholder="06 XX XX XX XX" /></div>
            <div className="form-field"><label>Email *</label><input required type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@exemple.com" /></div>
          </div>

          {/* Enfants */}
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 800, margin: '1rem 0 0.5rem' }}>
            Enfants
            <button type="button" onClick={addEnfant} style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 100, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Ajouter</button>
          </div>
          {form.enfants.map((en, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>Enfant {idx + 1}</strong>
                {form.enfants.length > 1 && <button type="button" onClick={() => removeEnfant(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem' }}>Supprimer</button>}
              </div>
              <div className="crm-form-row">
                <div className="form-field"><label>Prénom *</label><input required value={en.prenom} onChange={e => setEnfant(idx, 'prenom', e.target.value)} placeholder="Prénom" /></div>
                <div className="form-field"><label>Nom *</label><input required value={en.nom} onChange={e => setEnfant(idx, 'nom', e.target.value)} placeholder="Nom" /></div>
              </div>
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Classe *</label>
                  <select value={en.classe} onChange={e => setEnfant(idx, 'classe', e.target.value)}>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Date de naissance</label><input type="date" value={en.dateNaissance} onChange={e => setEnfant(idx, 'dateNaissance', e.target.value)} /></div>
              </div>
              <div className="form-field">
                <label>Semaines *</label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {SEMAINES.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={en.semaines.includes(s.id)} onChange={() => toggleSem(idx, s.id)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Paiement */}
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 800, margin: '0.5rem 0' }}>Paiement</div>
          <div className="crm-form-row">
            <div className="form-field">
              <label>Mode de paiement *</label>
              <select value={form.modePaiement} onChange={e => setField('modePaiement', e.target.value)}>
                <option value="especes_cheque">💵 Espèces / Chèque</option>
                <option value="cb">💳 Carte bancaire</option>
              </select>
            </div>
            <div className="form-field">
              <label>Statut *</label>
              <select value={form.statut} onChange={e => setField('statut', e.target.value)}>
                {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="crm-form-row">
            <div className="form-field"><label>Total (€) *</label><input required type="number" min="0" value={form.total} onChange={e => setField('total', e.target.value)} placeholder="ex: 360" /></div>
            {form.modePaiement === 'especes_cheque' && (
              <div className="form-field"><label>Acompte reçu (€) *</label><input required type="number" min="0" value={form.accompte} onChange={e => setField('accompte', e.target.value)} placeholder="ex: 100" /></div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn-refresh" style={{ borderRadius: 8 }} onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit" style={{ padding: '0.5rem 1.5rem' }} disabled={saving}>
              {saving ? '⏳ Enregistrement…' : '✅ Enregistrer l\'inscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormAjoutEnfant({ inscription, user, password, onSaved, onClose }) {
  const [enfant, setEnfant] = useState({ ...ENFANT_VIDE })
  const [saving, setSaving] = useState(false)
  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  const set = (f, v) => setEnfant(p => ({ ...p, [f]: v }))
  const toggleSem = (s) => setEnfant(p => ({
    ...p,
    semaines: p.semaines.includes(s) ? p.semaines.filter(x => x !== s) : [...p.semaines, s]
  }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const nouveauxEnfants = [...inscription.enfants, enfant]
    await fetch(`/api/admin/inscriptions/${inscription.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ enfants: nouveauxEnfants }),
    })
    onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <div className="crm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" style={{ maxWidth: 500 }}>
        <div className="crm-modal-header">
          <strong>👶 Ajouter un enfant — {inscription.parent1_prenom} {inscription.parent1_nom}</strong>
          <button className="crm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="crm-modal-body">
          <div className="crm-form-row">
            <div className="form-field"><label>Prénom *</label><input required value={enfant.prenom} onChange={e => set('prenom', e.target.value)} placeholder="Prénom" autoFocus /></div>
            <div className="form-field"><label>Nom *</label><input required value={enfant.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom" /></div>
          </div>
          <div className="crm-form-row">
            <div className="form-field">
              <label>Classe *</label>
              <select value={enfant.classe} onChange={e => set('classe', e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field"><label>Date de naissance</label><input type="date" value={enfant.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} /></div>
          </div>
          <div className="form-field">
            <label>Semaines *</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {SEMAINES.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={enfant.semaines.includes(s.id)} onChange={() => toggleSem(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn-refresh" style={{ borderRadius: 8 }} onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit" style={{ padding: '0.5rem 1.5rem' }} disabled={saving || enfant.semaines.length === 0}>
              {saving ? '⏳' : '✅ Ajouter l\'enfant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TabFamilles({ inscriptions, user, password, onStatutChange, onInscriptionAdded, onInscriptionDeleted, onInscriptionUpdated }) {
  const [filter, setFilter] = useState('tous')
  const [search, setSearch] = useState('')
  const [showSaisie, setShowSaisie] = useState(false)
  const [addEnfantTo, setAddEnfantTo] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sendingReceipt, setSendingReceipt] = useState({})
  const [receiptFeedback, setReceiptFeedback] = useState({})
  const [validating, setValidating] = useState({})
  const [showDoublons, setShowDoublons] = useState(false)
  const [editInscription, setEditInscription] = useState(null)
  const [ignoredPairs, setIgnoredPairs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gan_doublon_ignore') || '[]') } catch { return [] }
  })

  const addIgnoredPairs = (pairs) => {
    setIgnoredPairs(prev => {
      const existing = new Set(prev.map(([a, b]) => `${Math.min(a,b)}-${Math.max(a,b)}`))
      const toAdd = pairs.filter(([a, b]) => !existing.has(`${Math.min(a,b)}-${Math.max(a,b)}`))
      const next = [...prev, ...toAdd]
      localStorage.setItem('gan_doublon_ignore', JSON.stringify(next))
      return next
    })
  }

  const doublonGroups = useMemo(() => detectDuplicates(inscriptions.filter(i => i.statut !== 'annule'), ignoredPairs), [inscriptions, ignoredPairs])

  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  const handleSendReceipt = async (id) => {
    setSendingReceipt(prev => ({ ...prev, [id]: true }))
    setReceiptFeedback(prev => ({ ...prev, [id]: null }))
    try {
      const res = await fetch(`/api/admin/inscriptions/${id}/send-receipt`, {
        method: 'POST', headers,
      })
      if (!res.ok) throw new Error()
      // Marquer reçu envoyé de façon persistante en DB
      await fetch(`/api/admin/inscriptions/${id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ recu_envoye: true }),
      })
      setReceiptFeedback(prev => ({ ...prev, [id]: 'ok' }))
      onInscriptionUpdated()
    } catch {
      setReceiptFeedback(prev => ({ ...prev, [id]: 'error' }))
    } finally {
      setSendingReceipt(prev => ({ ...prev, [id]: false }))
      setTimeout(() => setReceiptFeedback(prev => ({ ...prev, [id]: null })), 4000)
    }
  }

  const handleValider = async (id) => {
    setValidating(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/admin/inscriptions/${id}/valider`, { method: 'POST', headers })
      if (!res.ok) throw new Error()
      onInscriptionUpdated()
    } catch {
      alert('Erreur lors de la validation — vérifiez la connexion email.')
    } finally {
      setValidating(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/inscriptions/${id}`, { method: 'DELETE', headers })
    onInscriptionDeleted(id)
    setConfirmDelete(null)
  }

  const handleArchive = async (id) => {
    await fetch(`/api/admin/inscriptions/${id}/statut`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ statut: 'archive' }),
    })
    onStatutChange(id, 'archive')
  }

  const filtered = useMemo(() => {
    let list = filter === 'tous' ? inscriptions : inscriptions.filter(i => i.statut === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        `${i.parent1_prenom} ${i.parent1_nom}`.toLowerCase().includes(q) ||
        (i.parent2_prenom && `${i.parent2_prenom} ${i.parent2_nom}`.toLowerCase().includes(q)) ||
        i.enfants.some(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q)) ||
        i.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [inscriptions, filter, search])

  return (
    <div>
      {showSaisie && <FormInscriptionManuelle user={user} password={password} onSaved={onInscriptionAdded} onClose={() => setShowSaisie(false)} />}
      {addEnfantTo && <FormAjoutEnfant inscription={addEnfantTo} user={user} password={password} onSaved={onInscriptionUpdated} onClose={() => setAddEnfantTo(null)} />}
      {showDoublons && <ModalDoublons inscriptions={inscriptions} user={user} password={password} ignoredPairs={ignoredPairs} onMerged={onInscriptionUpdated} onIgnore={addIgnoredPairs} onClose={() => setShowDoublons(false)} />}
      {editInscription && <FormEditInscription inscription={editInscription} user={user} password={password} onSaved={onInscriptionUpdated} onClose={() => setEditInscription(null)} />}

      {/* Modale confirmation suppression */}
      {confirmDelete && (
        <div className="crm-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="crm-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header" style={{ background: '#fee2e2' }}>
              <strong style={{ color: '#dc2626' }}>⚠️ Supprimer définitivement</strong>
              <button className="crm-modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="crm-modal-body">
              <p style={{ color: '#475569', marginBottom: '1rem' }}>
                Tu es sur le point de supprimer définitivement l'inscription de<br />
                <strong style={{ color: '#1e3a8a' }}>{confirmDelete.parent1_prenom} {confirmDelete.parent1_nom}</strong> (#{confirmDelete.id}).<br />
                <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>Cette action est irréversible.</span>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn-refresh" style={{ borderRadius: 8 }} onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button onClick={() => handleDelete(confirmDelete.id)} style={{ padding: '0.5rem 1.2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
                  🗑 Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-submit" style={{ padding: '0.5rem 1.2rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }} onClick={() => setShowSaisie(true)}>
          + Saisie manuelle
        </button>
        <button
          onClick={() => setShowDoublons(true)}
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.88rem', whiteSpace: 'nowrap', background: doublonGroups.length > 0 ? '#ede9fe' : '#f1f5f9', color: doublonGroups.length > 0 ? '#6d28d9' : '#64748b', border: doublonGroups.length > 0 ? '1.5px solid #c4b5fd' : '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          🔀 Doublons
          {doublonGroups.length > 0 && (
            <span style={{ background: '#7c3aed', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 800 }}>{doublonGroups.length}</span>
          )}
        </button>
        <input
          className="crm-search"
          type="text"
          placeholder="🔍 Rechercher famille, enfant, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="admin-filters" style={{ margin: 0 }}>
          {['tous', ...Object.keys(STATUTS)].map(f => (
            <button key={f} className={`admin-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'tous' ? `Tous (${inscriptions.length})` : `${STATUTS[f].label} (${inscriptions.filter(i => i.statut === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-empty">Aucune inscription trouvée.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Famille</th>
                <th>Contact</th>
                <th>Enfants</th>
                <th>Paiement accompte</th>
                <th>Mode solde</th>
                <th>Total / Solde</th>
                <th>Remise</th>
                <th>Total net</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const solde = Number(i.total) - Number(i.accompte)
                return (
                  <tr key={i.id}>
                    <td className="td-id">#{i.id}</td>
                    <td className="td-date">
                      {new Date(i.created_at).toLocaleDateString('fr-FR')}<br />
                      <span className="td-time">{new Date(i.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      <strong>{i.parent1_prenom} {i.parent1_nom}</strong>
                      {i.parent2_prenom && <div className="td-sub">{i.parent2_prenom} {i.parent2_nom}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <a href={`mailto:${i.email}`} className="crm-btn-icon crm-btn-email" title="Email">✉</a>
                        <a href={waLink(i.telephone)} target="_blank" rel="noreferrer" className="crm-btn-icon crm-btn-wa" title="WhatsApp">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                      <a href={`mailto:${i.email}`} className="td-email">{i.email}</a>
                      {i.telephone && (
                        <a href={`tel:${i.telephone}`} className="td-phone">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.47 11.47 0 003.58.57 1 1 0 011 1v3.5a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.47 11.47 0 00.57 3.58 1 1 0 01-.25 1.01l-2.2 2.2z"/></svg>
                          {displayPhone(i.telephone)}
                        </a>
                      )}
                    </td>
                    <td>
                      {i.enfants.map((e, idx) => (
                        <div key={idx} className="td-enfant">
                          <strong>{e.prenom} {e.nom}</strong>
                          <span className="td-classe" style={{ background: CLASSE_COLORS[e.classe]?.bg, color: CLASSE_COLORS[e.classe]?.color }}>{e.classe}</span>
                          <span className="td-semaines">{e.semaines.map(s => `S${s}`).join(' ')}</span>
                          {e.garderie?.length > 0 && <span style={{ fontSize: '0.7rem', color: '#7c3aed' }}>+garderie</span>}
                        </div>
                      ))}
                      {i.enfants.some(e => e.allergiesAlimentaires || e.traitementEnCours || e.maladiesChroniques) && (
                        <div className="td-allergie">⚠ Infos santé</div>
                      )}
                    </td>
                    <td>
                      {i.mode_paiement === 'autre' ? (
                        <span className="badge-mode" style={{ background: '#ede9fe', color: '#6d28d9' }}>💵 Espèces directes</span>
                      ) : (
                        <select
                          className="paiement-mode-select"
                          value={i.accompte_mode_paiement || 'cb'}
                          onChange={async e => {
                            const val = e.target.value
                            await fetch(`/api/admin/inscriptions/${i.id}`, {
                              method: 'PATCH', headers,
                              body: JSON.stringify({ accompte_mode_paiement: val }),
                            })
                            onInscriptionUpdated()
                          }}
                        >
                          <option value="cb">💳 CB</option>
                          <option value="especes">💵 Espèces</option>
                          <option value="cheque">📝 Chèque</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <select
                        className="solde-mode-select"
                        value={i.solde_mode_paiement || ''}
                        onChange={async e => {
                          const val = e.target.value
                          await fetch(`/api/admin/inscriptions/${i.id}`, {
                            method: 'PATCH', headers,
                            body: JSON.stringify({ solde_mode_paiement: val }),
                          })
                          onInscriptionUpdated()
                        }}
                      >
                        <option value="">—</option>
                        <option value="cb">💳 CB</option>
                        <option value="especes">💵 Espèces</option>
                        <option value="cheque">📝 Chèque</option>
                      </select>
                    </td>
                    <td>
                      <div className="td-total">{i.total} €</div>
                      <div className="td-sub">Acompte : <span style={{ color: '#16a34a', fontWeight: 700 }}>{i.accompte} €</span></div>
                      {solde > 0 && <div className="td-solde">Solde : {solde} €</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={i.remise || 0}
                        onChange={async e => {
                          const val = Number(e.target.value)
                          await fetch(`/api/admin/inscriptions/${i.id}`, {
                            method: 'PATCH', headers,
                            body: JSON.stringify({ remise: val }),
                          })
                          onInscriptionUpdated()
                        }}
                        style={{ width: 65, textAlign: 'center', padding: '3px 6px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit' }}
                      />
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>€</div>
                    </td>
                    <td>
                      {(() => {
                        const remise = Number(i.remise || 0)
                        const totalNet = Number(i.total) - remise
                        const soldeNet = totalNet - Number(i.accompte)
                        return (
                          <>
                            <div className="td-total" style={{ color: remise > 0 ? '#7c3aed' : '#1e3a8a' }}>{totalNet} €</div>
                            {soldeNet > 0 && <div className="td-solde">Solde : {soldeNet} €</div>}
                          </>
                        )
                      })()}
                    </td>
                    <td>
                      <select
                        className="statut-select"
                        value={i.statut}
                        onChange={e => onStatutChange(i.id, e.target.value)}
                        style={{ background: STATUTS[i.statut]?.bg, color: STATUTS[i.statut]?.color }}
                      >
                        {Object.entries(STATUTS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                        <button className="crm-btn-action crm-btn-action-edit" onClick={() => setEditInscription(i)} title="Modifier l'inscription">
                          ✏️ Modifier
                        </button>
                        {i.statut === 'attente_validation' && (
                          <button
                            className="crm-btn-action crm-btn-action-valider"
                            onClick={() => handleValider(i.id)}
                            disabled={!!validating[i.id]}
                            title="Valider l'inscription et envoyer l'email de confirmation"
                          >
                            {validating[i.id] ? '⏳ Envoi…' : '✅ Valider & envoyer'}
                          </button>
                        )}
                        <button className="crm-btn-action crm-btn-action-add" onClick={() => setAddEnfantTo(i)} title="Ajouter un enfant">
                          👶 Enfant
                        </button>
                        <button
                          className={`crm-btn-action crm-btn-action-receipt${
                            i.recu_envoye || receiptFeedback[i.id] === 'ok' ? ' crm-btn-action-receipt--ok' :
                            receiptFeedback[i.id] === 'error' ? ' crm-btn-action-receipt--error' : ''
                          }`}
                          onClick={() => handleSendReceipt(i.id)}
                          disabled={!!sendingReceipt[i.id]}
                          title={i.recu_envoye ? 'Reçu déjà envoyé — renvoyer ?' : 'Envoyer le reçu PDF par email'}
                        >
                          {sendingReceipt[i.id]
                            ? '⏳ Envoi…'
                            : i.recu_envoye || receiptFeedback[i.id] === 'ok'
                            ? '✅ Reçu envoyé'
                            : receiptFeedback[i.id] === 'error'
                            ? '❌ Erreur'
                            : '📄 Reçu'}
                        </button>
                        <button className="crm-btn-action crm-btn-action-archive" onClick={() => handleArchive(i.id)} title="Archiver">
                          📦 Archiver
                        </button>
                        <button className="crm-btn-action crm-btn-action-delete" onClick={() => setConfirmDelete(i)} title="Supprimer">
                          🗑 Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f9ff', fontWeight: 700, borderTop: '2px solid #bfdbfe', fontSize: '0.84rem' }}>
                <td colSpan={7} style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                  Totaux — {filtered.length} inscription{filtered.length > 1 ? 's' : ''}
                </td>
                <td style={{ padding: '8px 12px', color: '#1e3a8a' }}>
                  <div style={{ fontWeight: 800 }}>{filtered.reduce((s, i) => s + Number(i.total), 0)} €</div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    Acc. : {filtered.reduce((s, i) => s + Number(i.accompte), 0)} €
                  </div>
                </td>
                <td style={{ padding: '8px 12px', color: '#dc2626', textAlign: 'center', fontWeight: 800 }}>
                  -{filtered.reduce((s, i) => s + Number(i.remise || 0), 0)} €
                </td>
                <td style={{ padding: '8px 12px', color: '#1e3a8a' }}>
                  <div style={{ fontWeight: 800 }}>{filtered.reduce((s, i) => s + Number(i.total) - Number(i.remise || 0), 0)} €</div>
                  <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                    Solde : {filtered.reduce((s, i) => {
                      const net = Number(i.total) - Number(i.remise || 0)
                      return s + Math.max(0, net - Number(i.accompte))
                    }, 0)} €
                  </div>
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Onglet Analytics ─────────────────────────────────────────────────────────
const SOURCE_LABELS = {
  direct:  { label: 'Accès direct',       icon: '🔗' },
  moteur:  { label: 'Moteur de recherche', icon: '🔍' },
  reseaux: { label: 'Réseaux sociaux',     icon: '📱' },
  whatsapp:{ label: 'WhatsApp',            icon: '💬' },
  autre:   { label: 'Autre site',          icon: '🌐' },
}

const PAGE_LABELS = {
  '/':        'Accueil',
  '/inscription': 'Inscription',
  '/admin':   'Admin',
}

function TabAnalytics({ user, password }) {
  const [data, setData] = useState(null)
  const [periode, setPeriode] = useState(30)
  const [liveEvents, setLiveEvents] = useState([])
  const [todayLive, setTodayLive] = useState({ views: 0, uniques: 0 })
  const [connected, setConnected] = useState(false)

  const headers = { 'x-admin-user': user, 'x-admin-password': password }

  useEffect(() => {
    fetch('/api/admin/analytics', { headers })
      .then(r => r.json())
      .then(d => {
        setData(d)
        const today = new Date().toISOString().slice(0, 10)
        const td = d.days?.[today] || { views: 0, uniques: [] }
        setTodayLive({ views: td.views, uniques: td.uniques.length })
      })
  }, [])

  useEffect(() => {
    const es = new EventSource(
      `/api/admin/analytics/live?u=${encodeURIComponent(user)}&p=${encodeURIComponent(password)}`,
      // headers not supported in EventSource — on envoie via query params
    )
    // EventSource ne supporte pas les headers custom, on utilise une alternative
    es.close()

    // Alternative : fetch SSE manuel via ReadableStream
    const ctrl = new AbortController()
    fetch('/api/admin/analytics/live', { headers, signal: ctrl.signal })
      .then(res => {
        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        function read() {
          reader.read().then(({ done, value }) => {
            if (done) { setConnected(false); return }
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop()
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6))
                  if (event.type === 'init') return
                  setTodayLive({ views: event.todayViews, uniques: event.todayUniques })
                  setLiveEvents(prev => [{
                    ...event,
                    id: Date.now() + Math.random(),
                  }, ...prev].slice(0, 20))
                } catch {}
              }
            }
            read()
          }).catch(() => setConnected(false))
        }
        read()
      })
      .catch(() => setConnected(false))

    return () => ctrl.abort()
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periode)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const days = Object.entries(data.days)
      .filter(([d]) => d >= cutoffStr)
      .sort(([a], [b]) => a.localeCompare(b))

    const totalViews   = days.reduce((s, [, d]) => s + d.views, 0)
    const totalUniques = days.reduce((s, [, d]) => s + d.uniques.length, 0)

    const pages = {}
    const sources = {}
    for (const [, d] of days) {
      for (const [p, n] of Object.entries(d.pages || {})) pages[p] = (pages[p] || 0) + n
      for (const [s, n] of Object.entries(d.sources || {})) sources[s] = (sources[s] || 0) + n
    }

    const topPages = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topSources = Object.entries(sources).sort((a, b) => b[1] - a[1])

    // Série temporelle pour le graphe (barres SVG)
    const maxViews = Math.max(...days.map(([, d]) => d.views), 1)

    return { days, totalViews, totalUniques, topPages, topSources, maxViews }
  }, [data, periode])

  if (!data) return <div className="admin-empty">Chargement…</div>

  return (
    <div>
      {/* Bandeau LIVE */}
      <div className="crm-live-bar">
        <span className={`crm-live-dot ${connected ? 'live' : 'offline'}`} />
        <span className="crm-live-label">{connected ? 'LIVE' : 'Hors ligne'}</span>
        <span className="crm-live-stats">
          <strong>{todayLive.views}</strong> vues &nbsp;·&nbsp; <strong>{todayLive.uniques}</strong> visiteurs uniques aujourd'hui
        </span>
        {liveEvents.length > 0 && (
          <span className="crm-live-last">
            Dernière visite : <strong>{PAGE_LABELS[liveEvents[0].path] || liveEvents[0].path}</strong>
            &nbsp;·&nbsp; {SOURCE_LABELS[liveEvents[0].source]?.icon} {new Date(liveEvents[0].time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Stats du jour */}
      <div className="admin-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1rem' }}>
        {[
          { label: "Vues aujourd'hui",     value: todayLive.views,           icon: '👁' },
          { label: "Visiteurs uniques",    value: todayLive.uniques,         icon: '🧑' },
          { label: `Vues (${periode}j)`,   value: stats?.totalViews ?? 0,    icon: '📈' },
          { label: `Uniques (${periode}j)`,value: stats?.totalUniques ?? 0,  icon: '👥' },
        ].map(s => (
          <div key={s.label} className="admin-stat-card">
            <div className="asc-icon">{s.icon}</div>
            <div className="asc-value">{s.value}</div>
            <div className="asc-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sélecteur de période */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[7, 14, 30, 60, 90].map(p => (
          <button key={p} className={`admin-filter-btn ${periode === p ? 'active' : ''}`} onClick={() => setPeriode(p)}>
            {p} jours
          </button>
        ))}
      </div>

      {/* Graphe barres */}
      {stats && stats.days.length > 0 && (
        <div className="crm-card" style={{ marginBottom: '1rem' }}>
          <div className="crm-card-title">Visites par jour</div>
          <div className="crm-chart">
            {stats.days.map(([date, d]) => {
              const pct = (d.views / stats.maxViews) * 100
              const label = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              return (
                <div key={date} className="crm-chart-bar-wrap" title={`${label} : ${d.views} vues, ${d.uniques.length} uniques`}>
                  <div className="crm-chart-bar-inner">
                    <div className="crm-chart-bar-fill" style={{ height: `${Math.max(4, pct)}%` }} />
                  </div>
                  {stats.days.length <= 14 && (
                    <div className="crm-chart-label">{label}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Flux live */}
      {liveEvents.length > 0 && (
        <div className="crm-card" style={{ marginBottom: '1rem' }}>
          <div className="crm-card-title">Flux en direct</div>
          <div className="crm-live-feed">
            {liveEvents.map(e => (
              <div key={e.id} className="crm-live-event">
                <span className="crm-live-event-time">{new Date(e.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className="crm-live-event-page">{PAGE_LABELS[e.path] || e.path}</span>
                <span className="crm-live-event-src">{SOURCE_LABELS[e.source]?.icon} {SOURCE_LABELS[e.source]?.label}</span>
                {e.isNew && <span className="crm-live-event-new">Nouveau</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="crm-dash-grid">
        {/* Top pages */}
        <div className="crm-card">
          <div className="crm-card-title">Pages les plus visitées</div>
          {stats?.topPages.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucune donnée</div>}
          {stats?.topPages.map(([page, count]) => (
            <div key={page} className="crm-statut-row">
              <span style={{ fontSize: '0.85rem', color: '#475569', flex: 1 }}>
                {PAGE_LABELS[page] || page}
              </span>
              <span className="crm-statut-count">{count}</span>
              <div className="crm-bar-bg">
                <div className="crm-bar-fill" style={{ width: `${(count / (stats.topPages[0]?.[1] || 1)) * 100}%`, background: '#2563eb' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="crm-card">
          <div className="crm-card-title">Sources de trafic</div>
          {stats?.topSources.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucune donnée</div>}
          {stats?.topSources.map(([src, count]) => {
            const s = SOURCE_LABELS[src] || { label: src, icon: '🌐' }
            return (
              <div key={src} className="crm-statut-row">
                <span style={{ fontSize: '0.85rem', color: '#475569', flex: 1 }}>{s.icon} {s.label}</span>
                <span className="crm-statut-count">{count}</span>
                <div className="crm-bar-bg">
                  <div className="crm-bar-fill" style={{ width: `${(count / (stats.topSources[0]?.[1] || 1)) * 100}%`, background: '#7c3aed' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Onglet Visiteurs ─────────────────────────────────────────────────────────
const STATUTS_VISITEUR = {
  a_rappeler:  { label: 'À rappeler',   color: '#f59e0b', bg: '#fef3c7' },
  interesse:   { label: 'Intéressé',   color: '#2563eb', bg: '#dbeafe' },
  inscrit:     { label: 'Inscrit',      color: '#16a34a', bg: '#dcfce7' },
  pas_suite:   { label: 'Pas de suite', color: '#94a3b8', bg: '#f1f5f9' },
}

const SOURCES = [
  { value: 'visite',      label: '🚶 Visite physique' },
  { value: 'telephone',   label: '📞 Appel téléphonique' },
  { value: 'email',       label: '✉ Email' },
  { value: 'whatsapp',    label: '💬 WhatsApp' },
  { value: 'bouche_oreille', label: '🗣 Bouche à oreille' },
  { value: 'reseaux',     label: '📱 Réseaux sociaux' },
  { value: 'autre',       label: '📌 Autre' },
]

const VIDE = { prenom: '', nom: '', telephone: '', email: '', enfants: '', classe_interessee: '', semaines_interessees: [], source: 'visite', statut: 'a_rappeler', notes: '' }

function TabVisiteurs({ user, password }) {
  const [visiteurs, setVisiteurs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(VIDE)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')

  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  useEffect(() => {
    fetch('/api/admin/visiteurs', { headers })
      .then(r => r.json())
      .then(setVisiteurs)
  }, [])

  const filtered = visiteurs.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${v.prenom} ${v.nom} ${v.telephone} ${v.email}`.toLowerCase().includes(q)
    const matchStatut = filterStatut === 'tous' || v.statut === filterStatut
    return matchSearch && matchStatut
  })

  const openNew = () => { setForm(VIDE); setEditId(null); setShowForm(true) }
  const openEdit = (v) => { setForm({ ...v }); setEditId(v.id); setShowForm(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    if (editId) {
      await fetch(`/api/admin/visiteurs/${editId}`, { method: 'PATCH', headers, body: JSON.stringify(form) })
      setVisiteurs(prev => prev.map(v => v.id === editId ? { ...v, ...form } : v))
    } else {
      const res = await fetch('/api/admin/visiteurs', { method: 'POST', headers, body: JSON.stringify(form) })
      const { id } = await res.json()
      setVisiteurs(prev => [{ ...form, id, created_at: new Date().toISOString() }, ...prev])
    }
    setSaving(false)
    setShowForm(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce visiteur ?')) return
    await fetch(`/api/admin/visiteurs/${id}`, { method: 'DELETE', headers })
    setVisiteurs(prev => prev.filter(v => v.id !== id))
  }

  const handleStatutChange = async (id, statut) => {
    await fetch(`/api/admin/visiteurs/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ statut }) })
    setVisiteurs(prev => prev.map(v => v.id === id ? { ...v, statut } : v))
  }

  const f = (field, val) => setForm(prev => ({ ...prev, [field]: val }))
  const toggleSemaine = (s) => setForm(prev => ({
    ...prev,
    semaines_interessees: prev.semaines_interessees.includes(s)
      ? prev.semaines_interessees.filter(x => x !== s)
      : [...prev.semaines_interessees, s]
  }))

  return (
    <div>
      {/* Barre d'outils */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-submit" style={{ padding: '0.5rem 1.2rem', fontSize: '0.88rem' }} onClick={openNew}>
          + Ajouter un visiteur
        </button>
        <input className="crm-search" type="text" placeholder="🔍 Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="admin-filters" style={{ margin: 0 }}>
          {['tous', ...Object.keys(STATUTS_VISITEUR)].map(s => (
            <button key={s} className={`admin-filter-btn ${filterStatut === s ? 'active' : ''}`} onClick={() => setFilterStatut(s)}>
              {s === 'tous' ? `Tous (${visiteurs.length})` : `${STATUTS_VISITEUR[s].label} (${visiteurs.filter(v => v.statut === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="crm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="crm-modal">
            <div className="crm-modal-header">
              <strong>{editId ? 'Modifier le visiteur' : 'Nouveau visiteur'}</strong>
              <button className="crm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="crm-modal-body">
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Prénom *</label>
                  <input required value={form.prenom} onChange={e => f('prenom', e.target.value)} placeholder="Prénom" />
                </div>
                <div className="form-field">
                  <label>Nom *</label>
                  <input required value={form.nom} onChange={e => f('nom', e.target.value)} placeholder="Nom" />
                </div>
              </div>
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Téléphone</label>
                  <input value={form.telephone} onChange={e => f('telephone', e.target.value)} placeholder="06 XX XX XX XX" />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@exemple.com" />
                </div>
              </div>
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Enfant(s)</label>
                  <input value={form.enfants} onChange={e => f('enfants', e.target.value)} placeholder="Prénom enfant, âge…" />
                </div>
                <div className="form-field">
                  <label>Classe intéressée</label>
                  <select value={form.classe_interessee} onChange={e => f('classe_interessee', e.target.value)}>
                    <option value="">— Non précisé —</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Semaines intéressées</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {SEMAINES.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.semaines_interessees.includes(s.id)} onChange={() => toggleSemaine(s.id)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="crm-form-row">
                <div className="form-field">
                  <label>Source</label>
                  <select value={form.source} onChange={e => f('source', e.target.value)}>
                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Statut</label>
                  <select value={form.statut} onChange={e => f('statut', e.target.value)}>
                    {Object.entries(STATUTS_VISITEUR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={3} placeholder="Notes libres…" style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.88rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-refresh" style={{ borderRadius: '8px' }} onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-submit" style={{ padding: '0.5rem 1.5rem' }} disabled={saving}>
                  {saving ? '⏳' : editId ? '✅ Enregistrer' : '+ Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="admin-empty">Aucun visiteur trouvé.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Contact</th>
                <th>Enfant(s)</th>
                <th>Intérêt</th>
                <th>Source</th>
                <th>Notes</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td className="td-date">
                    {new Date(v.created_at).toLocaleDateString('fr-FR')}<br />
                    <span className="td-time">{new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {v.telephone && <a href={waLink(v.telephone)} target="_blank" rel="noreferrer" className="crm-btn-icon crm-btn-wa" title="WhatsApp">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>}
                      {v.email && <a href={`mailto:${v.email}`} className="crm-btn-icon crm-btn-email" title="Email">✉</a>}
                      {v.telephone && <a href={`tel:${v.telephone}`} className="crm-btn-tel">📞</a>}
                    </div>
                    <strong style={{ fontSize: '0.88rem' }}>{v.prenom} {v.nom}</strong>
                    {v.telephone && <div className="td-sub">{v.telephone}</div>}
                    {v.email && <div className="td-sub">{v.email}</div>}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{v.enfants || '—'}</td>
                  <td>
                    {v.classe_interessee && (
                      <span className="td-classe" style={{ background: CLASSE_COLORS[v.classe_interessee]?.bg, color: CLASSE_COLORS[v.classe_interessee]?.color }}>
                        {v.classe_interessee}
                      </span>
                    )}
                    {v.semaines_interessees?.length > 0 && (
                      <div className="td-sub">{v.semaines_interessees.map(s => `S${s}`).join(' ')}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {SOURCES.find(s => s.value === v.source)?.label || v.source}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#475569', maxWidth: 180 }}>
                    {v.notes ? <span title={v.notes}>{v.notes.length > 60 ? v.notes.slice(0, 60) + '…' : v.notes}</span> : '—'}
                  </td>
                  <td>
                    <select
                      className="statut-select"
                      value={v.statut}
                      onChange={e => handleStatutChange(v.id, e.target.value)}
                      style={{ background: STATUTS_VISITEUR[v.statut]?.bg, color: STATUTS_VISITEUR[v.statut]?.color }}
                    >
                      {Object.entries(STATUTS_VISITEUR).map(([k, sv]) => (
                        <option key={k} value={k}>{sv.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="crm-btn-copy-sm" title="Modifier" onClick={() => openEdit(v)}>✏️</button>
                      <button className="crm-btn-copy-sm" title="Supprimer" onClick={() => handleDelete(v.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Onglet Par classe ─────────────────────────────────────────────────────────
function TabClasses({ inscriptions }) {
  const [selectedClasse, setSelectedClasse] = useState('Pre Gan')
  const [selectedSemaine, setSelectedSemaine] = useState(1)
  const [copied, setCopied] = useState(false)

  const children = useMemo(() => {
    const list = []
    for (const i of inscriptions) {
      if (i.statut === 'annule') continue
      for (const e of i.enfants) {
        if (e.classe === selectedClasse && e.semaines.includes(selectedSemaine)) {
          list.push({ ...e, parent: i })
        }
      }
    }
    return list.sort((a, b) => a.nom.localeCompare(b.nom))
  }, [inscriptions, selectedClasse, selectedSemaine])

  const phones = children.map(c => c.parent.telephone).filter(Boolean)

  function copyPhones() {
    const formatted = phones.map(p => {
      const d = p.replace(/\D/g, '')
      return d.startsWith('0') ? d.replace(/^0/, '0').replace(/(.{2})/g, '$1 ').trim() : p
    }).join('\n')
    navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const col = CLASSE_COLORS[selectedClasse]
  const cap = CAPACITES[selectedClasse]

  return (
    <div>
      <div className="crm-classe-nav">
        {CLASSES.map(c => (
          <button
            key={c}
            className={`crm-classe-tab ${selectedClasse === c ? 'active' : ''}`}
            style={selectedClasse === c ? { background: CLASSE_COLORS[c].bg, color: CLASSE_COLORS[c].color, borderColor: CLASSE_COLORS[c].bar } : {}}
            onClick={() => setSelectedClasse(c)}
          >
            {c}
            <span className="crm-classe-tab-count">
              {inscriptions.filter(i => i.statut !== 'annule' && i.enfants.some(e => e.classe === c)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="crm-semaine-nav">
        {SEMAINES.map(s => (
          <button
            key={s.id}
            className={`crm-semaine-tab ${selectedSemaine === s.id ? 'active' : ''}`}
            onClick={() => setSelectedSemaine(s.id)}
          >
            {s.label}
            <span className="crm-semaine-count">{inscriptions.filter(i => i.statut !== 'annule' && i.enfants.some(e => e.classe === selectedClasse && e.semaines.includes(s.id))).length} / {cap}</span>
          </button>
        ))}
      </div>

      <div className="crm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span className="crm-card-title" style={{ margin: 0 }}>
              <span style={{ background: col.bg, color: col.color, padding: '2px 12px', borderRadius: 100, fontWeight: 800 }}>{selectedClasse}</span>
              &nbsp;— {SEMAINES.find(s => s.id === selectedSemaine)?.label}
            </span>
            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>{children.length} enfant{children.length > 1 ? 's' : ''} / {cap} places</span>
          </div>
          <button className="crm-btn-copy" onClick={copyPhones} disabled={phones.length === 0}>
            {copied ? '✅ Copié !' : '📋 Copier les numéros'}
          </button>
        </div>

        {children.length === 0 ? (
          <div className="admin-empty" style={{ padding: '2rem' }}>Aucun enfant inscrit pour cette sélection.</div>
        ) : (
          <div className="crm-children-grid">
            {children.map((e, idx) => (
              <div key={idx} className="crm-child-card">
                <div className="crm-child-name">{e.prenom} {e.nom}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>
                  né{e.prenom.endsWith('e') ? 'e' : ''} le {e.dateNaissance ? new Date(e.dateNaissance).toLocaleDateString('fr-FR') : '—'}
                </div>
                {(e.garderie || []).includes(selectedSemaine) && (
                  <div className="crm-child-garderie">🌅 Garderie</div>
                )}
                {(e.allergiesAlimentaires || e.traitementEnCours || e.maladiesChroniques) && (
                  <div className="crm-child-health">
                    ⚠ {[e.allergiesAlimentaires, e.traitementEnCours, e.maladiesChroniques].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="crm-child-parent">
                  <span>{e.parent.parent1_prenom} {e.parent.parent1_nom}</span>
                  <a href={waLink(e.parent.telephone)} target="_blank" rel="noreferrer" className="crm-btn-icon crm-btn-wa" style={{ padding: '2px 6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Onglet WhatsApp & Soldes ──────────────────────────────────────────────────
function TabWhatsapp({ inscriptions, user, password }) {
  const [copiedId, setCopiedId] = useState(null)
  const [relancing, setRelancing] = useState(false)
  const [relanceResult, setRelanceResult] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const headers = { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password }

  const handleRelanceEmail = async () => {
    setShowConfirm(false)
    setRelancing(true)
    setRelanceResult(null)
    try {
      const res = await fetch('/api/admin/relance-email', { method: 'POST', headers })
      const data = await res.json()
      setRelanceResult(data)
    } catch {
      setRelanceResult({ ok: false, error: 'Erreur réseau' })
    } finally {
      setRelancing(false)
    }
  }

  const avecSolde = useMemo(() =>
    inscriptions
      .filter(i => i.statut !== 'annule' && i.statut !== 'solde_paye' && (i.total - i.accompte) > 0)
      .sort((a, b) => (b.total - b.accompte) - (a.total - a.accompte)),
    [inscriptions]
  )

  const totalRestant = avecSolde.reduce((s, i) => s + (i.total - i.accompte), 0)

  function copyMessage(i) {
    const msg = soldeMessage(i.parent1_prenom, i.enfants, i.total - i.accompte)
    navigator.clipboard.writeText(msg)
    setCopiedId(i.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Groupes par classe/semaine
  const groupesSuggeres = useMemo(() => {
    const groups = []
    for (const classe of CLASSES) {
      for (const s of SEMAINES) {
        const families = inscriptions.filter(i =>
          i.statut !== 'annule' &&
          i.enfants.some(e => e.classe === classe && e.semaines.includes(s.id))
        )
        if (families.length > 0) {
          groups.push({ classe, semaine: s, families })
        }
      }
    }
    return groups
  }, [inscriptions])

  const [copiedGroup, setCopiedGroup] = useState(null)
  function copyGroupPhones(groupe) {
    const phones = [...new Set(groupe.families.map(f => f.telephone).filter(Boolean))]
    navigator.clipboard.writeText(phones.join('\n'))
    setCopiedGroup(`${groupe.classe}-${groupe.semaine.id}`)
    setTimeout(() => setCopiedGroup(null), 2000)
  }

  return (
    <div>
      {/* Modale confirmation relance */}
      {showConfirm && (
        <div className="crm-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="crm-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header" style={{ background: '#fff7ed' }}>
              <strong style={{ color: '#9a3412' }}>📧 Relance email — confirmation</strong>
              <button className="crm-modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <div className="crm-modal-body">
              <p style={{ color: '#475569', marginBottom: '1rem', lineHeight: 1.6 }}>
                Tu es sur le point d'envoyer un email de rappel de solde à <strong style={{ color: '#9a3412' }}>{avecSolde.length} famille{avecSolde.length > 1 ? 's' : ''}</strong> (total : <strong>{totalRestant} €</strong>).<br />
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Chaque parent recevra un email avec son solde restant et la date limite de paiement.</span>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn-refresh" style={{ borderRadius: 8 }} onClick={() => setShowConfirm(false)}>Annuler</button>
                <button
                  onClick={handleRelanceEmail}
                  style={{ padding: '0.5rem 1.4rem', background: '#f97316', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  📧 Envoyer {avecSolde.length} email{avecSolde.length > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rappels de solde */}
      <div className="crm-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="crm-card-title" style={{ margin: 0 }}>Soldes à encaisser</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{avecSolde.length} famille{avecSolde.length > 1 ? 's' : ''} — total restant : <strong style={{ color: '#dc2626' }}>{totalRestant} €</strong></div>
          </div>
          {avecSolde.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <button
                onClick={() => { setRelanceResult(null); setShowConfirm(true) }}
                disabled={relancing}
                style={{ padding: '0.45rem 1.1rem', background: relancing ? '#fed7aa' : '#fff7ed', color: '#9a3412', border: '1.5px solid #fed7aa', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700, cursor: relancing ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {relancing ? '⏳ Envoi en cours…' : '📧 Relance email générale'}
              </button>
              {relanceResult && (
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: relanceResult.errors?.length ? '#92400e' : '#15803d' }}>
                  {relanceResult.ok
                    ? `✅ ${relanceResult.sent} email${relanceResult.sent > 1 ? 's' : ''} envoyé${relanceResult.sent > 1 ? 's' : ''}${relanceResult.errors?.length ? ` · ⚠ ${relanceResult.errors.length} erreur(s)` : ''}`
                    : '❌ Erreur lors de l\'envoi'}
                </div>
              )}
            </div>
          )}
        </div>

        {avecSolde.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 700 }}>
            🎉 Tous les soldes sont réglés !
          </div>
        ) : (
          <div className="crm-solde-list">
            {avecSolde.map(i => {
              const solde = i.total - i.accompte
              const msg = soldeMessage(i.parent1_prenom, i.enfants, solde)
              return (
                <div key={i.id} className="crm-solde-row">
                  <div className="crm-solde-info">
                    <strong>{i.parent1_prenom} {i.parent1_nom}</strong>
                    <span className="td-sub">{i.enfants.map(e => e.prenom).join(', ')}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{i.telephone}</span>
                  </div>
                  <div className="crm-solde-amount">
                    <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.1rem' }}>{solde} €</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', background: STATUTS[i.statut]?.bg, color: STATUTS[i.statut]?.color, padding: '1px 8px', borderRadius: 100, fontWeight: 700 }}>
                      {STATUTS[i.statut]?.label}
                    </span>
                  </div>
                  <div className="crm-solde-actions">
                    <a
                      href={waLink(i.telephone, msg)}
                      target="_blank"
                      rel="noreferrer"
                      className="crm-btn-wa-full"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Envoyer rappel
                    </a>
                    <button className="crm-btn-copy-sm" onClick={() => copyMessage(i)}>
                      {copiedId === i.id ? '✅' : '📋'}
                    </button>
                    <a href={`tel:${i.telephone}`} className="crm-btn-tel">📞</a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Groupes WhatsApp */}
      <div className="crm-card">
        <div className="crm-card-title">Préparer les groupes WhatsApp</div>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Copiez les numéros d'une classe × semaine pour créer votre groupe WhatsApp directement depuis votre téléphone.
        </p>
        <div className="crm-groups-grid">
          {groupesSuggeres.map(g => {
            const key = `${g.classe}-${g.semaine.id}`
            const col = CLASSE_COLORS[g.classe]
            return (
              <div key={key} className="crm-group-card">
                <div className="crm-group-header" style={{ background: col.bg, color: col.color }}>
                  <strong>{g.classe}</strong>
                  <span>{g.semaine.label}</span>
                </div>
                <div className="crm-group-body">
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem' }}>
                    {g.families.length} famille{g.families.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.8 }}>
                    {g.families.map(f => (
                      <div key={f.id}>{f.parent1_prenom} {f.parent1_nom} · {f.telephone}</div>
                    ))}
                  </div>
                </div>
                <button
                  className="crm-btn-copy"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={() => copyGroupPhones(g)}
                >
                  {copiedGroup === key ? '✅ Numéros copiés !' : '📋 Copier les numéros'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Composant principal Admin ─────────────────────────────────────────────────
export default function Admin() {
  const saved = localStorage.getItem('admin_user')
    ? { user: localStorage.getItem('admin_user'), pwd: localStorage.getItem('admin_pwd'), remember: true }
    : sessionStorage.getItem('admin_user')
    ? { user: sessionStorage.getItem('admin_user'), pwd: sessionStorage.getItem('admin_pwd'), remember: false }
    : null

  const [user, setUser]         = useState(saved?.user || '')
  const [password, setPassword] = useState(saved?.pwd || '')
  const [showPwd, setShowPwd]   = useState(false)
  const [remember, setRemember] = useState(saved?.remember ?? true)
  const [role, setRole]         = useState(null)
  const [inscriptions, setInscriptions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshDone, setRefreshDone] = useState(false)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState('classes')

  const fetchInscriptions = async (u, pwd) => {
    if (!u || !pwd) return
    try {
      const res = await fetch('/api/admin/inscriptions', {
        headers: { 'x-admin-user': u, 'x-admin-password': pwd },
      })
      if (!res.ok) return
      const data = await res.json()
      setInscriptions(data)
    } catch {}
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshDone(false)
    await fetchInscriptions(user, password)
    setRefreshing(false)
    setRefreshDone(true)
    setTimeout(() => setRefreshDone(false), 2000)
  }

  // Re-fetch à chaque changement d'onglet
  const goToTab = (t) => {
    setTab(t)
    fetchInscriptions(user, password)
  }

  // Auto-login si identifiants sauvegardés
  useEffect(() => {
    if (saved?.user && saved?.pwd) doLogin(saved.user, saved.pwd, saved.remember)
  }, [])

  const doLogin = async (u, pwd, rem) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: u, password: pwd }),
      })
      if (res.status === 401) { setError('Identifiants incorrects'); setLoading(false); return }
      const { role: r } = await res.json()
      setRole(r)
      setUser(u)
      setPassword(pwd)
      if (rem) {
        localStorage.setItem('admin_user', u)
        localStorage.setItem('admin_pwd', pwd)
        sessionStorage.removeItem('admin_user')
        sessionStorage.removeItem('admin_pwd')
      } else {
        sessionStorage.setItem('admin_user', u)
        sessionStorage.setItem('admin_pwd', pwd)
        localStorage.removeItem('admin_user')
        localStorage.removeItem('admin_pwd')
      }
      setTab(r === 'admin' ? 'dashboard' : 'classes')
      await fetchInscriptions(u, pwd)
    } catch {
      setError('Erreur de connexion au serveur')
    }
    setLoading(false)
  }

  const handleLogin = (e) => { e.preventDefault(); doLogin(user, password, remember) }

  const handleStatutChange = async (id, statut) => {
    setInscriptions(prev => prev.map(i => i.id === id ? { ...i, statut } : i))
    await fetch(`/api/admin/inscriptions/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password },
      body: JSON.stringify({ statut }),
    })
    fetchInscriptions(user, password)
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_pwd')
    sessionStorage.removeItem('admin_user')
    sessionStorage.removeItem('admin_pwd')
    setRole(null)
    setUser('')
    setPassword('')
    setInscriptions([])
  }

  if (!role) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <span style={{ fontSize: '2rem' }}>✡</span>
            <h1>Administration</h1>
            <p>Gan Israel Beth Hillel</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label>Nom d'utilisateur</label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Nom d'utilisateur"
                required
                autoFocus={!saved}
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label>Mot de passe</label>
              <div className="crm-pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="crm-pwd-toggle" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <label className="crm-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Rester connecté
            </label>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '⏳ Connexion…' : '🔐 Se connecter'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const ALL_TABS = [
    { id: 'dashboard', label: '📊 Dashboard',                         roles: ['admin'] },
    { id: 'familles',  label: `👨‍👩‍👧 Familles (${inscriptions.length})`, roles: ['admin'] },
    { id: 'classes',   label: '🏫 Par classe',                        roles: ['admin', 'animatrice'] },
    { id: 'whatsapp',  label: '💬 WhatsApp & Soldes',                  roles: ['admin'] },
    { id: 'analytics', label: '📈 Trafic site',                        roles: ['admin'] },
    { id: 'visiteurs', label: '👥 Contacts',                           roles: ['admin'] },
  ]
  const TABS = ALL_TABS.filter(t => t.roles.includes(role))

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <span className="admin-topbar-logo">✡</span>
          <div>
            <div className="admin-topbar-title">CRM — Gan Israel Beth Hillel</div>
            <div className="admin-topbar-sub">
              {role === 'admin' ? '👑 Direction' : '🎨 Équipe animatrice'} · Été 2026
            </div>
          </div>
        </div>
        <div className="admin-topbar-right">
          {role === 'admin' && <button className="btn-csv" onClick={() => exportCSV(inscriptions)}>⬇ CSV</button>}
          <button className="btn-refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <span className="btn-refresh-spin">↻</span> : refreshDone ? '✓ Actualisé' : '↻ Actualiser'}
          </button>
          <button className="btn-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      <div className="crm-tabs-bar">
        {TABS.map(t => (
          <button key={t.id} className={`crm-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => goToTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-body">
        {tab === 'dashboard' && role === 'admin' && <TabDashboard inscriptions={inscriptions} />}
        {tab === 'familles'  && role === 'admin' && <TabFamilles
          inscriptions={inscriptions} user={user} password={password}
          onStatutChange={handleStatutChange}
          onInscriptionAdded={() => fetchInscriptions(user, password)}
          onInscriptionDeleted={(id) => setInscriptions(prev => prev.filter(i => i.id !== id))}
          onInscriptionUpdated={() => fetchInscriptions(user, password)}
        />}
        {tab === 'classes'   && <TabClasses inscriptions={inscriptions} />}
        {tab === 'whatsapp'  && role === 'admin' && <TabWhatsapp inscriptions={inscriptions} user={user} password={password} />}
        {tab === 'analytics' && role === 'admin' && <TabAnalytics user={user} password={password} />}
        {tab === 'visiteurs' && role === 'admin' && <TabVisiteurs user={user} password={password} />}
      </div>
    </div>
  )
}

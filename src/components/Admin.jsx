import { useState, useEffect, useMemo } from 'react'

const STATUTS = {
  en_attente:    { label: 'En attente',    color: '#f59e0b', bg: '#fef3c7' },
  accompte_paye: { label: 'Acompte payé',  color: '#2563eb', bg: '#dbeafe' },
  solde_paye:    { label: 'Soldé',         color: '#16a34a', bg: '#dcfce7' },
  annule:        { label: 'Annulé',        color: '#dc2626', bg: '#fee2e2' },
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

function exportCSV(inscriptions) {
  const headers = ['ID', 'Date', 'Parent 1', 'Parent 2', 'Email', 'Téléphone', 'Enfants', 'Classes', 'Semaines', 'Mode paiement', 'Total (€)', 'Acompte (€)', 'Solde (€)', 'Statut']
  const rows = inscriptions.map(i => [
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
    i.accompte,
    i.total - i.accompte,
    STATUTS[i.statut]?.label || i.statut,
  ])
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
function TabDashboard({ inscriptions }) {
  const totalEnfants = inscriptions.reduce((s, i) => s + i.enfants.length, 0)
  const totalRevenu = inscriptions.reduce((s, i) => s + i.total, 0)
  const totalAccomptes = inscriptions.reduce((s, i) => s + i.accompte, 0)
  const totalSoldes = totalRevenu - totalAccomptes
  const soldeEncaisse = inscriptions.filter(i => i.statut === 'solde_paye').reduce((s, i) => s + (i.total - i.accompte), 0)

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
          { label: 'Familles', value: inscriptions.length, icon: '👨‍👩‍👧' },
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

// ── Onglet Familles ───────────────────────────────────────────────────────────
function TabFamilles({ inscriptions, password, onStatutChange }) {
  const [filter, setFilter] = useState('tous')
  const [search, setSearch] = useState('')

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
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                <th>Paiement</th>
                <th>Total / Solde</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const solde = i.total - i.accompte
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
                      <div className="td-sub">{i.telephone}</div>
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
                      <span className={`badge-mode badge-${i.mode_paiement}`}>
                        {i.mode_paiement === 'cb' ? '💳 CB' : '💵 Espèces/Chèque'}
                      </span>
                    </td>
                    <td>
                      <div className="td-total">{i.total} €</div>
                      <div className="td-sub">Acompte : <span style={{ color: '#16a34a', fontWeight: 700 }}>{i.accompte} €</span></div>
                      {solde > 0 && <div className="td-solde">Solde : {solde} €</div>}
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
                  </tr>
                )
              })}
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
function TabWhatsapp({ inscriptions }) {
  const [copiedId, setCopiedId] = useState(null)

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
      {/* Rappels de solde */}
      <div className="crm-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="crm-card-title" style={{ margin: 0 }}>Soldes à encaisser</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{avecSolde.length} famille{avecSolde.length > 1 ? 's' : ''} — total restant : <strong style={{ color: '#dc2626' }}>{totalRestant} €</strong></div>
          </div>
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
  const [user, setUser]         = useState(localStorage.getItem('admin_user') || '')
  const [password, setPassword] = useState(localStorage.getItem('admin_pwd') || '')
  const [role, setRole]         = useState(null)
  const [inscriptions, setInscriptions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState('classes')

  const fetchInscriptions = async (u, pwd) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/inscriptions', {
        headers: { 'x-admin-user': u, 'x-admin-password': pwd },
      })
      if (res.status === 401) { setError('Identifiants incorrects'); setLoading(false); return }
      const data = await res.json()
      setInscriptions(data)
    } catch {
      setError('Erreur de connexion au serveur')
    }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      })
      if (res.status === 401) { setError('Identifiants incorrects'); setLoading(false); return }
      const { role: r } = await res.json()
      setRole(r)
      localStorage.setItem('admin_user', user)
      localStorage.setItem('admin_pwd', password)
      setTab(r === 'admin' ? 'dashboard' : 'classes')
      await fetchInscriptions(user, password)
    } catch {
      setError('Erreur de connexion au serveur')
    }
    setLoading(false)
  }

  const handleStatutChange = async (id, statut) => {
    await fetch(`/api/admin/inscriptions/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-user': user, 'x-admin-password': password },
      body: JSON.stringify({ statut }),
    })
    setInscriptions(prev => prev.map(i => i.id === id ? { ...i, statut } : i))
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_pwd')
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
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mot de passe"
                required
                autoComplete="current-password"
              />
            </div>
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
          <button className="btn-refresh" onClick={() => fetchInscriptions(user, password)}>↻ Actualiser</button>
          <button className="btn-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      <div className="crm-tabs-bar">
        {TABS.map(t => (
          <button key={t.id} className={`crm-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-body">
        {tab === 'dashboard' && role === 'admin' && <TabDashboard inscriptions={inscriptions} />}
        {tab === 'familles'  && role === 'admin' && <TabFamilles inscriptions={inscriptions} password={password} onStatutChange={handleStatutChange} />}
        {tab === 'classes'   && <TabClasses inscriptions={inscriptions} />}
        {tab === 'whatsapp'  && role === 'admin' && <TabWhatsapp inscriptions={inscriptions} />}
      </div>
    </div>
  )
}

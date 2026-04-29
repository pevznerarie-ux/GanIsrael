import { useState, useEffect } from 'react'

const STATUTS = {
  en_attente:    { label: 'En attente',    color: '#f59e0b', bg: '#fef3c7' },
  accompte_paye: { label: 'Accompte payé', color: '#2563eb', bg: '#dbeafe' },
  solde_paye:    { label: 'Soldé',         color: '#16a34a', bg: '#dcfce7' },
  annule:        { label: 'Annulé',        color: '#dc2626', bg: '#fee2e2' },
}

const SEMAINE_LABELS = { 1: 'S1', 2: 'S2', 3: 'S3' }
const priceFor = (n) => n === 3 ? 525 : n * 180

function exportCSV(inscriptions) {
  const headers = ['ID', 'Date', 'Parent 1', 'Parent 2', 'Email', 'Téléphone', 'Enfants', 'Classes', 'Semaines', 'Mode paiement', 'Total (€)', 'Accompte (€)', 'Solde (€)', 'Statut']
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

export default function Admin() {
  const [password, setPassword] = useState(localStorage.getItem('admin_pwd') || '')
  const [authed, setAuthed] = useState(false)
  const [inscriptions, setInscriptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('tous')

  const fetchInscriptions = async (pwd) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/inscriptions', {
        headers: { 'x-admin-password': pwd },
      })
      if (res.status === 401) { setError('Mot de passe incorrect'); setLoading(false); return }
      const data = await res.json()
      setInscriptions(data)
      setAuthed(true)
      localStorage.setItem('admin_pwd', pwd)
    } catch {
      setError('Erreur de connexion au serveur')
    }
    setLoading(false)
  }

  const handleLogin = (e) => {
    e.preventDefault()
    fetchInscriptions(password)
  }

  const handleStatut = async (id, statut) => {
    await fetch(`/api/admin/inscriptions/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ statut }),
    })
    setInscriptions(prev => prev.map(i => i.id === id ? { ...i, statut } : i))
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_pwd')
    setAuthed(false)
    setPassword('')
    setInscriptions([])
  }

  const filtered = filter === 'tous' ? inscriptions : inscriptions.filter(i => i.statut === filter)

  // Stats
  const totalEnfants = inscriptions.reduce((s, i) => s + i.enfants.length, 0)
  const totalRevenu = inscriptions.reduce((s, i) => s + i.total, 0)
  const totalAccomptes = inscriptions.reduce((s, i) => s + i.accompte, 0)

  if (!authed) {
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
              <label>Mot de passe admin</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mot de passe"
                required
                autoFocus
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

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <span className="admin-topbar-logo">✡</span>
          <div>
            <div className="admin-topbar-title">Administration</div>
            <div className="admin-topbar-sub">Gan Israel Beth Hillel — Été 2026</div>
          </div>
        </div>
        <div className="admin-topbar-right">
          <button className="btn-csv" onClick={() => exportCSV(filtered)}>
            ⬇ Exporter CSV
          </button>
          <button className="btn-refresh" onClick={() => fetchInscriptions(password)}>
            ↻ Actualiser
          </button>
          <button className="btn-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      <div className="admin-body">
        {/* Stats */}
        <div className="admin-stats">
          {[
            { label: 'Inscriptions', value: inscriptions.length, icon: '📋' },
            { label: 'Enfants', value: totalEnfants, icon: '👶' },
            { label: 'Revenus prévus', value: `${totalRevenu} €`, icon: '💰' },
            { label: 'Accomptes reçus', value: `${totalAccomptes} €`, icon: '✅' },
          ].map(s => (
            <div key={s.label} className="admin-stat-card">
              <div className="asc-icon">{s.icon}</div>
              <div className="asc-value">{s.value}</div>
              <div className="asc-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="admin-filters">
          {['tous', ...Object.keys(STATUTS)].map(f => (
            <button
              key={f}
              className={`admin-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'tous' ? `Tous (${inscriptions.length})` : `${STATUTS[f].label} (${inscriptions.filter(i => i.statut === f).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="admin-empty">Aucune inscription pour le moment.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Parents</th>
                  <th>Contact</th>
                  <th>Enfants</th>
                  <th>Paiement</th>
                  <th>Total / Solde</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
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
                      <a href={`mailto:${i.email}`} className="td-email">{i.email}</a>
                      <div className="td-sub">{i.telephone}</div>
                    </td>
                    <td>
                      {i.enfants.map((e, idx) => (
                        <div key={idx} className="td-enfant">
                          <strong>{e.prenom} {e.nom}</strong>
                          <span className="td-classe">{e.classe}</span>
                          <span className="td-semaines">{e.semaines.map(s => SEMAINE_LABELS[s]).join(' ')}</span>
                          <span className="td-prix">{priceFor(e.semaines.length)} €</span>
                        </div>
                      ))}
                      {i.allergies && <div className="td-allergie">⚠ {i.allergies}</div>}
                    </td>
                    <td>
                      <span className={`badge-mode badge-${i.mode_paiement}`}>
                        {i.mode_paiement === 'cb' ? '💳 CB' : '💵 Espèces / Chèque'}
                      </span>
                    </td>
                    <td>
                      <div className="td-total">{i.total} €</div>
                      <div className="td-solde">Solde : {i.total - i.accompte} €</div>
                    </td>
                    <td>
                      <select
                        className={`statut-select statut-${i.statut}`}
                        value={i.statut}
                        onChange={e => handleStatut(i.id, e.target.value)}
                        style={{ background: STATUTS[i.statut]?.bg, color: STATUTS[i.statut]?.color }}
                      >
                        {Object.entries(STATUTS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

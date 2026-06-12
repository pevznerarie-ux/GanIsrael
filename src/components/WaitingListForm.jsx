import { useState } from 'react'

const CLASSES  = ['Pre Gan', 'Gan 1', 'Gan 2', 'Gan 3']
const SEMAINES = [
  { id: 1, label: '6–10 juillet' },
  { id: 2, label: '13–17 juillet' },
  { id: 3, label: '20–24 juillet' },
]

export default function WaitingListForm() {
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', classes: [], semaines: [] })
  const [loading, setLoading]  = useState(false)
  const [success, setSuccess]  = useState(false)
  const [error, setError]      = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggle = (field, val) =>
    setForm(f => ({
      ...f,
      [field]: f[field].includes(val) ? f[field].filter(v => v !== val) : [...f[field], val],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.prenom || !form.nom || !form.email) { setError('Merci de remplir prénom, nom et email.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/liste-attente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur serveur') }
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <section id="inscription" style={{ padding: '48px 16px', maxWidth: 640, margin: '0 auto' }}>

      {/* Bannière fermé */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 32, textAlign: 'center', color: 'white',
        boxShadow: '0 8px 32px rgba(30,58,138,0.25)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>Inscriptions fermées</h2>
        <p style={{ margin: 0, fontSize: 15, color: '#bfdbfe', lineHeight: 1.6 }}>
          Les inscriptions pour l'été 2026 sont complètes.<br />
          Inscrivez-vous sur la liste d'attente — nous vous contacterons en priorité si une place se libère.
        </p>
      </div>

      {success ? (
        <div style={{
          background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 14,
          padding: '32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ color: '#14532d', margin: '0 0 10px', fontSize: 20 }}>Vous êtes sur la liste d'attente !</h3>
          <p style={{ color: '#166534', margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            Un email de confirmation vous a été envoyé.<br />
            Nous vous contacterons dès qu'une place se libère.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{
          background: 'white', borderRadius: 14, padding: '28px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ color: '#1e3a8a', margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>
            📋 S'inscrire sur la liste d'attente
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Prénom *</label>
              <input style={inputStyle} value={form.prenom} onChange={e => set('prenom', e.target.value)} placeholder="Prénom" required />
            </div>
            <div>
              <label style={labelStyle}>Nom *</label>
              <input style={inputStyle} value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom" required />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="votre@email.fr" required />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Téléphone</label>
            <input style={inputStyle} type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="06 00 00 00 00" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Classe(s) souhaitée(s)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {CLASSES.map(c => (
                <button type="button" key={c}
                  onClick={() => toggle('classes', c)}
                  style={chipStyle(form.classes.includes(c))}
                >{c}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Semaine(s) souhaitée(s)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {SEMAINES.map(s => (
                <button type="button" key={s.id}
                  onClick={() => toggle('semaines', s.id)}
                  style={chipStyle(form.semaines.includes(s.id))}
                >S{s.id} — {s.label}</button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? '#94a3b8' : '#1d4ed8',
            color: 'white', border: 'none', borderRadius: 10, padding: '14px 0',
            fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}>
            {loading ? '⏳ Envoi…' : "📋 M'inscrire sur la liste d'attente"}
          </button>
        </form>
      )}
    </section>
  )
}

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4,
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0',
  borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none',
  fontFamily: 'inherit', color: '#1e293b',
}

const chipStyle = (active) => ({
  background: active ? '#1d4ed8' : '#f1f5f9',
  color: active ? 'white' : '#475569',
  border: active ? '1.5px solid #1d4ed8' : '1.5px solid #e2e8f0',
  borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
})

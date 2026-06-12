import { useState, useEffect } from 'react'

const SEMAINE_LABELS = { 1: '6–10 juillet', 2: '13–17 juillet', 3: '20–24 juillet' }
const PRIX = { 'Pre Gan': 165, 'Gan 1': 180, 'Gan 2': 180, 'Gan 3': 180 }
const ACCOMPTE = 50

function calcTotal(classe, semaines) {
  const n = semaines.length
  if (n === 0) return 0
  if (n >= 3) return classe === 'Pre Gan' ? 480 : 525
  return (PRIX[classe] || 180) * n
}

export default function InscriptionReservee() {
  const token = new URLSearchParams(window.location.search).get('token')

  const [tokenData, setTokenData] = useState(null)
  const [pageError, setPageError]  = useState('')
  const [loading, setLoading]      = useState(true)

  const [form, setForm] = useState({
    enfantPrenom: '', enfantNom: '',
    parent1Prenom: '', parent1Nom: '',
    email: '', telephone: '',
    classe: '', semaines: [],
  })

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')

  useEffect(() => {
    if (!token) { setPageError('Lien invalide.'); setLoading(false); return }
    fetch(`/api/inscription-token/${token}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Lien invalide')
        setTokenData(d)
        setForm(f => ({
          ...f,
          parent1Prenom: d.prenom,
          parent1Nom:    d.nom,
          email:         d.email,
          telephone:     d.telephone || '',
          classe:        d.classes?.[0] || '',
          semaines:      d.semaines || [],
        }))
        setLoading(false)
      })
      .catch(err => { setPageError(err.message); setLoading(false) })
  }, [])

  const toggleSemaine = (sid) =>
    setForm(f => ({
      ...f,
      semaines: f.semaines.includes(sid) ? f.semaines.filter(s => s !== sid) : [...f.semaines, sid],
    }))

  const total    = calcTotal(form.classe, form.semaines)
  const solde    = total - ACCOMPTE
  const canPay   = form.enfantPrenom && form.enfantNom && form.classe && form.semaines.length > 0

  const handlePay = async (mode) => {
    if (!canPay) { setFormError('Merci de remplir tous les champs obligatoires.'); return }
    setFormError('')
    setSubmitting(true)

    const amount   = mode === 'cb' ? total : ACCOMPTE
    const accompte = mode === 'cb' ? total : ACCOMPTE

    const formData = {
      parent1Prenom: form.parent1Prenom,
      parent1Nom:    form.parent1Nom,
      parent2Prenom: '', parent2Nom: '',
      telephone: form.telephone,
      email:     form.email,
      modePaiement: mode === 'cb' ? 'cb' : 'especes_cheque',
      total,
      accompte,
      enfants: [{
        prenom:                 form.enfantPrenom,
        nom:                    form.enfantNom,
        dateNaissance:          '',
        classe:                 form.classe,
        semaines:               form.semaines,
        garderie:               [],
        allergiesAlimentaires:  '',
        traitementEnCours:      '',
        maladiesChroniques:     '',
        vaccinsAJour:           false,
        autorisationSoins:      true,
        autorisationTransport:  false,
      }],
    }

    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          itemName: `Gan Israel — ${form.enfantPrenom} ${form.enfantNom}`,
          returnUrl: `${window.location.origin}?merci=1`,
          backUrl:   window.location.href,
          formData,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      window.location.href = data.url
    } catch (err) {
      setFormError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748b', fontSize: 16 }}>
      Chargement…
    </div>
  )

  if (pageError) return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Lien invalide</h2>
      <p style={{ color: '#64748b' }}>{pageError}</p>
    </div>
  )

  const availableClasses  = tokenData?.classes  || []
  const availableSemaines = tokenData?.semaines || []

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px 80px' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 28,
        textAlign: 'center', color: 'white',
        boxShadow: '0 8px 32px rgba(21,128,61,0.25)',
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Une place est disponible !</h2>
        <p style={{ margin: 0, fontSize: 15, color: '#bbf7d0', lineHeight: 1.6 }}>
          Bonjour <strong>{tokenData.prenom} {tokenData.nom}</strong>, finalisez votre inscription ci-dessous.
        </p>
      </div>

      <div style={{
        background: 'white', borderRadius: 14, padding: 28,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0',
      }}>

        {/* Enfant */}
        <h3 style={{ color: '#1e3a8a', margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>👶 Informations enfant</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelSt}>Prénom *</label>
            <input style={inputSt} value={form.enfantPrenom} onChange={e => setForm(f => ({ ...f, enfantPrenom: e.target.value }))} placeholder="Prénom de l'enfant" />
          </div>
          <div>
            <label style={labelSt}>Nom *</label>
            <input style={inputSt} value={form.enfantNom} onChange={e => setForm(f => ({ ...f, enfantNom: e.target.value }))} placeholder="Nom de l'enfant" />
          </div>
        </div>

        {/* Classe */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Classe *</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {availableClasses.map(c => (
              <button type="button" key={c}
                onClick={() => setForm(f => ({ ...f, classe: c }))}
                style={chipSt(form.classe === c)}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Semaines */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelSt}>Semaine(s) *</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {availableSemaines.map(sid => (
              <button type="button" key={sid}
                onClick={() => toggleSemaine(sid)}
                style={chipSt(form.semaines.includes(sid))}
              >S{sid} — {SEMAINE_LABELS[sid]}</button>
            ))}
          </div>
        </div>

        {/* Parent */}
        <h3 style={{ color: '#1e3a8a', margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>👤 Coordonnées parent</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelSt}>Prénom</label>
            <input style={inputSt} value={form.parent1Prenom} onChange={e => setForm(f => ({ ...f, parent1Prenom: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt}>Nom</label>
            <input style={inputSt} value={form.parent1Nom} onChange={e => setForm(f => ({ ...f, parent1Nom: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          <div>
            <label style={labelSt}>Email</label>
            <input style={inputSt} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt}>Téléphone</label>
            <input style={inputSt} type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
          </div>
        </div>

        {/* Récapitulatif prix */}
        {total > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 8, fontSize: 15 }}>Récapitulatif</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#475569', marginBottom: 4 }}>
              <span>{form.semaines.length} semaine{form.semaines.length > 1 ? 's' : ''} · {form.classe}</span>
              <span style={{ fontWeight: 700 }}>{total} €</span>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
              <span>Acompte à payer maintenant</span>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>{ACCOMPTE} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
              <span>Solde à régler en espèces / chèque</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{solde} €</span>
            </div>
          </div>
        )}

        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
            {formError}
          </div>
        )}

        {/* Boutons paiement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            disabled={submitting || !canPay}
            onClick={() => handlePay('especes_cheque')}
            style={{
              background: (submitting || !canPay) ? '#e2e8f0' : '#1d4ed8',
              color: (submitting || !canPay) ? '#94a3b8' : 'white',
              border: 'none', borderRadius: 10, padding: '15px 20px',
              fontSize: 15, fontWeight: 700, cursor: (submitting || !canPay) ? 'not-allowed' : 'pointer',
              textAlign: 'left', lineHeight: 1.4,
            }}
          >
            <div>💳 Payer l'acompte ({ACCOMPTE} €) via HelloAsso</div>
            {total > 0 && <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>+ solde de {solde} € en espèces ou chèque à remettre sur place</div>}
          </button>

          <button
            disabled={submitting || !canPay}
            onClick={() => handlePay('cb')}
            style={{
              background: (submitting || !canPay) ? '#e2e8f0' : '#16a34a',
              color: (submitting || !canPay) ? '#94a3b8' : 'white',
              border: 'none', borderRadius: 10, padding: '15px 20px',
              fontSize: 15, fontWeight: 700, cursor: (submitting || !canPay) ? 'not-allowed' : 'pointer',
            }}
          >
            {total > 0 ? `✅ Payer la totalité (${total} €) via HelloAsso` : '✅ Payer via HelloAsso'}
          </button>
        </div>

      </div>
    </div>
  )
}

const labelSt = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }

const inputSt = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0',
  borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none',
  fontFamily: 'inherit', color: '#1e293b',
}

const chipSt = (active) => ({
  background: active ? '#1d4ed8' : '#f1f5f9',
  color: active ? 'white' : '#475569',
  border: active ? '1.5px solid #1d4ed8' : '1.5px solid #e2e8f0',
  borderRadius: 20, padding: '7px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
})

import { useState } from 'react'

const SEMAINES = [
  { id: 1, label: 'Semaine 1', dates: '6 – 10 juil.' },
  { id: 2, label: 'Semaine 2', dates: '13 – 17 juil.' },
  { id: 3, label: 'Semaine 3', dates: '20 – 24 juil.' },
]
const CLASSES = ['Pre Gan', 'Gan 1', 'Gan 2', 'Gan 3']

const INIT_CHILD = {
  prenom: '', nom: '', dateNaissance: '', classe: '', semaines: [], garderie: [],
  allergiesAlimentaires: '',
  traitementEnCours: '',
  maladiesChroniques: '',
  vaccinsAJour: false,
  autorisationSoins: false,
  autorisationTransport: false,
}

const INIT = {
  enfants: [{ ...INIT_CHILD }],
  parent1Prenom: '', parent1Nom: '',
  parent2Prenom: '', parent2Nom: '',
  telephone: '', email: '',
  modePaiement: '',
  autorisation: false,
}

const isPregan = (classe) => classe === 'Pre Gan'
const weeklyRate = (classe) => isPregan(classe) ? 165 : 180
const basePrice = (n, classe) => n === 3 ? (isPregan(classe) ? 480 : 525) : n * weeklyRate(classe)
const garderiePrice = (garderie) => (garderie?.length || 0) * 20
const totalForChild = (child) => basePrice(child.semaines.length, child.classe) + garderiePrice(child.garderie)

export default function InscriptionForm() {
  const [form, setForm] = useState(INIT)
  const [status, setStatus] = useState('idle')

  const handleGlobal = (e) => {
    const { name, value, type, checked } = e.target
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
  }

  const updateChild = (idx, field, value) =>
    setForm(p => ({
      ...p,
      enfants: p.enfants.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }))

  const toggleSemaine = (idx, sid) =>
    setForm(p => ({
      ...p,
      enfants: p.enfants.map((c, i) => {
        if (i !== idx) return c
        const semaines = c.semaines.includes(sid)
          ? c.semaines.filter(s => s !== sid)
          : [...c.semaines, sid]
        // retirer la garderie si la semaine est décochée
        const garderie = c.garderie.filter(g => semaines.includes(g))
        return { ...c, semaines, garderie }
      }),
    }))

  const toggleGarderie = (idx, sid) =>
    setForm(p => ({
      ...p,
      enfants: p.enfants.map((c, i) => {
        if (i !== idx) return c
        const garderie = c.garderie.includes(sid)
          ? c.garderie.filter(g => g !== sid)
          : [...c.garderie, sid]
        return { ...c, garderie }
      }),
    }))

  const addChild = () =>
    setForm(p => ({ ...p, enfants: [...p.enfants, { ...INIT_CHILD }] }))

  const removeChild = (idx) =>
    setForm(p => ({ ...p, enfants: p.enfants.filter((_, i) => i !== idx) }))

  const total = form.enfants.reduce((s, c) => s + totalForChild(c), 0)
  const deposit = form.enfants.length * 50
  const amountHA = form.modePaiement === 'cb' ? total : deposit

  const canSubmit =
    form.parent1Prenom.trim() !== '' &&
    form.parent1Nom.trim() !== '' &&
    form.telephone.trim() !== '' &&
    form.email.trim() !== '' &&
    form.enfants.every(c => c.prenom.trim() !== '' && c.nom.trim() !== '' && c.dateNaissance !== '' && c.classe !== '') &&
    form.enfants.every(c => c.semaines.length > 0) &&
    form.enfants.every(c => c.vaccinsAJour && c.autorisationSoins && c.autorisationTransport) &&
    form.modePaiement !== '' &&
    total > 0 &&
    form.autorisation &&
    status !== 'loading'

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.enfants.some(c => c.semaines.length === 0)) {
      alert('Veuillez sélectionner au moins une semaine pour chaque enfant.')
      return
    }

    setStatus('loading')

    try {
      // 1. Enregistrement via Formspree (optionnel si ID non configuré)
      const fspId = import.meta.env.VITE_FORMSPREE_ID
      const record = {
        'Mode de paiement': form.modePaiement,
        'Parent 1': `${form.parent1Prenom} ${form.parent1Nom}`,
        'Parent 2': form.parent2Prenom ? `${form.parent2Prenom} ${form.parent2Nom}` : '—',
        'Téléphone': form.telephone,
        'Email': form.email,
        'Allergies': form.allergies || '—',
        'Total': `${total} €`,
        'Accompte HelloAsso': `${deposit} €`,
      }
      form.enfants.forEach((c, i) => {
        record[`Enfant ${i + 1}`] = `${c.prenom} ${c.nom}`
        record[`Enfant ${i + 1} — Naissance`] = c.dateNaissance
        record[`Enfant ${i + 1} — Classe`] = c.classe
        record[`Enfant ${i + 1} — Semaines`] = c.semaines.map(s => `Semaine ${s}`).join(', ')
        record[`Enfant ${i + 1} — Garderie`] = c.garderie.length > 0 ? c.garderie.map(s => `S${s}`).join(', ') : '—'
        record[`Enfant ${i + 1} — Prix`] = `${totalForChild(c)} €`
      })

      if (fspId && fspId !== 'YOUR_FORM_ID') {
        const fspRes = await fetch(`https://formspree.io/f/${fspId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(record),
        })
        if (!fspRes.ok) console.warn('Formspree: enregistrement échoué')
      }

      // 2. Création du checkout HelloAsso
      const childrenNames = form.enfants.map(c => `${c.prenom} ${c.nom}`).join(', ')
      const itemName = form.modePaiement === 'cb'
        ? `Inscription centre aéré — ${childrenNames}`
        : `Accompte inscription centre aéré — ${childrenNames}`

      const haRes = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountHA,
          itemName,
          returnUrl: `${window.location.origin}?merci=1`,
          backUrl: window.location.href,
          formData: {
            parent1Prenom: form.parent1Prenom,
            parent1Nom: form.parent1Nom,
            parent2Prenom: form.parent2Prenom,
            parent2Nom: form.parent2Nom,
            telephone: form.telephone,
            email: form.email,
            modePaiement: form.modePaiement,
            total,
            accompte: deposit,
            enfants: form.enfants,
          },
        }),
      })

      if (!haRes.ok) throw new Error('Erreur HelloAsso')
      const { url } = await haRes.json()

      // 3. Redirection vers HelloAsso
      window.location.href = url

    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <section className="form-section" id="inscription">
      <h2 className="form-title">Formulaire d'inscription</h2>
      <p className="form-subtitle">Remplissez le formulaire pour inscrire votre(vos) enfant(s).</p>

      <div className="form-card">
        <form onSubmit={handleSubmit} noValidate>

          {/* Parents */}
          <div className="form-group-title">👨‍👩‍👧 Parents</div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="p1p">Prénom — Parent 1 *</label>
              <input id="p1p" name="parent1Prenom" type="text" required
                value={form.parent1Prenom} onChange={handleGlobal} placeholder="Prénom" />
            </div>
            <div className="form-field">
              <label htmlFor="p1n">Nom — Parent 1 *</label>
              <input id="p1n" name="parent1Nom" type="text" required
                value={form.parent1Nom} onChange={handleGlobal} placeholder="Nom" />
            </div>
            <div className="form-field">
              <label htmlFor="p2p">Prénom — Parent 2</label>
              <input id="p2p" name="parent2Prenom" type="text"
                value={form.parent2Prenom} onChange={handleGlobal} placeholder="Prénom (optionnel)" />
            </div>
            <div className="form-field">
              <label htmlFor="p2n">Nom — Parent 2</label>
              <input id="p2n" name="parent2Nom" type="text"
                value={form.parent2Nom} onChange={handleGlobal} placeholder="Nom (optionnel)" />
            </div>
          </div>

          {/* Contact */}
          <div className="form-group-title">📞 Contact</div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="telephone">Téléphone *</label>
              <input id="telephone" name="telephone" type="tel" required
                value={form.telephone} onChange={handleGlobal} placeholder="06 00 00 00 00" />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email *</label>
              <input id="email" name="email" type="email" required
                value={form.email} onChange={handleGlobal} placeholder="votre@email.com" />
            </div>
          </div>

          {/* Enfants */}
          <div className="form-group-title">👶 Enfants</div>

          {form.enfants.map((child, idx) => (
            <div key={idx} className="child-card">
              <div className="child-card-header">
                <span className="child-card-title">
                  🧒 Enfant {idx + 1}
                  {child.prenom && child.nom && ` — ${child.prenom} ${child.nom}`}
                  {child.semaines.length > 0 && (
                    <span className="child-price-badge">
                      {totalForChild(child)} €
                    </span>
                  )}
                </span>
                {form.enfants.length > 1 && (
                  <button type="button" className="btn-remove-child" onClick={() => removeChild(idx)}>
                    ✕
                  </button>
                )}
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>Prénom *</label>
                  <input type="text" required value={child.prenom}
                    onChange={e => updateChild(idx, 'prenom', e.target.value)}
                    placeholder="Prénom de l'enfant" />
                </div>
                <div className="form-field">
                  <label>Nom *</label>
                  <input type="text" required value={child.nom}
                    onChange={e => updateChild(idx, 'nom', e.target.value)}
                    placeholder="Nom de famille" />
                </div>
                <div className="form-field">
                  <label>Date de naissance *</label>
                  <input type="date" required value={child.dateNaissance}
                    onChange={e => updateChild(idx, 'dateNaissance', e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Classe *</label>
                  <select required value={child.classe}
                    onChange={e => updateChild(idx, 'classe', e.target.value)}>
                    <option value="">Sélectionner</option>
                    {CLASSES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="semaines-label">Semaines souhaitées *</div>
              <div className="semaines-grid">
                {SEMAINES.map(s => (
                  <div key={s.id} className="semaine-block">
                    <label className={`semaine-check ${child.semaines.includes(s.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={child.semaines.includes(s.id)}
                        onChange={() => toggleSemaine(idx, s.id)} />
                      <span className="sc-label">{s.label}</span>
                      <span className="sc-dates">{s.dates}</span>
                      <span className="sc-price">{weeklyRate(child.classe)} €</span>
                    </label>
                    {child.semaines.includes(s.id) && (
                      <label className={`garderie-check ${child.garderie.includes(s.id) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={child.garderie.includes(s.id)}
                          onChange={() => toggleGarderie(idx, s.id)} />
                        <span className="gc-tick">{child.garderie.includes(s.id) ? '✓' : ''}</span>
                        <span className="gc-icon">🌅</span>
                        <span className="gc-label">Garderie <span className="gc-time">17h–18h</span></span>
                        <span className="gc-price">+20 €</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {child.semaines.length === 3 && (
                <div className="package-note">
                  🎉 Offre 3 semaines appliquée : {isPregan(child.classe) ? '480 € au lieu de 495 €' : '525 € au lieu de 540 €'}
                </div>
              )}
            </div>
          ))}

          <button type="button" className="btn-add-child" onClick={addChild}>
            + Ajouter un enfant
          </button>

          {/* Fiches sanitaires — une par enfant */}
          {form.enfants.map((child, idx) => {
            const childName = [child.prenom, child.nom].filter(Boolean).join(' ')
            const titleSuffix = childName
              ? ` — ${childName}`
              : form.enfants.length > 1 ? ` — Enfant ${idx + 1}` : ''
            return (
              <div key={idx}>
                <div className="form-group-title">🏥 Fiche Sanitaire{titleSuffix}</div>
                <div className="sante-card">
                  <div className="form-group-subtitle">Allergies alimentaires</div>
                  <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <input type="text"
                      value={child.allergiesAlimentaires}
                      onChange={e => updateChild(idx, 'allergiesAlimentaires', e.target.value)}
                      placeholder="Ex : arachides, gluten, lactose… (laisser vide si aucune)" />
                  </div>

                  <div className="form-group-subtitle">Traitements & Maladies</div>
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div className="form-field">
                      <label>Traitement médical en cours</label>
                      <textarea
                        value={child.traitementEnCours}
                        onChange={e => updateChild(idx, 'traitementEnCours', e.target.value)}
                        placeholder="Médicament, dosage, fréquence…"
                        style={{ minHeight: '70px' }} />
                    </div>
                    <div className="form-field">
                      <label>Maladies chroniques / Antécédents</label>
                      <textarea
                        value={child.maladiesChroniques}
                        onChange={e => updateChild(idx, 'maladiesChroniques', e.target.value)}
                        placeholder="Asthme, diabète, épilepsie…"
                        style={{ minHeight: '70px' }} />
                    </div>
                  </div>

                  <div className="form-group-subtitle">Autorisations *</div>
                  <div className="sante-check-row">
                    <label className="sante-check-label">
                      <input type="checkbox" required
                        checked={child.vaccinsAJour}
                        onChange={e => updateChild(idx, 'vaccinsAJour', e.target.checked)} />
                      Je certifie que les vaccinations de {child.prenom || 'cet enfant'} sont à jour.
                    </label>
                  </div>
                  <div className="sante-check-row">
                    <label className="sante-check-label">
                      <input type="checkbox" required
                        checked={child.autorisationSoins}
                        onChange={e => updateChild(idx, 'autorisationSoins', e.target.checked)} />
                      J'autorise le personnel du centre à administrer les premiers soins en cas d'urgence.
                    </label>
                  </div>
                  <div className="sante-check-row">
                    <label className="sante-check-label">
                      <input type="checkbox" required
                        checked={child.autorisationTransport}
                        onChange={e => updateChild(idx, 'autorisationTransport', e.target.checked)} />
                      J'autorise le transport de {child.prenom || 'mon enfant'} par ambulance ou tout véhicule de secours si nécessaire.
                    </label>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Récapitulatif */}
          {total > 0 && (
            <div className="price-summary">
              <div className="price-summary-title">📊 Récapitulatif</div>
              {form.enfants.map((c, i) => c.semaines.length > 0 && (
                <div key={i} className="price-row">
                  <span>
                    {c.prenom || `Enfant ${i + 1}`} — {c.semaines.length} sem.
                    {c.semaines.length === 3 && ' (offre)'}
                    {c.garderie.length > 0 && ` + garderie ×${c.garderie.length}`}
                  </span>
                  <span>{totalForChild(c)} €</span>
                </div>
              ))}
              <div className="price-total">
                <span>Total</span>
                <span>{total} €</span>
              </div>
              <div className="price-deposit">
                <span>Accompte ({form.enfants.length} enfant{form.enfants.length > 1 ? 's' : ''})</span>
                <span>{deposit} €</span>
              </div>
            </div>
          )}

          {/* Mode de paiement */}
          <div className="form-group-title">💳 Mode de paiement</div>
          <div className="payment-modes">
            {[
              { id: 'especes_cheque', icon: '💵📝', label: 'Espèces / Chèque', desc: `Accompte ${deposit} €` },
              { id: 'cb', icon: '💳', label: 'Carte bancaire', desc: total > 0 ? `Total ${total} €` : 'Paiement total en ligne' },
            ].map(m => (
              <label key={m.id}
                className={`payment-mode-card ${form.modePaiement === m.id ? 'selected' : ''}`}>
                <input type="radio" name="modePaiement" value={m.id}
                  checked={form.modePaiement === m.id} onChange={handleGlobal} />
                <span className="pm-icon">{m.icon}</span>
                <span className="pm-label">{m.label}</span>
                <span className="pm-desc">{m.desc}</span>
              </label>
            ))}
          </div>

          {form.modePaiement && total > 0 && (
            <div className="helloasso-note">
              {form.modePaiement === 'cb'
                ? `Total à régler : ${total} €.`
                : <>
                    Accompte à régler : <strong>{deposit} €</strong>. Le solde de <strong>{total - deposit} €</strong> est à remettre en espèces ou par chèque à <strong>Mora Elodie</strong> avant le <strong>15 juin</strong> au plus tard.
                  </>}
            </div>
          )}

          {/* Autorisation */}
          <div className="form-checkbox">
            <input id="autorisation" name="autorisation" type="checkbox" required
              checked={form.autorisation} onChange={handleGlobal} />
            <label htmlFor="autorisation">
              J'autorise mon/mes enfant(s) à participer aux activités du centre aéré Gan Israel
              Beth Hillel du 6 au 24 juillet 2026 et certifie l'exactitude des informations
              fournies. *
            </label>
          </div>

          {status === 'error' && (
            <div className="error-msg">
              Une erreur est survenue. Veuillez réessayer ou nous contacter à{' '}
              <a href="mailto:ganisrael@bethmenahem-lis.com">ganisrael@bethmenahem-lis.com</a>.
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={!canSubmit}>
            {status === 'loading'
              ? '⏳ Redirection en cours…'
              : form.modePaiement === 'cb' && total > 0
              ? `💳 Payer ${total} €`
              : form.modePaiement === 'especes_cheque' && total > 0
              ? `🔗 Régler l'accompte — ${deposit} €`
              : 'Compléter le formulaire pour continuer'}
          </button>
          {form.modePaiement && total > 0 && (
            <p className="helloasso-redirect-note">
              🔒 Vous serez redirigé vers HelloAsso pour un paiement sécurisé.
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

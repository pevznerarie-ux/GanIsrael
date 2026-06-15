const CLASSES = ['Pre Gan', 'Gan 1', 'Gan 2', 'Gan 3']

export default function Hero({ open = false }) {
  return (
    <>
      <section className="hero">
        {/* Étoiles flottantes décoratives */}
        <div className="hero-stars">
          {[...Array(12)].map((_, i) => (
            <span key={i} className={`star star-${i + 1}`}>✦</span>
          ))}
        </div>

        <div className="hero-inner">
          <div className="hero-logo-wrap">
            <div className="hero-logo-ring" />
            <img src="/logo-gan-israel.jpeg" alt="Gan Israel Beth Hillel" className="hero-logo" />
          </div>

          <div className="hero-content">
            <div className="hero-badge">🌟 Été 2026</div>
            <h1 className="hero-title">
              <span className="hero-title-line">Un été inoubliable</span>
              <span className="hero-title-brand">Gan Israel !</span>
            </h1>
            <p className="hero-desc">
              Centre Aéré Maternelle — activités, jeux et valeurs juives<br />
              dans une ambiance chaleureuse et bienveillante.
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 16,
              backdropFilter: 'blur(8px)',
            }}>
              {open ? (
                <>
                  <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 16, color: 'white' }}>
                    ✅ Les inscriptions sont ouvertes.
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    Remplissez le formulaire ci-dessous pour inscrire votre/vos enfant(s). Votre demande sera validée par la direction.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 16, color: 'white' }}>
                    🔒 Les inscriptions pour l'été 2026 sont fermées.
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    Toutes les places sont pourvues. Vous pouvez vous inscrire sur la liste d'attente — nous vous contacterons en priorité si une place se libère.
                  </p>
                </>
              )}
            </div>

            <a href="#inscription" className="hero-cta">
              {open ? '📋 S\'inscrire maintenant' : '📋 Rejoindre la liste d\'attente'}
            </a>
          </div>
        </div>

        <div className="hero-cards">
          {[
            { icon: '📅', label: 'Dates', value: '6 – 24 Juillet 2026' },
            { icon: '👶', label: 'Niveau', value: 'Maternelle uniquement' },
            { icon: '📍', label: 'Adresse', value: '89 rue Carnot, Levallois' },
          ].map((c, i) => (
            <div key={i} className="hero-card" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
              <div className="hero-card-icon">{c.icon}</div>
              <div className="hero-card-label">{c.label}</div>
              <div className="hero-card-value">{c.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="classes-section">
        <div className="classes-inner">
          <div className="classes-title">Classes disponibles</div>
          <div className="classes-badges">
            {CLASSES.map(c => (
              <span key={c} className="class-badge">{c}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

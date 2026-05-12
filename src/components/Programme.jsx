import { useReveal } from '../hooks/useReveal'

export default function Programme() {
  const headerRef = useReveal()
  const contentRef = useReveal(0.1)

  return (
    <section className="programme-section">
      <div className="programme-inner">
        <div className="programme-header reveal" ref={headerRef}>
          <span className="programme-eyebrow">📋 Informations pratiques</span>
          <h2 className="programme-title">Horaires & Programme</h2>
        </div>

        <div className="programme-grid reveal" ref={contentRef}>
          {/* Horaires */}
          <div className="programme-card">
            <div className="programme-card-icon">🕘</div>
            <h3 className="programme-card-title">Horaires</h3>
            <ul className="programme-horaires">
              <li>
                <span className="horaire-label">Accueil</span>
                <span className="horaire-value">8h30 – 9h00 <em>(maximum)</em></span>
              </li>
              <li>
                <span className="horaire-label">Début de journée</span>
                <span className="horaire-value">9h00</span>
              </li>
              <li>
                <span className="horaire-label">Heure de sortie</span>
                <span className="horaire-value">16h45</span>
              </li>
            </ul>
          </div>

          {/* Programme */}
          <div className="programme-card programme-card-wide">
            <div className="programme-card-icon">🎨</div>
            <h3 className="programme-card-title">Programme</h3>
            <p className="programme-text">
              Un programme très enrichissant se prépare pour assurer un mois inoubliable à vos enfants.
            </p>
            <p className="programme-text">
              La journée au Gan Israel commence à 9h00 avec la Tefila du matin et un goûter
              (nous privilégierons des fruits délicieux avec du sucre naturel !), des activités et
              des ateliers pour remplir la journée de créativité. Dans la mesure du possible, les
              enfants sortiront au Parc de la Planchette les jours où ils ne prennent pas le bus.
            </p>

            <div className="programme-sorties">
              <div className="sortie-block sortie-gan">
                <div className="sortie-icon">🚌</div>
                <div>
                  <strong>Gan — Sorties en autocar</strong>
                  <p>2 sorties en autocar prévues chaque semaine.</p>
                  <p className="sortie-lieux">Parc d'Hérouval · Winnoland · Royaume des Enfants · Kids Palace · Jardin d'Acclimatation · Parc Chanteraine</p>
                </div>
              </div>
              <div className="sortie-block sortie-pregan">
                <div className="sortie-icon">🌳</div>
                <div>
                  <strong>Pré-Gan — Sorties</strong>
                  <p>Pas de sorties en autocar prévues pour le Pré-Gan.</p>
                </div>
              </div>
            </div>

            <div className="programme-detail-note">
              📅 Un programme détaillé sera publié — avec l'aide de D. — <strong>le 8 Juin 2026</strong>.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

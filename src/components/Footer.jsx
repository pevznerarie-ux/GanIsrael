export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-gan">
          <img src="/logo-gan-israel.jpeg" alt="Gan Israel" className="footer-logo-gan" />
          <div>
            <div className="footer-name">Gan Israel Beth Hillel</div>
            <div className="footer-info">
              <div>📍 89 rue Carnot — 92300 Levallois-Perret</div>
              <div>✉️ <a href="mailto:ganisrael@bethmenahem-lis.com">ganisrael@bethmenahem-lis.com</a></div>
            </div>
          </div>
        </div>

        <div className="footer-divider" />

        <div className="footer-sinai">
          <img src="/logo-sinai.png" alt="Les Institutions Sinaï" className="footer-logo-sinai" />
          <p className="footer-sinai-text">
            Le Gan Israel Beth Hillel est un projet des <strong>Institutions Sinaï</strong>,
            réseau d'éducation juive engagé pour l'excellence scolaire et les valeurs de la Torah.
          </p>
        </div>

        <div className="footer-copy">© 2026 Gan Israel Beth Hillel — Un projet des Institutions Sinaï</div>
      </div>
    </footer>
  )
}

export default function ThankYou() {
  return (
    <div className="thankyou-page">
      <div className="aurora-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      <div className="thankyou-card">
        <div className="thankyou-icon">🎉</div>
        <h1 className="thankyou-title">Inscription confirmée !</h1>
        <p className="thankyou-sub">
          Bienvenue au <strong>Gan Israel Beth Hillel</strong> !<br />
          Un email de confirmation vous a été envoyé.
        </p>
        <div className="thankyou-details">
          <div className="thankyou-detail-item">📅 Du 6 au 24 juillet 2026</div>
          <div className="thankyou-detail-item">📍 89 rue Carnot, Levallois-Perret</div>
          <div className="thankyou-detail-item">✉️ ganisrael@bethmenahem-lis.com</div>
        </div>
        <a href="/" className="thankyou-btn">
          ➕ Inscrire encore un enfant
        </a>
      </div>
    </div>
  )
}

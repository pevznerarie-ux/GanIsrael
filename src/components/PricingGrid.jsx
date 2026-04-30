import { useRef, useEffect } from 'react'
import { useReveal } from '../hooks/useReveal'

function Card3D({ children, className }) {
  const ref = useRef(null)

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const ry = ((x - cx) / cx) * 16
    const rx = -((y - cy) / cy) * 12
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-12px) scale(1.04)`
    el.style.setProperty('--light-x', `${(x / rect.width) * 100}%`)
    el.style.setProperty('--light-y', `${(y / rect.height) * 100}%`)
  }

  const onLeave = (e) => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
    el.style.transform = el.classList.contains('featured-card')
      ? 'perspective(900px) scale(1.05)'
      : ''
    setTimeout(() => { if (el) el.style.transition = '' }, 500)
  }

  return (
    <div ref={ref} className={`pricing-card ${className}`}
      onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="card-shine" />
      {children}
    </div>
  )
}

export default function PricingGrid() {
  const headerRef = useReveal()
  const cardsRef = useReveal(0.1)
  const notesRef = useReveal(0.1)

  return (
    <section className="pricing-section">
      <div className="pricing-wave-top" />
      <div className="pricing-inner">
        <div className="pricing-header reveal" ref={headerRef}>
          <span className="pricing-eyebrow">💰 Tarifs</span>
          <h2 className="pricing-title">Simple et transparent</h2>
          <p className="pricing-sub">Centre Aéré Maternelle — Été 2026</p>
        </div>

        <div className="pricing-cards reveal" ref={cardsRef}>
          {/* DOM order: S1, S2, S3 — CSS met S3 au milieu sur desktop */}
          <Card3D className="clay-blue pc-order-1">
            <div className="pc-weeks-num">1</div>
            <div className="pc-weeks-label">Semaine</div>
            <div className="pc-price-wrap"><span className="pc-amount">180</span><span className="pc-cur">€</span></div>
            <div className="pc-per">par enfant</div>
            <div className="pc-pregan">Pré-Gan : 165 €</div>
          </Card3D>

          <Card3D className="clay-indigo pc-order-3">
            <div className="pc-weeks-num">2</div>
            <div className="pc-weeks-label">Semaines</div>
            <div className="pc-price-wrap"><span className="pc-amount">360</span><span className="pc-cur">€</span></div>
            <div className="pc-per">par enfant</div>
            <div className="pc-pregan">Pré-Gan : 330 €</div>
          </Card3D>

          <Card3D className="clay-gold featured-card pc-order-2">
            <div className="pc-ribbon">⭐ Meilleure offre</div>
            <div className="pc-weeks-num">3</div>
            <div className="pc-weeks-label">Semaines</div>
            <div className="pc-saving">🎉 Économisez 15 €</div>
            <div className="pc-price-wrap"><span className="pc-amount">525</span><span className="pc-cur">€</span></div>
            <div className="pc-per">par enfant</div>
            <div className="pc-pregan">Pré-Gan : 480 €</div>
          </Card3D>
        </div>

        <div className="pricing-notes reveal" ref={notesRef}>
          <div className="pricing-note note-blue">
            <span className="note-icon">🔐</span>
            <div>
              <strong>Accompte obligatoire : 50 € par enfant</strong><br />
              <span>Payable en ligne via HelloAsso — quel que soit le mode de paiement.</span>
            </div>
          </div>
          <div className="pricing-note note-gold">
            <span className="note-icon">🌅</span>
            <div>
              <strong>Option Garderie : +20 € / semaine</strong><br />
              <span>À sélectionner pour chaque semaine dans le formulaire.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="pricing-wave-bottom" />
    </section>
  )
}

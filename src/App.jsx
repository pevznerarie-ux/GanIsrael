import { useEffect } from 'react'
import './App.css'
import Header from './components/Header'
import Hero from './components/Hero'
import PricingGrid from './components/PricingGrid'
import WaitingListForm from './components/WaitingListForm'
import InscriptionForm from './components/InscriptionForm'
import InscriptionReservee from './components/InscriptionReservee'
import Programme from './components/Programme'
import Footer from './components/Footer'
import Admin from './components/Admin'
import ThankYou from './components/ThankYou'

const isAdmin       = window.location.pathname === '/admin'
const isReservation = window.location.pathname === '/inscription'

export default function App() {
  if (isAdmin)       return <Admin />
  if (isReservation) return <InscriptionReservee />

  const params = new URLSearchParams(window.location.search)
  const showThankYou = params.get('merci') === '1'
  const inscriptionId = params.get('id')
  const paiementMode = params.get('mode') || ''
  const isSoldePayment = params.get('solde') === '1'

  useEffect(() => {
    if (!showThankYou || !inscriptionId) return
    // solde=1 : retour d'un lien de relance → on marque le solde réglé dans le CRM.
    // Sinon : confirmation du paiement initial (emails + statut).
    const endpoint = isSoldePayment ? '/api/confirm-solde-payment' : '/api/confirm-payment'
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inscriptionId }),
    }).catch(() => {})
  }, [])

  if (showThankYou) return <ThankYou />

  // Lien spécial ?mode=autre : ré-ouvre le formulaire complet d'inscription
  // (paiement intégral, demande soumise à validation admin)
  const inscriptionsOuvertes = paiementMode === 'autre'

  return (
    <>
      <div className="aurora-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>
      <Header />
      <main>
        <Hero open={inscriptionsOuvertes} />
        <PricingGrid />
        <Programme />
        {inscriptionsOuvertes ? <InscriptionForm paiementMode="autre" /> : <WaitingListForm />}
      </main>
      <Footer />
    </>
  )
}

import { useEffect } from 'react'
import './App.css'
import Header from './components/Header'
import Hero from './components/Hero'
import PricingGrid from './components/PricingGrid'
import InscriptionForm from './components/InscriptionForm'
import Footer from './components/Footer'
import Admin from './components/Admin'
import ThankYou from './components/ThankYou'

const isAdmin = window.location.pathname === '/admin'

export default function App() {
  if (isAdmin) return <Admin />

  const params = new URLSearchParams(window.location.search)
  const showThankYou = params.get('merci') === '1'
  const inscriptionId = params.get('id')

  useEffect(() => {
    if (!showThankYou || !inscriptionId) return
    fetch('/api/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inscriptionId }),
    }).catch(() => {})
  }, [])

  if (showThankYou) return <ThankYou />

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
        <Hero />
        <PricingGrid />
        <InscriptionForm />
      </main>
      <Footer />
    </>
  )
}

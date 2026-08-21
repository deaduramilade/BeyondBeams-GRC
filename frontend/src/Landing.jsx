import { useState } from 'react'
import { ArrowRight, Check, CircleHelp, FileCheck2, LockKeyhole, Menu, MoveUpRight, ShieldCheck, Sparkles, X } from 'lucide-react'

const plans = [
  { name: 'Starter', price: 'Free', note: 'A clear first step for a small team.', action: 'Start free', features: ['15 active risks', '2 workspace members', 'Core risk register', 'Starter templates'] },
  { name: 'Growth', price: '$1,490', annual: '/ year', note: 'The operating system for everyday risk.', action: 'Choose Growth', popular: true, features: ['100 active risks', '5 workspace members', 'Assessments and heat maps', '1 framework + basic reports'] },
  { name: 'Professional', price: '$3,990', annual: '/ year', note: 'For teams ready to make risk a rhythm.', action: 'Choose Professional', features: ['Unlimited risks', '10 workspace members', 'Multiple frameworks', 'Workflows and executive dashboards'] },
  { name: 'Business', price: '$9,990', annual: '/ year', note: 'A fuller program for a growing business.', action: 'Talk to us', features: ['Everything in Professional', 'Priority support', 'Custom templates and API', 'Audit-ready exports'] },
]

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState(null)
  const [billing, setBilling] = useState('annual')
  const openWorkspace = () => { window.location.hash = 'workspace' }
  const go = id => { setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

  return <div className="landing">
    <header className="landing-nav">
      <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Northstar home"><span>✦</span> northstar <b>GRC</b></button>
      <nav className={menu ? 'landing-links open' : 'landing-links'} aria-label="Main navigation">
        <button onClick={() => go('method')}>How it works</button><button onClick={() => go('pricing')}>Pricing</button><button onClick={() => go('add-ons')}>Expert help</button>
        <button className="nav-login" onClick={() => setModal('signin')}>Sign in <ArrowRight size={14}/></button>
        <button className="nav-cta" onClick={() => setModal('signup')}>Create workspace <ArrowRight size={15}/></button>
      </nav>
      <button className="landing-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker"><span className="pulse-dot"/> GRC for businesses that are moving</p>
          <h1>Know what could<br/><em>knock you off course.</em></h1>
          <p className="hero-lede">Northstar turns scattered concerns into a calm, shared view of risk, controls, and the next right action. Serious structure for teams without a six-figure GRC budget.</p>
          <div className="hero-actions"><button className="button dark" onClick={() => setModal('signup')}>Start with a free workspace <ArrowRight size={17}/></button><button className="text-button" onClick={() => go('method')}>See how it works <MoveUpRight size={15}/></button></div>
          <p className="fine-print"><Check size={14}/> No card required <span/> <Check size={14}/> Set up in minutes <span/> <Check size={14}/> Upgrade when ready</p>
        </div>
        <div className="hero-art" aria-label="Illustration of risk moving from exposure to controlled outcome">
          <div className="orbit orbit-a"/><div className="orbit orbit-b"/>
          <div className="art-label label-top">EXPOSURE <b>17</b></div><div className="art-label label-bottom">CONTROLLED <b>06</b></div>
          <div className="risk-node node-main"><span>customer data</span><strong>risk</strong><i>5 × 5</i></div>
          <div className="risk-node node-one"><span>supplier access</span><strong>risk</strong><i>4 × 4</i></div><div className="risk-node node-two"><span>recovery gap</span><strong>risk</strong><i>3 × 5</i></div>
          <div className="art-arrow"><ArrowRight size={22}/></div><div className="shield-mark"><ShieldCheck size={42}/></div>
          <div className="art-caption"><span>01</span> map the uncertainty<br/><span>02</span> make ownership visible<br/><span>03</span> move it forward</div>
        </div>
      </section>

      <section className="signal-strip"><p>Built for the work between a spreadsheet and a consultant</p><div><span>Cyber & privacy</span><span>Operations</span><span>Compliance</span><span>Resilience</span><span>Strategy</span></div></section>

      <section className="story-section" id="method"><div className="section-intro"><p className="eyebrow">A better risk habit</p><h2>Risk management should<br/><em>change the week ahead.</em></h2><p>Northstar gives your team a shared language for what matters, who owns it, and whether the plan is working.</p></div><div className="method-grid"><Method n="01" icon={<Sparkles/>} title="See the whole picture" text="Capture risks in one register, scored consistently from likelihood × impact. No more competing versions of the truth."/><Method n="02" icon={<LockKeyhole/>} title="Make the response real" text="Connect controls, owners, due dates, and treatment actions to every exposure that needs attention."/><Method n="03" icon={<FileCheck2/>} title="Show your working" text="Give leaders a clear dashboard and audit-ready export that explains the decision, not just the number."/></div></section>

      <section className="proof-band"><div><p className="eyebrow lime">The Northstar view</p><h2>From anxious<br/><em>to actionable.</em></h2></div><div className="proof-visual"><div className="proof-line"><b>INHERENT</b><span className="bar high"/><strong>18</strong></div><div className="proof-line active"><b>RESIDUAL</b><span className="bar low"/><strong>08</strong></div><p>Every score keeps its context.<br/>Every action has an owner.</p></div><div className="proof-note"><CircleHelp size={18}/><p>Northstar supports accountable decisions. It does not make them for you.</p></div></section>

      <section className="pricing-section" id="pricing"><div className="section-intro pricing-intro"><p className="eyebrow">Simple, public pricing</p><h2>Start small.<br/><em>Grow with confidence.</em></h2><p>All plans are designed for small businesses. Annual billing saves 20%; monthly plans are available when you need flexibility.</p><div className="billing-toggle"><button className={billing === 'annual' ? 'selected' : ''} onClick={() => setBilling('annual')}>Annual <small>save 20%</small></button><button className={billing === 'monthly' ? 'selected' : ''} onClick={() => setBilling('monthly')}>Monthly</button></div></div><div className="plans-grid">{plans.map(plan => <Plan key={plan.name} plan={plan} billing={billing} choose={() => setModal(plan.name === 'Business' ? 'contact' : 'signup')}/>)}</div></section>

      <section className="addons" id="add-ons"><div><p className="eyebrow">Optional expert help</p><h2>Need a second<br/><em>set of eyes?</em></h2></div><div className="addon-copy"><p>Bring your draft assessment to a GRC practitioner for a focused review. Get a written readout, practical priorities, and a conversation about what to do next.</p><button className="button light" onClick={() => setModal('contact')}>Book an expert assessment <ArrowRight size={17}/></button></div><div className="addon-price"><small>ONE-TIME REVIEW</small><strong>$499–$1,999</strong><span>Depending on scope</span></div></section>
      <section className="closing"><p className="eyebrow">Your next clear decision</p><h2>Put risk on the table.<br/><em>Then move.</em></h2><button className="button dark" onClick={() => setModal('signup')}>Create your free workspace <ArrowRight size={17}/></button><p>Free forever for up to 15 risks. No credit card.</p></section>
    </main>
    <footer className="landing-footer"><span>✦ northstar <b>GRC</b></span><small>Practical governance for growing businesses.</small><small>© 2026 Northstar GRC</small></footer>
    {modal && <AuthModal type={modal} close={() => setModal(null)} workspace={openWorkspace}/>} 
  </div>
}

function Method({ n, icon, title, text }) { return <article className="method"><div className="method-icon">{icon}</div><span>{n}</span><h3>{title}</h3><p>{text}</p></article> }
function Plan({ plan, billing, choose }) { const amount = billing === 'monthly' && plan.price !== 'Free' ? `$${Math.round(Number(plan.price.replace(/[$,]/g, '')) / 10)}` : plan.price; return <article className={plan.popular ? 'plan featured' : 'plan'}>{plan.popular && <div className="popular">MOST POPULAR</div>}<p>{plan.name}</p><h3>{amount}<small>{plan.annual && (billing === 'annual' ? plan.annual : '/ month')}</small></h3><span>{plan.note}</span><button onClick={choose}>{plan.action} <ArrowRight size={15}/></button><ul>{plan.features.map(feature => <li key={feature}><Check size={14}/>{feature}</li>)}</ul></article> }
function AuthModal({ type, close, workspace }) { const contact = type === 'contact'; return <div className="auth-layer" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-scrim" onClick={close} aria-label="Close"/><div className="auth-modal"><button className="auth-close" onClick={close} aria-label="Close"><X size={18}/></button><div className="auth-mark">✦</div><p className="eyebrow">{contact ? 'Let’s talk scope' : type === 'signin' ? 'Welcome back' : 'Your workspace starts here'}</p><h2 id="auth-title">{contact ? 'Book an expert assessment.' : type === 'signin' ? 'Sign in to Northstar.' : 'Create your free workspace.'}</h2><p>{contact ? 'Tell us a little about your team and we will follow up with the right assessment option.' : 'This review build routes you into the product workspace. Production identity and billing will be connected before launch.'}</p><form onSubmit={e => { e.preventDefault(); contact ? close() : workspace() }}>{contact ? <><input required placeholder="Work email" type="email"/><textarea required placeholder="What would you like help assessing?" rows="3"/></> : <><input required placeholder="Work email" type="email"/><input required placeholder="Password" type="password" minLength="8"/></>}<button className="button dark" type="submit">{contact ? 'Request assessment call' : type === 'signin' ? 'Continue to workspace' : 'Create workspace'} <ArrowRight size={16}/></button></form><small className="auth-foot">{contact ? 'One-time reviews start at $499.' : 'Review mode · no payment required'}</small></div></div> }
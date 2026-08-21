import { useEffect, useState } from 'react'
import RiskAssessment from './RiskAssessment'
import Landing from './Landing'

export default function App() {
  const [path, setPath] = useState(() => window.location.hash.replace('#', ''))
  useEffect(() => { const onHashChange = () => setPath(window.location.hash.replace('#', '')); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange) }, [])
  return path === 'workspace' ? <RiskAssessment /> : <Landing />
}
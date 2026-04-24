import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntroPage } from './pages/IntroPage'
import { PrioritiesPage } from './pages/PrioritiesPage'
import { SurveyPage } from './pages/SurveyPage'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/priorities" element={<PrioritiesPage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

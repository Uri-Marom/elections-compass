import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntroPage } from './pages/IntroPage'
import { PrioritiesPage } from './pages/PrioritiesPage'
import { SurveyPage } from './pages/SurveyPage'
import { ResultsPage } from './pages/ResultsPage'
import { ResearchPage } from './pages/ResearchPage'
import { MKsPage } from './pages/MKsPage'
import { FeedbackButton } from './components/FeedbackButton'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Short version — default */}
        <Route path="/" element={<IntroPage />} />
        <Route path="/priorities" element={<PrioritiesPage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/results" element={<ResultsPage />} />
        {/* Full version */}
        <Route path="/full" element={<IntroPage />} />
        <Route path="/full/priorities" element={<PrioritiesPage />} />
        <Route path="/full/survey" element={<SurveyPage />} />
        <Route path="/full/results" element={<ResultsPage />} />
        {/* Legacy short URLs → redirect to default */}
        <Route path="/short" element={<Navigate to="/" replace />} />
        <Route path="/short/*" element={<Navigate to="/" replace />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/mks" element={<MKsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FeedbackButton />
    </BrowserRouter>
  )
}

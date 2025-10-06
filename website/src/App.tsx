import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import FeaturesPage from './pages/FeaturesPage'
import DownloadPage from './pages/DownloadPage'
import Navbar from './components/Navbar'

function App() {
  return (
    <BrowserRouter basename="/wind-chime-player">
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/download" element={<DownloadPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App


import { Link } from 'react-router-dom'
import { Github, Download } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-ios-blue to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <span className="text-xl font-semibold">WindChime Player</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="hover:text-ios-blue transition-colors">
              首页
            </Link>
            <Link to="/features" className="hover:text-ios-blue transition-colors">
              特性
            </Link>
            <Link to="/download" className="hover:text-ios-blue transition-colors">
              下载
            </Link>
            <a 
              href="https://github.com/16Mu/wind-chime-player" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-ios-blue transition-colors flex items-center space-x-1"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
          </div>

          {/* CTA Button */}
          <Link 
            to="/download"
            className="hidden md:flex items-center space-x-2 bg-ios-blue hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>下载</span>
          </Link>

          {/* Mobile menu button */}
          <button className="md:hidden p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}


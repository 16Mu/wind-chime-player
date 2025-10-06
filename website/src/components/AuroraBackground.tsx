import Aurora from './Aurora'

export default function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gray-950">
      {/* Aurora effect with music-themed colors */}
      <Aurora
        colorStops={["#007AFF", "#AF52DE", "#FF2D55"]}
        blend={0.6}
        amplitude={1.2}
        speed={0.4}
      />
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-gray-950/50" />
    </div>
  )
}


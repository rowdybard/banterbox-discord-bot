import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-dark text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <h1 className="text-xl font-bold">BanterBox</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link 
              href="/auth"
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors border border-gray-600"
              data-testid="button-local-login"
            >
              Sign In
            </Link>
            <a 
              href="/api/auth/google"
              className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              data-testid="button-google-login"
            >
              Google
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              AI-Powered Stream Banter
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Transform your live streams with witty AI responses to chat, donations, and raids. 
              Keep your audience engaged with intelligent banter that never sleeps.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-primary text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Responses</h3>
              <p className="text-gray-400">
                AI-generated witty comebacks to chat messages, keeping conversations lively and entertaining.
              </p>
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-secondary text-2xl">🎵</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Voice Synthesis</h3>
              <p className="text-gray-400">
                Convert banter to natural-sounding speech with customizable voices for immersive experiences.
              </p>
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-accent text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Real-time Overlay</h3>
              <p className="text-gray-400">
                Seamless integration with OBS and streaming software for instant on-screen banter display.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Link 
                href="/auth"
                className="inline-block bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105"
                data-testid="button-get-started"
              >
                Get Started Free
              </Link>
              <a 
                href="/api/auth/google"
                className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-gray-600"
                data-testid="button-google-cta"
              >
                Continue with Google
              </a>
            </div>
            <p className="text-sm text-gray-400">
              Create an account with email or sign in with Google to start generating intelligent stream banter
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 py-6">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          <p>© 2024 BanterBox. AI-powered streaming companion.</p>
        </div>
      </footer>
    </div>
  );
}
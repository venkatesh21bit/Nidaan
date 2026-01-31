import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold text-white">Nidaan.ai</span>
              <span className="hidden sm:inline text-xs text-gray-500 ml-2">Agentic Medical Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-blue-600 hover:bg-blue-500">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Powered by IBM watsonx Orchestrate
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
              Autonomous Patient
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Intake & Triage
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              AI agents that transform patient complaints into clinical insights. 
              Voice-enabled, multilingual, and powered by IBM Watson.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Link href="/patient/triage-enhanced">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-lg px-8 py-6">
                  🎤 Start Voice Triage
                </Button>
              </Link>
              <Link href="/doctor/dashboard-enhanced">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 text-lg px-8 py-6">
                  👨‍⚕️ Doctor Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Agentic AI Architecture</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Multiple specialized AI agents working together to deliver autonomous medical triage
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Speech Agent</h3>
              <p className="text-gray-400 text-sm">
                IBM Watson STT converts voice to text in 10+ Indian languages
              </p>
            </div>

            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-purple-500/50 transition-colors">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">NLU Agent</h3>
              <p className="text-gray-400 text-sm">
                Watson NLU extracts symptoms, medications, and medical entities
              </p>
            </div>

            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-red-500/50 transition-colors">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Triage Agent</h3>
              <p className="text-gray-400 text-sm">
                Scores severity and prioritizes critical cases automatically
              </p>
            </div>

            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 hover:border-green-500/50 transition-colors">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Orchestrator</h3>
              <p className="text-gray-400 text-sm">
                watsonx Orchestrate coordinates all agents seamlessly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400">Autonomous triage in 4 simple steps</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {[
                { step: '01', title: 'Patient Speaks', desc: 'Patient describes symptoms using voice in any language', icon: '🎤' },
                { step: '02', title: 'AI Processes', desc: 'Watson STT & NLU extract medical entities and severity', icon: '🤖' },
                { step: '03', title: 'Triage Scored', desc: 'AI agent scores severity and recommends actions', icon: '📊' },
                { step: '04', title: 'Doctor Reviews', desc: 'Dashboard shows prioritized cases with AI insights', icon: '👨‍⚕️' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-6 mb-8">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {item.step}
                    </div>
                    {idx < 3 && <div className="w-0.5 h-full bg-gray-700 mt-2" />}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{item.icon}</span>
                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                      </div>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Built with IBM Cloud</h2>
            <p className="text-gray-400">Enterprise-grade infrastructure for healthcare</p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 items-center">
            {[
              { name: 'watsonx Orchestrate', desc: 'AI Agent Coordination' },
              { name: 'Watson NLU', desc: 'Medical Entity Extraction' },
              { name: 'Watson STT', desc: 'Multilingual Speech' },
              { name: 'IBM Cloudant', desc: 'NoSQL Database' },
              { name: 'Code Engine', desc: 'Serverless Deploy' },
            ].map((tech, idx) => (
              <div key={idx} className="text-center px-6 py-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-white font-semibold">{tech.name}</div>
                <div className="text-xs text-gray-500">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Patient Intake?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Experience the future of autonomous medical triage with Nidaan.ai
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/patient/triage-enhanced">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                Try Voice Triage
              </Button>
            </Link>
            <Link href="/doctor/dashboard-enhanced">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800 bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © 2024 Nidaan.ai - Autonomous Patient Intake & Triage Agent
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Built for IBM watsonx Orchestrate Hackathon
          </p>
        </div>
      </footer>
    </div>
  )
}

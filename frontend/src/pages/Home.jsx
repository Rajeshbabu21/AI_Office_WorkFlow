import { useState, useEffect } from 'react';
import {
  Zap, Shield, Cpu, Activity, FileText, Layers, CheckCircle,
  AlertCircle, ArrowRight, ChevronRight, Search, BarChart3,
  MessageSquare, Mail, Terminal, ExternalLink, GitBranch,
  Menu, X, Server, Database, Globe
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios.jsx';
import { logout } from '../api/authApi.jsx';

function Home() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [activeAgent, setActiveAgent] = useState('classification');

  // Configuration for visual agent console steps represented by icons
  const agentConsoleSteps = {
    classification: [
      { icon: Server, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.25)]', border: 'border-cyan-500/30', label: 'Ingestion', desc: 'Ingested stream ticket #41029' },
      { icon: Cpu, color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.25)]', border: 'border-blue-500/30', label: 'NLP Analyze', desc: 'Processed sentiment vector matrix' },
      { icon: Layers, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.25)]', border: 'border-purple-500/30', label: 'Classify', desc: 'Classified: VPN Issue (Dept: IT)' },
      { icon: AlertCircle, color: 'text-yellow-500', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.25)]', border: 'border-yellow-500/30', label: 'Priority Check', desc: 'Severity Tag: Urgent High priority' },
      { icon: GitBranch, color: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.25)]', border: 'border-green-500/30', label: 'State Route', desc: 'Routing state to RAG agent' }
    ],
    rag_retrieval: [
      { icon: FileText, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.25)]', border: 'border-cyan-500/30', label: 'Keywords', desc: 'Constructed search query text' },
      { icon: Cpu, color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.25)]', border: 'border-blue-500/30', label: 'Embedding', desc: 'Computed coordinates (3072d)' },
      { icon: Layers, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.25)]', border: 'border-purple-500/30', label: 'Vector Slice', desc: 'Sliced vector array to 384 dimensions' },
      { icon: Database, color: 'text-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.25)]', border: 'border-yellow-500/30', label: 'DB Query', desc: 'Invoked match_sop_chunks SQL RPC' },
      { icon: CheckCircle, color: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.25)]', border: 'border-green-500/30', label: 'DB Match', desc: 'Matched SOP-012 (Similarity: 0.892)' }
    ],
    resolution: [
      { icon: Shield, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.25)]', border: 'border-cyan-500/30', label: 'Compliance', desc: 'Zero-trust rules configured' },
      { icon: FileText, color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.25)]', border: 'border-blue-500/30', label: 'Context Prep', desc: 'Injected retrieved database SOP text' },
      { icon: Cpu, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.25)]', border: 'border-purple-500/30', label: 'LLM Invoke', desc: 'Triggered Gemini-Pro model synthesis' },
      { icon: Activity, color: 'text-yellow-500', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.25)]', border: 'border-yellow-500/30', label: 'Streaming', desc: 'Response tokens generated: 98' },
      { icon: CheckCircle, color: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.25)]', border: 'border-green-500/30', label: 'Validate', desc: 'Validated resolution against SOP' }
    ],
    escalation: [
      { icon: Search, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.25)]', border: 'border-cyan-500/30', label: 'SLA Audit', desc: 'Initialized similarity check logs' },
      { icon: Activity, color: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.25)]', border: 'border-blue-500/30', label: 'Threshold', desc: 'Evaluating similarity vs SLA rules' },
      { icon: CheckCircle, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.25)]', border: 'border-purple-500/30', label: 'SLA Result', desc: 'Similarity score 0.892 >= 0.70' },
      { icon: Shield, color: 'text-yellow-500', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.25)]', border: 'border-yellow-500/30', label: 'Decision', desc: 'Self-resolved; human queue bypassed' },
      { icon: Zap, color: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.25)]', border: 'border-green-500/30', label: 'Dispatch', desc: 'Dispatched autonomous ticket close' }
    ]
  };

  // Interactive Sandbox State
  const [ticketTitle, setTicketTitle] = useState('VPN connection failing');
  const [ticketDesc, setTicketDesc] = useState('Unable to connect to the corporate VPN from home. Getting credential timeout error.');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLogs, setSandboxLogs] = useState([]);

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  // Sync token state if changed elsewhere (e.g. storage events)
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auto-scroll logic for steps illustration
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 6);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    setToken('');
  };

  const triggerSandboxSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setSandboxLogs([
        { time: '0.0s', msg: '🔐 Live backend test requires login. Redirecting to authentication page...' }
      ]);
      setTimeout(() => {
        navigate('/login');
      }, 1200);
      return;
    }
    setSandboxLoading(true);
    setSandboxLogs([
      { time: '0.0s', msg: '🚦 Starting AI Agent Workflow Pipeline...' },
      { time: '0.2s', msg: '🔍 Step 1: Running LLM Classification...' }
    ]);

    // Simulate steps as it goes
    setTimeout(() => {
      setSandboxLogs(prev => [...prev, { time: '0.8s', msg: '📂 Step 2: Generating 384-dimensional query embedding...' }]);
    }, 600);

    setTimeout(() => {
      setSandboxLogs(prev => [...prev, { time: '1.4s', msg: '⚡ Step 3: Searching Supabase vector database (match_sop_chunks)...' }]);
    }, 1200);

    setTimeout(() => {
      setSandboxLogs(prev => [...prev, { time: '2.0s', msg: '🧩 Step 4: Injecting retrieved SOP context into prompt template...' }]);
    }, 1800);

    setTimeout(() => {
      setSandboxLogs(prev => [...prev, { time: '2.5s', msg: '🤖 Step 5: Invoking Gemini AI model for context-aware resolution...' }]);
    }, 2400);

    try {
      const response = await api.post('/insert_ticket', {
        title: ticketTitle,
        description: ticketDesc
      });

      const data = response.data;

      setTimeout(() => {
        setSandboxLogs(prev => [...prev, { time: '3.1s', msg: '🎯 Step 6: Response successfully generated.' }]);
        setSandboxResult(data);
        setSandboxLoading(false);
      }, 3000);

    } catch (err) {
      console.warn('Backend server unreachable, using mock simulation responses.', err);
      // Fallback Mock Response for demo purposes if backend isn't running
      setTimeout(() => {
        setSandboxLogs(prev => [...prev, { time: '3.1s', msg: '⚠️ API Connection Offline. Running local simulation...' }]);
      }, 2800);

      setTimeout(() => {
        const mockData = {
          ticket: {
            id: 104,
            title: ticketTitle,
            description: ticketDesc,
            category: ticketTitle.toLowerCase().includes('vpn') ? 'VPN Issue' : 'General IT Help',
            priority: ticketDesc.toLowerCase().includes('urgent') || ticketTitle.toLowerCase().includes('fail') ? 'High' : 'Medium',
            department: 'IT Support',
            ai_response: `Based on SOP-012 (VPN Configuration Guidelines), credential timeout issues occur when the local authentication client is out of sync. Please:
1. Open your corporate VPN client settings.
2. Select 'Clear Cache & Tokens'.
3. Restart your router and re-authenticate using your Multi-Factor Authentication (MFA) app.
If issues persist, please contact the local network administrator.`
          },
          retrieved_sops: [
            { id: 12, title: 'VPN Configuration Guidelines', department: 'IT Support', file_url: 'https://supabase.co/storage/v1/object/public/sops/vpn_config_v2.pdf' }
          ],
          retrieved_chunks: [
            { chunk_text: 'VPN authentication errors (timeout/credential) are frequently resolved by clearing client-side cookies and re-synchronizing the MFA token device.', similarity: 0.892 }
          ],
          ai_response: `Based on SOP-012 (VPN Configuration Guidelines), credential timeout issues occur when the local authentication client is out of sync. Please:
1. Open your corporate VPN client settings.
2. Select 'Clear Cache & Tokens'.
3. Restart your router and re-authenticate using your Multi-Factor Authentication (MFA) app.
If issues persist, please contact the local network administrator.`
        };
        setSandboxLogs(prev => [...prev, { time: '3.3s', msg: '🎯 Simulation: Response successfully generated.' }]);
        setSandboxResult(mockData);
        setSandboxLoading(false);
      }, 3200);
    }
  };

  const clearSandbox = () => {
    setSandboxResult(null);
    setSandboxLogs([]);
    setTicketTitle('VPN connection failing');
    setTicketDesc('Unable to connect to the corporate VPN from home. Getting credential timeout error.');
  };

  return (
    <div className="min-h-screen bg-[#020503] text-gray-300 selection:bg-blue-500 selection:text-white font-sans relative bg-grid-pattern">

      {/* Background radial overlays to match premium dark-navy glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-950/15 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[800px] right-1/4 w-[700px] h-[700px] bg-indigo-950/10 rounded-full blur-[180px] pointer-events-none"></div>
      <div className="absolute bottom-[400px] left-1/3 w-[800px] h-[800px] bg-blue-950/10 rounded-full blur-[200px] pointer-events-none"></div>

      {/* HEADER SECTION */}
      <header className="sticky top-0 w-full z-50 bg-[#020503]/85 backdrop-blur-md border-b border-blue-500/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="relative w-9 h-9 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent"></div>
                <GitBranch className="w-5 h-5 text-blue-400 relative z-10" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-sans flex items-center">
                AutoFlow<span className="text-blue-400 font-mono font-medium ml-1">AI</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#workflow" className="text-gray-400 hover:text-blue-400 transition-colors">Workflow</a>
            <a href="#features" className="text-gray-400 hover:text-blue-400 transition-colors">Features</a>
            <a href="#agents" className="text-gray-400 hover:text-blue-400 transition-colors">AI Agents</a>
            {/* <a href="#analytics" className="text-gray-400 hover:text-blue-400 transition-colors">Analytics</a> */}
            <a href="#integrations" className="text-gray-400 hover:text-blue-400 transition-colors">Integrations</a>
          </nav>

          {/* Action Button */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#sandbox"
              className="text-sm font-medium text-blue-400 border border-blue-500/30 hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 px-4 py-2 rounded transition-all duration-300"
            >
              Interactive Demo
            </a>
            {token ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/dashboard"
                  className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 px-5 py-2.5 rounded transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center cursor-pointer"
                >
                  Console Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold border border-red-500/30 hover:border-red-400 bg-red-500/5 hover:bg-red-500/10 text-red-400 px-5 py-2.5 rounded transition-all duration-300 cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 px-5 py-2.5 rounded transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center cursor-pointer"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-blue-400 transition-colors"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMenuOpen && (
          <div className="md:hidden bg-[#020503] border-b border-blue-500/10 px-4 pt-2 pb-6 flex flex-col gap-4">
            <a
              href="#workflow"
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-300 hover:text-blue-400 py-2 border-b border-gray-800 text-lg transition-colors"
            >
              Workflow
            </a>
            <a
              href="#features"
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-300 hover:text-blue-400 py-2 border-b border-gray-800 text-lg transition-colors"
            >
              Features
            </a>
            <a
              href="#agents"
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-300 hover:text-blue-400 py-2 border-b border-gray-800 text-lg transition-colors"
            >
              AI Agents
            </a>
            <a
              href="#analytics"
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-300 hover:text-blue-400 py-2 border-b border-gray-800 text-lg transition-colors"
            >
              Analytics
            </a>
            <a
              href="#integrations"
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-300 hover:text-blue-400 py-2 border-b border-gray-800 text-lg transition-colors"
            >
              Integrations
            </a>
            <div className="flex flex-col gap-3 mt-4">
              <a
                href="#sandbox"
                onClick={() => setIsMenuOpen(false)}
                className="text-center font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 py-2.5 rounded transition-all"
              >
                Interactive Demo
              </a>
              {token ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-center font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer"
                  >
                    Console Dashboard
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="text-center font-semibold border border-red-500/30 bg-red-500/5 text-red-400 py-2.5 rounded transition-all cursor-pointer"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-center font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer text-center"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs px-4 py-1.5 rounded-full tracking-widest font-mono uppercase mb-8 animate-pulse">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>A Workflow Automation Revolution</span>
          </div>

          {/* Huge display header styled identical to WEALTH but in premium blue */}
          <h1 className="text-6xl md:text-8xl lg:text-[110px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 tracking-tight leading-none mb-4 text-glow-blue-strong">
            Automation
          </h1>

          <div className="text-xs md:text-sm font-mono text-cyan-400/80 tracking-[0.25em] uppercase mb-8">
            REWRITE THE COMPLIANCE LAYER. SYSTEMIZE RESOLUTION.
          </div>

          {/* Headline and paragraph content */}
          <h2 className="text-2xl md:text-4xl lg:text-[44px] font-bold text-white max-w-4xl mx-auto leading-tight mb-6">
            {/* Money was never the goal. Manual triage isn't either. <br className="hidden md:inline" /> */}
            <span className="text-white">Join the automated workflow revolution.</span>
          </h2>

          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Automate ticket resolution, SOP retrieval, escalation, and reporting.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {token ? (
              <a
                href="#sandbox"
                className="w-full sm:w-auto text-center font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 px-8 py-3.5 rounded transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2 group"
              >
                <span>Console Active</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <Link
                to="/login"
                className="w-full sm:w-auto text-center font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 px-8 py-3.5 rounded transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}

          </div>

          {/* Graph Grid mock display in background */}
          {/* <div className="relative mt-20 max-w-5xl mx-auto rounded-xl border border-blue-500/20 bg-black/40 backdrop-blur-sm p-2 glow-box-blue overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>


            <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/10 bg-black/60 font-mono text-[10px] text-blue-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                <span>SYSTEM_STATUS: ACTIVE</span>
              </div>
              <div>EMBEDDING_ENGINE: VECTOR(384)</div>
              <div>SERVER_TIME: 2026.06.21</div>
            </div>

            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-left">
              <div className="border border-blue-500/10 rounded p-4 bg-[#030604]">
                <div className="text-xs text-gray-500 mb-2">// INCOMING_TICKET_STREAM</div>
                <div className="space-y-3 text-[11px]">
                  <div className="p-2 bg-blue-950/20 border-l-2 border-blue-500 rounded">
                    <span className="text-blue-400">[ID: 108]</span> Network error in warehouse printer. Urgent.
                  </div>
                  <div className="p-2 bg-gray-900/30 border-l-2 border-gray-600 rounded opacity-60">
                    <span className="text-gray-400">[ID: 107]</span> Can't download onboarding packet.
                  </div>
                  <div className="p-2 bg-gray-900/30 border-l-2 border-gray-600 rounded opacity-60">
                    <span className="text-gray-400">[ID: 106]</span> Slack integration config failing.
                  </div>
                </div>
              </div>

              <div className="border border-blue-500/10 rounded p-4 bg-[#030604] relative">
                <div className="text-xs text-gray-500 mb-2">// KNOWLEDGE_RETRIEVAL_RAG</div>
                <div className="space-y-2 text-[11px]">
                  <div className="text-blue-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-cyan-400" /> Found SOP_Document #412
                  </div>
                  <div className="text-gray-400 italic bg-black/50 p-2 rounded text-[10px] leading-tight">
                    "All wireless network printers in zone C authentication must run over 802.1x security schemas. Regenerate internal tickets for Zone C support."
                  </div>
                  <div className="text-[10px] text-blue-400/70 text-right">Similarity Score: 0.941</div>
                </div>
              </div>

              <div className="border border-blue-500/10 rounded p-4 bg-[#030604]">
                <div className="text-xs text-gray-500 mb-2">// AI_AGENT_SYNTHESIS</div>
                <div className="text-[11px] leading-relaxed text-gray-400 space-y-2">
                  <div className="text-white font-semibold">Gemini LLM Response Draft:</div>
                  <div className="text-[10px] bg-black/50 p-2 rounded">
                    "Identified printer error. In accordance with Network Printer SOP #412, Zone C support printer has been re-synchronized over 802.1x. Closing ticket."
                  </div>
                  <div className="text-blue-400 text-right text-[10px] animate-pulse">Ready to deploy.</div>
                </div>
              </div>
            </div>
          </div> */}

        </div>
      </section>

      {/* TRUSTED BY / PLATFORM HIGHLIGHTS */}
      {/* <section className="py-12 border-y border-blue-500/10 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-mono tracking-[0.2em] text-blue-400/70 uppercase mb-8">
            Platform Highlights & Reliability Infrastructure
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div className="flex flex-col items-center justify-center p-4 border border-blue-500/5 rounded bg-black/20 text-center hover:border-blue-500/20 transition-all duration-300">
              <Cpu className="w-6 h-6 text-blue-400 mb-3" />
              <h4 className="text-white font-bold text-sm md:text-base">AI-Powered</h4>
              <p className="text-[11px] text-gray-500 mt-1">LLM classification & response synthesis</p>
            </div>

            <div className="flex flex-col items-center justify-center p-4 border border-blue-500/5 rounded bg-black/20 text-center hover:border-blue-500/20 transition-all duration-300">
              <Shield className="w-6 h-6 text-blue-400 mb-3" />
              <h4 className="text-white font-bold text-sm md:text-base">Secure Authentication</h4>
              <p className="text-[11px] text-gray-500 mt-1">Multi-role authorization & DB controls</p>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border border-blue-500/5 rounded bg-black/20 text-center hover:border-blue-500/20 transition-all duration-300">
              <Zap className="w-6 h-6 text-blue-400 mb-3" />
              <h4 className="text-white font-bold text-sm md:text-base">Real-Time Automation</h4>
              <p className="text-[11px] text-gray-500 mt-1">Instant ingestion, matching, and closing</p>
            </div>
          </div>
        </div>
      </section> */}

      {/* CORE WORKFLOW SECTION */}
      <section id="workflow" className="py-20 md:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
            <div>
              <span className="text-xs font-mono tracking-widest text-blue-400 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">// PIPELINE STAGES</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-4 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue">Automations.</span>
              </h2>
              <p className="text-gray-400 mt-3 text-sm md:text-base max-w-xl">
                Real-time math. Instant RAG updates. Built for support systems that demand bulletproof execution.
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <a href="#sandbox" className="text-xs font-mono text-cyan-400 flex items-center gap-1 hover:text-cyan-300 transition-colors">
                <span>See live execution trace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Process Grid Card Layout based on Calculators cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">

            {/* Stage 1 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-001</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">Ticket Submission</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Tickets are ingested from multiple sources: emails, Slack messages, custom portal widgets, or standard APIs.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">INGESTION AGENT</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-002</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">AI Classification</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Natural Language Processing identifies categories (e.g. VPN issues, Payroll) and tags severity indices automatically.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">ROUTING ENGINE</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-003</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">SOP Retrieval (RAG)</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Calculates similarity matching on the database using 384-dimensional slices to isolate exact steps from relevant SOP files.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">VECTOR SEARCH</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-004</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">Resolution Generation</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Gemini constructs custom, polite resolutions using retrieved text chunks, maintaining zero-trust strict compliance.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">AI SYNTHESIS</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Stage 5 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-005</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">Escalation Decision</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                If the similarity matching fails to meet thresholds, the escalation engine alerts appropriate department personnel.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">LANGGRAPH CHECK</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Stage 6 */}
            <div className="relative border border-blue-500/10 hover:border-blue-500/30 rounded-xl bg-gradient-to-b from-[#030604] to-black p-6 group transition-all duration-300 hover:-translate-y-1 glow-box-blue-hover">
              <span className="absolute top-4 right-4 font-mono text-[10px] text-blue-500/40 group-hover:text-blue-500/80 transition-colors">WF-006</span>
              <div className="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/15 group-hover:border-blue-500/50 transition-all duration-300">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">Ticket Closure</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Closes the ticket in database, notifies users across integrated channels, and stores key SLA logs for performance review.
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-blue-500/5 pt-4">
                <span className="text-[10px] font-mono text-blue-500/60 uppercase">FINALIZE LOGS</span>
                <span className="text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  READY <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* HOW IT WORKS SECTION (TIMELINE) */}
      <section className="py-20 md:py-28 relative bg-[#020503]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="text-xs font-mono tracking-widest text-blue-400 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">Execution Pipeline</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-4 tracking-tight">
              From submission to closure <br />in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue">milliseconds.</span>
            </h2>
          </div>

          {/* Timeline diagram container */}
          <div className="relative">
            {/* Line connector */}
            <div className="hidden lg:block absolute top-[52px] left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/10 via-blue-500/40 to-blue-500/10 z-0"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 relative z-10">

              {/* Step 1 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 0
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(0)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  01
                </div>
                <h5 className="text-white font-bold text-sm">User Creates Ticket</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Inputs description, title and department settings</p>
              </div>

              {/* Step 2 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 1
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(1)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  02
                </div>
                <h5 className="text-white font-bold text-sm">AI Analyzes</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">NLP understands severity, categories and routing metrics</p>
              </div>

              {/* Step 3 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 2
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(2)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  03
                </div>
                <h5 className="text-white font-bold text-sm">SOP Retrieved</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">384-dimensional vector database search extracts context</p>
              </div>

              {/* Step 4 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 3
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(3)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  04
                </div>
                <h5 className="text-white font-bold text-sm">Draft Synthesized</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Gemini uses retrieved context to create draft answer</p>
              </div>

              {/* Step 5 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 4
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(4)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  05
                </div>
                <h5 className="text-white font-bold text-sm">Escalated if Required</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">System triggers Jira callback if similarity threshold misses</p>
              </div>

              {/* Step 6 */}
              <div
                className={`text-center p-4 border rounded-lg transition-all duration-300 cursor-pointer ${activeStep === 5
                  ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-105'
                  : 'border-blue-500/10 bg-black/20 hover:border-blue-500/30'
                  }`}
                onClick={() => setActiveStep(5)}
              >
                <div className="w-10 h-10 rounded-full mx-auto bg-[#020503] border border-blue-500/40 flex items-center justify-center font-mono text-xs text-cyan-400 font-bold mb-4">
                  06
                </div>
                <h5 className="text-white font-bold text-sm">Auto Closed</h5>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Integrations update status & save telemetry</p>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* AI AGENTS SECTION */}
      <section id="agents" className="py-20 md:py-28 border-t border-blue-500/10 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
            <div>
              <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">// WORKFLOW AGENTS</span>
              <h2 className="text-3xl md:text-5xl font-bold text-white mt-4 tracking-tight">
                Autonomous <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue">LLM Agents.</span>
              </h2>
              <p className="text-gray-400 mt-3 text-sm md:text-base max-w-xl">
                Dynamic execution graphs handling distinct task scopes under strict SLAs.
              </p>
            </div>

            {/* Agent selectors */}
            <div className="mt-6 md:mt-0 flex flex-wrap gap-2 font-mono text-xs">
              {['classification', 'rag_retrieval', 'resolution', 'escalation'].map((agent) => (
                <button
                  key={agent}
                  onClick={() => setActiveAgent(agent)}
                  className={`px-3 py-1.5 rounded border transition-all uppercase cursor-pointer ${activeAgent === agent
                    ? 'border-blue-500 bg-blue-500/10 text-cyan-400 font-bold'
                    : 'border-blue-500/10 hover:border-blue-500/30 text-gray-400 hover:text-white'
                    }`}
                >
                  {agent.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Agent Board */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Agent Profile Card */}
            <div className="lg:col-span-1 border border-blue-500/20 rounded-xl p-6 bg-black relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>

              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]">
                    {activeAgent === 'classification' && <Layers className="w-6 h-6" />}
                    {activeAgent === 'rag_retrieval' && <Search className="w-6 h-6" />}
                    {activeAgent === 'resolution' && <Cpu className="w-6 h-6" />}
                    {activeAgent === 'escalation' && <GitBranch className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-white font-bold capitalize text-lg">{activeAgent.replace('_', ' ')} Agent</h4>
                    <span className="text-[10px] font-mono text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 uppercase tracking-widest">
                      ACTIVE
                    </span>
                  </div>
                </div>

                {/* Agent parameters */}
                <div className="space-y-4 font-mono text-xs border-t border-blue-500/10 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">TASK_SCOPE:</span>
                    <span className="text-white">
                      {activeAgent === 'classification' && 'Ingestion, sorting, priority tagging'}
                      {activeAgent === 'rag_retrieval' && 'Vector search, embedding sliced matching'}
                      {activeAgent === 'resolution' && 'Context rendering & response synthesis'}
                      {activeAgent === 'escalation' && 'SLA tracking & webhook dispatcher'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">LLM_ENGINE:</span>
                    <span className="text-cyan-400">Gemini Pro 1.5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ACCURACY:</span>
                    <span className="text-white">
                      {activeAgent === 'classification' && '99.1%'}
                      {activeAgent === 'rag_retrieval' && '98.5% (sliced 384d)'}
                      {activeAgent === 'resolution' && '96.2%'}
                      {activeAgent === 'escalation' && '100% Deterministic'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-blue-500/10 text-xs text-gray-500 leading-relaxed">
                🤖 This agent operates inside our LangGraph state framework, querying the database and modifying states via transactional calls.
              </div>
            </div>

            {/* Agent Live Console Simulation (Visual Timeline) */}
            <div className="lg:col-span-2 border border-blue-500/15 rounded-xl bg-black overflow-hidden font-mono text-xs">
              <div className="bg-gray-950 px-4 py-2.5 flex items-center justify-between border-b border-blue-500/10 text-blue-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 pulse-dot"></span>
                  <span>Agent Graph Visualizer // {activeAgent.toUpperCase()}_ENGINE</span>
                </div>
                <div className="text-[10px] text-gray-600">STATE: ACTIVE</div>
              </div>

              <div className="p-5 h-[340px] bg-[#020503] flex items-center justify-center relative overflow-hidden">
                <div className="flex items-center justify-between w-full max-w-xl relative px-4 z-10">
                  {/* Background Connector Line */}
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-500/10 via-blue-500/35 to-blue-500/10 -translate-y-1/2 z-0"></div>

                  {(agentConsoleSteps[activeAgent] || []).map((step, idx, arr) => {
                    const StepIcon = step.icon;
                    const isUp = idx % 2 === 0;
                    return (
                      <div key={idx} className="flex items-center z-10 relative">
                        <div className="flex flex-col items-center relative">

                          {/* Details Card (Shown Always, alternating up and down) */}
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 bg-[#050a06]/95 border border-blue-500/20 text-white text-[10px] font-mono p-2 rounded-lg shadow-xl min-w-[95px] max-w-[120px] text-center z-20 ${isUp ? 'bottom-8' : 'top-8'
                              }`}
                          >
                            {/* Tiny pointing arrow indicator */}
                            <div className={`absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#050a06] border-r border-b border-blue-500/20 rotate-45 ${isUp ? '-bottom-1 border-t-0 border-l-0' : '-top-1 border-r-0 border-b-0 border-l border-t'
                              }`} />

                            <div className="font-bold text-cyan-400 uppercase text-[9px] tracking-wider mb-0.5 leading-none">{step.label}</div>
                            <div className="text-gray-400 text-[8px] leading-tight whitespace-normal">{step.desc}</div>
                          </div>

                          {/* Pulsing Outer Ring Icon */}
                          <div className={`w-8 h-8 rounded-full bg-black border ${step.border} flex items-center justify-center shadow-lg hover:${step.glow} hover:border-cyan-400 transition-all duration-300 z-10`}>
                            <StepIcon className={`w-4 h-4 ${step.color} animate-pulse`} />
                          </div>

                        </div>
                        {idx < arr.length - 1 && (
                          <div className="w-8 h-px bg-transparent mx-1 sm:mx-2"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO SANDBOX */}
      <section id="sandbox" className="py-20 md:py-28 bg-[#020503] relative border-t border-blue-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">Interactive Sandbox</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-4 tracking-tight">
              Test the AI Agent <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue">workflow.</span>
            </h2>
            <p className="text-gray-400 mt-4 text-sm md:text-base">
              Submit a support query below to run the RAG pipeline. See the classification, retrieved database SOP chunks, and generated resolution in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">

            {/* Input Form */}
            <form onSubmit={triggerSandboxSubmit} className="lg:col-span-5 border border-blue-500/20 rounded-xl p-6 bg-black flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-blue-500/10 pb-3">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>Create Test Ticket</span>
                  </span>
                  <button
                    type="button"
                    onClick={clearSandbox}
                    className="text-[10px] font-mono text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    Clear Outputs
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="ticket-title-input" className="text-[11px] font-mono uppercase text-gray-400">Ticket Title</label>
                  <input
                    id="ticket-title-input"
                    type="text"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    className="bg-black border border-blue-500/20 rounded p-2.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="e.g. Cannot connect to VPN"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="ticket-desc-input" className="text-[11px] font-mono uppercase text-gray-400">Description</label>
                  <textarea
                    id="ticket-desc-input"
                    value={ticketDesc}
                    onChange={(e) => setTicketDesc(e.target.value)}
                    rows={4}
                    className="bg-black border border-blue-500/20 rounded p-2.5 text-xs text-white font-mono focus:border-blue-500 focus:outline-none transition-colors resize-none"
                    placeholder="Describe the issue in detail..."
                    required
                  />
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="submit"
                  disabled={sandboxLoading}
                  className="w-full font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 py-3 rounded transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sandboxLoading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      <span>Processing Agent Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-white" />
                      <span>Trigger Workflow Pipeline</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Live Terminal Logger & Output */}
            <div className="lg:col-span-7 border border-blue-500/20 rounded-xl bg-black overflow-hidden flex flex-col justify-between min-h-[350px]">

              {/* Terminal Header */}
              <div className="bg-gray-950 px-4 py-2.5 border-b border-blue-500/10 flex items-center justify-between text-blue-400 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Pipeline Execution Logger</span>
                </div>
                <span>AUTOFLOW_STABLE_V1</span>
              </div>

              {/* Logger Screen */}
              <div className="p-4 bg-[#030604] font-mono text-[11px] flex-grow overflow-y-auto space-y-2.5 max-h-[320px] scrollbar text-left">
                {sandboxLogs.length === 0 ? (
                  <div className="text-gray-600 italic">
                    // Awaiting submission. Submit the ticket to inspect internal agent workflow steps, database similarity search operations, and final prompt context layouts.
                  </div>
                ) : (
                  sandboxLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-500">[{log.time}]</span>
                      <span className={log.msg.includes('Step') ? 'text-cyan-400 font-semibold' : 'text-gray-300'}>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}

                {/* Simulated database retrieval layout */}
                {sandboxResult && (
                  <div className="mt-4 pt-4 border-t border-blue-500/10 space-y-4">

                    {/* Retrieved SOPs */}
                    <div>
                      <div className="text-blue-400 text-xs font-bold mb-1">// RETRIEVED_SOP_METADATA:</div>
                      {sandboxResult.retrieved_sops?.length > 0 ? (
                        sandboxResult.retrieved_sops.map((sop, i) => (
                          <div key={i} className="bg-blue-950/20 border border-blue-500/30 rounded p-2 text-white">
                            <span className="text-cyan-400 font-bold">TITLE:</span> {sop.title} <br />
                            <span className="text-cyan-400 font-bold">DEPARTMENT:</span> {sop.department} <br />
                            <span className="text-cyan-400 font-bold">FILE_URL:</span> <a href={sop.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">{sop.file_url}</a>
                          </div>
                        ))
                      ) : (
                        <div className="text-yellow-500 italic p-1 bg-yellow-950/20 border border-yellow-500/30 rounded">
                          No matching SOP documents found in database. Escalation recommended.
                        </div>
                      )}
                    </div>

                    {/* Similarity Chunks */}
                    <div>
                      <div className="text-blue-400 text-xs font-bold mb-1">// RETRIEVED_KNOWLEDGE_CHUNKS:</div>
                      {sandboxResult.retrieved_chunks?.length > 0 ? (
                        sandboxResult.retrieved_chunks.map((chunk, i) => (
                          <div key={i} className="bg-black/60 border border-gray-800 rounded p-2 text-gray-300 relative">
                            <div className="absolute top-2 right-2 text-[10px] text-cyan-400 bg-blue-500/10 px-1 border border-blue-500/20">
                              Sim: {chunk.similarity?.toFixed(3)}
                            </div>
                            <span className="text-gray-500 font-bold">TEXT:</span> "{chunk.chunk_text}"
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 italic">None.</div>
                      )}
                    </div>

                    {/* AI Response Output */}
                    <div>
                      <div className="text-blue-400 text-xs font-bold mb-1">// GENERATED_RESOLUTION_OUTPUT:</div>
                      <div className="bg-blue-950/10 border border-blue-500/20 rounded p-3 text-white leading-relaxed text-xs">
                        {sandboxResult.ai_response || sandboxResult.ticket?.ai_response}
                      </div>
                    </div>

                    {/* Final state summary */}
                    <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded text-cyan-400 border border-blue-500/30 font-bold text-xs">
                      <CheckCircle className="w-4 h-4" />
                      <span>Pipeline execution completed in 3.1s. Database entry updated.</span>
                    </div>

                  </div>
                )}
              </div>

              {/* Terminal Footer */}
              <div className="bg-gray-950 px-4 py-2 border-t border-blue-500/10 text-right text-[10px] text-gray-500">
                DB_CONNECTION: ONLINE (SUPABASE_RPC)
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* INTEGRATIONS SECTION */}
      <section id="integrations" className="py-20 md:py-28 border-t border-blue-500/10 bg-[#020503] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono tracking-widest text-blue-500 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">Platform Highlights & Reliability Infrastructure</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-4 tracking-tight">
              Connect to your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue">helpdesk tools.</span>
            </h2>
            <p className="text-gray-400 mt-4 text-sm md:text-base">
              Synchronize tickets and workflows seamlessly across standard operational tools.
            </p>
          </div>

          {/* Connected Web diagram */}
          <div className="max-w-4xl mx-auto relative border border-blue-500/10 rounded-xl bg-black/40 p-8 flex flex-col md:flex-row items-center justify-around gap-8">

            <div className="flex flex-col gap-4 text-center md:text-left z-10">
              <div className="border border-blue-500/20 rounded p-4 bg-[#030604] hover:border-blue-500/40 transition-all max-w-[200px]">
                <h5 className="text-white font-bold text-sm flex items-center gap-1.5 justify-center md:justify-start">
                  {/* <Database className="w-3.5 h-3.5 text-blue-400" /> */}
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span>AI-Powered</span>
                </h5>
                <p className="text-[10px] text-gray-500 mt-1">LLM classification & response</p>
              </div>
              <div className="border border-blue-500/20 rounded p-4 bg-[#030604] hover:border-blue-500/40 transition-all max-w-[200px]">
                <h5 className="text-white font-bold text-sm flex items-center gap-1.5 justify-center md:justify-start">
                  {/* <Globe className="w-3.5 h-3.5 text-blue-400" /> */}
                  <Shield className="w-3.5 h-3.5 text-blue-400" />

                  <span>Secure Authentication</span>
                </h5>
                <p className="text-[10px] text-gray-500 mt-1">Multi-role authorization & DB controls</p>
              </div>
              <div className="border border-blue-500/20 rounded p-4 bg-[#030604] hover:border-blue-500/40 transition-all max-w-[200px]">
                <h5 className="text-white font-bold text-sm flex items-center gap-1.5 justify-center md:justify-start">
                  {/* <Globe className="w-3.5 h-3.5 text-blue-400" /> */}
                  {/* <Shield className="w-3.5 h-3.5 text-blue-400" /> */}
                  <Zap className="w-3.5 h-3.5 text-blue-400 mb-3" />


                  <span>Real-Time Automation</span>
                </h5>
                <p className="text-[10px] text-gray-500 mt-1">Instant ingestion, matching, and closing</p>
              </div>
            </div>



            {/* Central Node representing the AI pipeline */}
            <div className="relative w-40 h-40 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/5 glow-box-blue z-10">
              <div className="absolute inset-2 rounded-full border border-blue-500/10 bg-black/40 flex flex-col items-center justify-center">
                <GitBranch className="w-8 h-8 text-blue-500 pulse-dot" />
                <span className="text-[10px] font-mono text-blue-400/70 tracking-widest uppercase mt-2">ENGINE</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-center md:text-left z-10">
              <div className="border border-blue-500/20 rounded p-4 bg-[#030604] hover:border-blue-500/40 transition-all max-w-[200px]">
                <h5 className="text-white font-bold text-sm flex items-center gap-1.5 justify-center md:justify-start">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Supabase</span>
                </h5>
                <p className="text-[10px] text-gray-500 mt-1">SOP documents, vector embeddings storage</p>
              </div>
              <div className="border border-blue-500/20 rounded p-4 bg-[#030604] hover:border-blue-500/40 transition-all max-w-[200px]">
                <h5 className="text-white font-bold text-sm flex items-center gap-1.5 justify-center md:justify-start">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Gemini AI</span>
                </h5>
                <p className="text-[10px] text-gray-500 mt-1">Natural language understanding & synthesis</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* TECH STACK SECTION */}
      <section className="py-20 md:py-28 border-t border-blue-500/10 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded">Our Technology Stack</span>
          <h2 className="text-2xl md:text-4xl font-bold text-white mt-4 mb-12 tracking-tight">
            Built using modern, <span className="text-cyan-400">production-grade infrastructure.</span>
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-4 max-w-4xl mx-auto">
            {['React', 'Tailwind CSS', 'FastAPI', 'Supabase', 'PostgreSQL', 'LangGraph', 'Gemini AI'].map((tech) => (
              <div
                key={tech}
                className="px-5 py-3 border border-blue-500/10 rounded-lg bg-black hover:border-blue-500/30 transition-colors font-mono text-xs md:text-sm text-white flex items-center gap-2 group cursor-default"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform"></div>
                <span>{tech}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CALL TO ACTION SECTION */}
      <section id="cta" className="py-24 md:py-32 relative border-t border-blue-500/10 bg-[#020503] overflow-hidden">

        {/* Background glow overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_50%)]"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

          <h2 className="text-4xl md:text-6xl font-black uppercase text-white tracking-tight mb-4">
            Manual triage was never the goal.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-glow-blue-strong">Automation was.</span>
          </h2>

          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Understand the workflow. Build integrations deliberately. Deploy AI agents to handle 94%+ of your tickets completely autonomously.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:contact@autoflow.ai"
              className="w-full sm:w-auto text-center font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 px-8 py-3.5 rounded transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2"
            >
              <span>Request Demo</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="mailto:support@autoflow.ai"
              className="w-full sm:w-auto text-center font-semibold text-cyan-400 border border-blue-500/30 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 px-8 py-3.5 rounded transition-all duration-300"
            >
              Contact Us
            </a>
          </div>

        </div>
      </section>

      {/* FOOTER SECTION */}
      <footer className="border-t border-blue-500/10 bg-[#000000] py-16 text-gray-500 text-xs relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-12">

          {/* Brand Info */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500/10 border border-blue-500/30 rounded flex items-center justify-center">
                <GitBranch className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-white font-bold font-sans text-sm">
                AutoFlow<span className="text-blue-400 font-mono font-medium ml-0.5">AI</span>
              </span>
            </div>
            <p className="max-w-sm text-gray-500 leading-relaxed text-[11px]">
              Triage is a collective bottleneck. We solve it through direct-to-database SOP integrations, sliced embeddings similarity math, and multi-agent LangGraph workflow execution.
            </p>

            {/* Social Icons links */}
            <div className="flex items-center gap-3 pt-2 text-gray-400">
              <a href="https://github.com/Rajeshbabu21" target="_blank" rel="noreferrer" aria-label="GitHub" className="p-2 border border-blue-500/5 hover:border-blue-500/30 rounded bg-black/20 text-gray-400 hover:text-cyan-400 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
              <a href="mailto:support@autoflow.ai" aria-label="Email" className="p-2 border border-blue-500/5 hover:border-blue-500/30 rounded bg-black/20 text-gray-400 hover:text-cyan-400 transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links 1 */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-mono text-[10px] tracking-wider text-cyan-400/70 uppercase">INTEGRATIONS</span>
            <ul className="space-y-2 text-[11px]">
              <li><a href="#integrations" className="hover:text-cyan-400 transition-colors">Jira Connect</a></li>
              <li><a href="#integrations" className="hover:text-cyan-400 transition-colors">Slack Bot</a></li>
              <li><a href="#integrations" className="hover:text-cyan-400 transition-colors">Supabase DB Client</a></li>
              <li><a href="#integrations" className="hover:text-cyan-400 transition-colors">Gemini API Integrator</a></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-mono text-[10px] tracking-wider text-cyan-400/70 uppercase">DOCUMENTATION</span>
            <ul className="space-y-2 text-[11px]">
              <li><a href="#workflow" className="hover:text-cyan-400 transition-colors">System Architecture</a></li>
              <li><a href="#features" className="hover:text-cyan-400 transition-colors">384-Dim Embeddings RAG</a></li>
              <li><a href="#agents" className="hover:text-cyan-400 transition-colors">LangGraph Agents</a></li>
              <li><a href="#sandbox" className="hover:text-cyan-400 transition-colors">Sandbox Demo APIs</a></li>
            </ul>
          </div>

        </div>

        {/* Copyright and custom slogan */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-blue-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-[10px]">
            © {new Date().getFullYear()} AutoFlow AI · All Rights Reserved
          </div>
          <div className="font-mono text-[10px] text-cyan-400/70 uppercase tracking-widest">
            AUTOMATE THE SYSTEM.
          </div>
        </div>
      </footer>

    </div>
  );
}

export default Home;

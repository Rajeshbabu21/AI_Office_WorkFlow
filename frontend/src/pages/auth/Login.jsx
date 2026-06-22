import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, GitBranch, Shield, Key } from 'lucide-react';
import { login } from '../../api/authApi.jsx';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already logged in, redirect to homepage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020308] text-gray-300 flex flex-col justify-center items-center p-4 relative overflow-hidden bg-grid-pattern">
      {/* Background glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-950/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-950/15 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Brand logo at the top */}
      <div className="mb-8 flex items-center gap-3 relative z-10">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="relative w-10 h-10 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent"></div>
            <GitBranch className="w-6 h-6 text-blue-400 relative z-10" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            AutoFlow<span className="text-blue-400 font-mono font-medium ml-1">AI</span>
          </span>
        </Link>
      </div>

      {/* Login Box */}
      <div className="w-full max-w-md bg-[#090b16]/85 backdrop-blur-md border border-blue-500/15 rounded-2xl p-8 shadow-2xl relative z-10 glow-box-blue animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-xs text-gray-500 mt-2">
            Sign in to access the live ticket automation console and workflow pipelines
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Email Address</span>
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              className="w-full bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-3 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Password</span>
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-3 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white py-3.5 rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="mt-8 text-center text-xs border-t border-blue-500/5 pt-6">
          <span className="text-gray-500">Don't have an account? </span>
          <Link to="/signup" className="text-blue-400 font-semibold hover:underline transition-all">
            Register an account here
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center font-mono text-[10px] text-gray-600 uppercase tracking-widest relative z-10">
        Secure Zero-Trust System
      </div>
    </div>
  );
}

export default Login;

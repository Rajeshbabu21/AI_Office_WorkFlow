import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, GitBranch, Shield, Key, User, BookOpen, Layers, CheckCircle } from 'lucide-react';
import { register, login, loginWithGoogle } from '../../api/authApi.jsx';



function Signup() {
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('IT Support');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isFormFilled = fullName.trim() !== '' && 
                       employeeId.trim() !== '' && 
                       department.trim() !== '' && 
                       email.trim() !== '' && 
                       password.trim() !== '';

  // If already logged in, redirect to homepage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  // Load Google Client SDK dynamically
  useEffect(() => {
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const verifyWithGoogle = () => {
    if (!window.google) {
      setError('Google Sign-In SDK is not loaded. Please try again in a moment.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              // Fetch user's profile from Google userinfo API
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokenResponse.access_token}`
                }
              });
              
              if (!res.ok) {
                throw new Error('Failed to verify token with Google.');
              }
              
              const googleProfile = await res.json();
              const googleEmail = googleProfile.email;
              
              if (!googleEmail) {
                setError('Could not retrieve email from Google.');
                setLoading(false);
                return;
              }
              
              if (googleEmail.toLowerCase().trim() === email.toLowerCase().trim()) {
                setGoogleAccessToken(tokenResponse.access_token);
                setIsVerified(true);
                setSuccessMessage('Google email ownership verified successfully!');
              } else {
                setError('The Google account email does not match the email entered in the registration form.');
              }
            } catch (err) {
              console.error(err);
              setError('Failed to fetch user email from Google. Please try again.');
            } finally {
              setLoading(false);
            }
          } else {
            setLoading(false);
            setError('Google verification canceled or failed.');
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      setError('Failed to initialize Google verification client.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isVerified || !googleAccessToken) {
      setError('Please verify your email with Google first.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await register(email, password, fullName, department, employeeId, googleAccessToken);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
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

      {/* Register Box */}
      <div className="w-full max-w-md bg-[#090b16]/85 backdrop-blur-md border border-blue-500/15 rounded-2xl p-8 shadow-2xl relative z-10 glow-box-blue animate-fadeIn">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h2>
          <p className="text-xs text-gray-500 mt-2">
            Register a new agent/employee profile to access live automation traces
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Name</span>
            </label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isVerified}
              placeholder="e.g. John Doe"
              className="w-full bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Employee ID</span>
              </label>
              <input 
                type="text" 
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                disabled={isVerified}
                placeholder="EMP102"
                className="w-full bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Department</span>
              </label>
              <select 
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={isVerified}
                className="w-full bg-[#030409] border border-blue-500/15 focus:border-blue-400 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-all cursor-pointer disabled:opacity-60"
              >
                <option value="IT Support">IT Support</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Facilities">Facilities</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Email Address</span>
            </label>
            <div className="flex gap-2">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isVerified}
                placeholder="name@company.com"
                className="flex-1 bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-60"
              />
              {isVerified && (
                <span className="bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                  ✓ Verified
                </span>
              )}
            </div>
            {isVerified && (
              <div className="text-right mt-1">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsVerified(false);
                    setGoogleAccessToken('');
                    setSuccessMessage('');
                  }}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  Change email / Reset verification
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Password</span>
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isVerified}
              placeholder="••••••••"
              className="w-full bg-[#030409]/70 border border-blue-500/15 focus:border-blue-400 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-60"
            />
          </div>

          {!isVerified && (
            <div className="pt-2">
              <button
                type="button"
                disabled={!isFormFilled || loading}
                onClick={verifyWithGoogle}
                className="w-full py-3 px-4 font-bold text-sm bg-[#0a0f24] hover:bg-[#12193b] disabled:bg-[#04060d] disabled:text-gray-600 disabled:border-gray-800 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.1)]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify with Google</span>
                )}
              </button>
              <p className="text-[10px] text-gray-500 text-center mt-2">
                All fields are required. Fill out the form completely to enable verification.
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !isVerified}
            className="w-full font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white py-3 rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Register Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>




        {/* Switch Mode */}
        <div className="mt-6 text-center text-xs border-t border-blue-500/5 pt-4">
          <span className="text-gray-500">Already have an account? </span>
          <Link to="/login" className="text-blue-400 font-semibold hover:underline transition-all">
            Login here
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center font-mono text-[10px] text-gray-600 uppercase tracking-widest relative z-10">
        Secure Zero-Trust System
      </div>
    </div>
  );
}

export default Signup;

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, GitBranch, Shield } from 'lucide-react';
import { loginWithGoogle } from '../../api/authApi.jsx';

function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sdkLoading, setSdkLoading] = useState(true);
  const navigate = useNavigate();

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

    const initGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleCredentialResponse,
        });

        const btnElement = document.getElementById('google-login-btn');
        if (btnElement) {
          window.google.accounts.id.renderButton(
            btnElement,
            { theme: 'outline', size: 'large', width: '100%', text: 'signin_with' }
          );
          setSdkLoading(false);
        }
      }
    };

    script.addEventListener('load', initGoogleSignIn);
    if (window.google) {
      initGoogleSignIn();
    }

    return () => {
      script.removeEventListener('load', initGoogleSignIn);
    };
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError('');
    try {
      const googleToken = response.credential;
      const data = await loginWithGoogle(googleToken);

      if (data.registered) {
        navigate('/');
      } else {
        // Redirect to signup with state pre-filled
        navigate('/signup', {
          state: {
            googleToken,
            email: data.email,
            fullName: data.full_name
          }
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Google Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020503] text-gray-300 flex flex-col justify-center items-center p-4 relative overflow-hidden bg-grid-pattern">
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
      <div className="w-full max-w-md bg-[#050a06]/85 backdrop-blur-md border border-blue-500/15 rounded-2xl p-8 shadow-2xl relative z-10 glow-box-blue animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-xs text-gray-500 mt-2">
            Sign in using your Google account to access the live ticket automation console and workflow pipelines
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="py-4 flex flex-col items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-sm text-cyan-400 py-6">
              <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
              <span>Authenticating with AutoFlow...</span>
            </div>
          ) : (
            <div className="w-full relative">
              {sdkLoading && (
                <div className="w-full py-2.5 px-4 font-semibold text-sm bg-[#050a06] text-blue-400 border border-blue-500/10 rounded-lg flex items-center justify-center gap-2 animate-pulse absolute inset-0 z-10 pointer-events-none">
                  <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                  <span>Loading Sign-In...</span>
                </div>
              )}
              <div id="google-login-btn" className="flex justify-center w-full min-h-[44px]"></div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-950/10 border border-blue-500/5 rounded-lg flex gap-3 text-left">
          <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-gray-500 leading-normal">
            <span className="text-gray-400 font-semibold block mb-0.5">Enterprise Single Sign-On (SSO)</span>
            Access to this console requires authentication with a verified employee account. Google credentials are encrypted and verified directly.
          </div>
        </div>

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


import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import codeoLogo from '../assets/Logo.png';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isEmailVerified, loading } = useAuth();
  const [statusMsg, setStatusMsg] = useState('Finalizing authentication...');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let timer;
    const processAuth = async () => {
      try {
        // If code param exists in query, exchange code for session if needed
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.warn('OAuth code exchange note:', exchangeErr.message);
          }
        }

        // Check active session
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (session?.user) {
          setStatusMsg('Redirecting to dashboard...');
          timer = setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 600);
        } else {
          // Wait briefly in case AuthContext is updating
          timer = setTimeout(() => {
            if (user) {
              if (isEmailVerified) {
                navigate('/dashboard', { replace: true });
              } else {
                navigate('/verify-email', { replace: true });
              }
            } else if (!loading) {
              navigate('/signin', { replace: true });
            }
          }, 1200);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Authentication callback failed.');
        timer = setTimeout(() => {
          navigate('/signin', { replace: true });
        }, 2000);
      }
    };

    processAuth();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [user, isEmailVerified, loading, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center max-w-sm text-center">
        <img
          src={codeoLogo}
          alt="CodeO"
          className="h-12 w-auto mb-8 object-contain brightness-110"
        />

        {errorMsg ? (
          <div className="bg-red-950/80 border border-red-500/50 p-4 rounded-xl text-red-200 text-sm">
            {errorMsg}
          </div>
        ) : (
          <>
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <h2 className="font-serif italic text-2xl text-white mb-2">Connecting to CodeO</h2>
            <p className="font-sans text-xs text-neutral-400">{statusMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}

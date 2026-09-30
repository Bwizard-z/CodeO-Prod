import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../../hooks/useAuth';

export function GoogleSigninButton({
  text = 'Continue With Google',
  onError,
}) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignin = async () => {
    try {
      setLoading(true);
      const result = await signInWithGoogle();
      if (!result.success) {
        setLoading(false);
        if (onError) onError(result.error || 'Google login failed.');
      }
      // If success, Supabase initiates redirect automatically
    } catch (err) {
      setLoading(false);
      if (onError) onError(err.message || 'Google login failed.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignin}
      disabled={loading}
      className="w-full bg-white text-black py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-neutral-200 transition-all active:scale-98 shadow-md disabled:opacity-60 cursor-pointer select-none font-sans font-semibold text-sm"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-neutral-800">
          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span>Connecting to Google...</span>
        </div>
      ) : (
        <>
          <FontAwesomeIcon icon={faGoogle} className="text-lg text-[#4285F4]" />
          <span>{text}</span>
        </>
      )}
    </button>
  );
}

export default GoogleSigninButton;

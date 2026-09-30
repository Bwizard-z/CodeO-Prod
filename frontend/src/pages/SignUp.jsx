import React from 'react';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthCard from '../components/Auth/AuthCard';

export const SignUp = () => {
  const { signUp, signInWithGoogle, isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <AuthCard
          defaultMode="signup"
          onSignUp={signUp}
          onGoogleSignIn={signInWithGoogle}
        />
      </main>
      <Footer />
    </div>
  );
};

export default SignUp;

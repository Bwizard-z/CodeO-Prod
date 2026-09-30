import React from 'react';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthCard from '../components/Auth/AuthCard';

export const SignIn = () => {
  const { signIn, signInWithGoogle, isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-[#fbff47] selection:text-black">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <AuthCard
          defaultMode="signin"
          onSignIn={signIn}
          onGoogleSignIn={signInWithGoogle}
        />
      </main>
      <Footer />
    </div>
  );
};

export default SignIn;

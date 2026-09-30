import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes';

export function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#fbff47] selection:text-black">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;

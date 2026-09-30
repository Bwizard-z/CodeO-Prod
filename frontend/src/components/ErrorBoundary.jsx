// components/ErrorBoundary.jsx - React Error Boundary Component
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoDashboard = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#070a10] text-white p-4 select-none font-sans">
          <div className="max-w-md w-full bg-[#0c1018] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className="text-2xl font-serif italic text-white mb-2">Something went wrong</h2>
            <p className="text-neutral-400 font-sans text-xs mb-4 leading-relaxed">
              An unexpected render issue occurred while loading this room.
            </p>
            {this.state.error?.message && (
              <div className="bg-black/60 border border-white/10 rounded-lg p-3 mb-6 text-left overflow-auto max-h-28 text-[11px] font-mono text-red-300">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="bg-white text-black px-5 py-2.5 rounded-full font-sans font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
              >
                <FontAwesomeIcon icon={faRotateRight} />
                <span>Reload Page</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="bg-white/10 text-white hover:bg-white/20 px-5 py-2.5 rounded-full font-sans font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer border border-white/10 active:scale-95"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

import { useState, useEffect, useCallback } from 'react';
import { api, type AuthUser } from './api';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';

/**
 * Vortex Dashboard — App root.
 *
 * Routes between the auth screen (login/signup) and the post-auth
 * dashboard console based on the stored JWT token.
 */

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('vortex_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem('vortex_token'))
      .finally(() => setLoading(false));
  }, []);

  const handleAuthSuccess = useCallback((u: AuthUser) => {
    setUser(u);
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-gradient text-lg font-semibold animate-pulse">Vortex</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

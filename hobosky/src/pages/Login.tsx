/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Login Page
   ────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react';
import { IonPage, IonContent, IonButton, IonSpinner } from '@ionic/react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [service, setService] = useState('https://bsky.social');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!identifier.trim() || !password.trim()) {
        setError('Please fill in all fields');
        return;
      }
      setError('');
      setLoading(true);
      try {
        await login(identifier.trim(), password.trim(), service.trim() || undefined);
      } catch (err) {
        const msg = (err as Error).message || 'Login failed';
        if (msg.includes('Invalid identifier or password')) {
          setError('Invalid handle or app password. Please double-check your credentials.');
        } else if (msg.includes('AuthenticationRequired')) {
          setError('Authentication required. Make sure you are using an App Password.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [identifier, password, service, login]
  );

  return (
    <IonPage>
      <IonContent>
        <div className="login-container">
          <div className="login-logo">HoboSky</div>
          <div className="login-subtitle">A modern Bluesky client</div>

          <form className="login-form" onSubmit={handleLogin}>
            <input
              className="login-input"
              type="text"
              placeholder="Handle (e.g. user.bsky.social)"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
            />
            <input
              className="login-input"
              type="password"
              placeholder="App Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {showAdvanced && (
              <input
                className="login-input"
                type="url"
                placeholder="Service URL (default: https://bsky.social)"
                value={service}
                onChange={(e) => setService(e.target.value)}
              />
            )}

            {error && <div className="login-error">{error}</div>}

            <IonButton
              type="submit"
              expand="block"
              disabled={loading}
              style={{ '--border-radius': '12px', minHeight: 48, fontSize: 16 }}
            >
              {loading ? (
                <IonSpinner name="crescent" style={{ width: 20, height: 20 }} />
              ) : (
                'Sign In'
              )}
            </IonButton>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--hb-text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                textAlign: 'center',
                padding: 8,
              }}
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced options'}
            </button>

            <div className="login-hint">
              Use an{' '}
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
              >
                App Password
              </a>{' '}
              — not your main password.
              <br />
              Generate one at bsky.app → Settings → App Passwords.
            </div>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
}

"use client";

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { login, fetchCurrentUser } from '@/app/lib/api';
import styles from './page.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('from') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [checkingSession, setCheckingSession] = useState(true);
  const [showForgotNote, setShowForgotNote] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(() => router.replace(returnTo))
      .catch(() => setCheckingSession(false));
  }, [router, returnTo]);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email, password, rememberMe);
      router.replace(returnTo);
    } catch (err: any) {
      setError(err?.message || 'Email or password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><Shield size={20} /></div>
            <span className={styles.logoText}>አውራ AI</span>
          </div>
          <p className={styles.checkingText}>Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><Shield size={20} /></div>
          <span className={styles.logoText}>አውራ AI</span>
        </div>

        <h1 className={styles.title}>Sign in</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              placeholder="analyst@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
              autoComplete="email"
              autoFocus
            />
            {fieldErrors.email && <div className={styles.fieldError}>{fieldErrors.email}</div>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <div className={styles.inputWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputWithToggle} ${fieldErrors.password ? styles.inputError : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && <div className={styles.fieldError}>{fieldErrors.password}</div>}
          </div>

          <div className={styles.row}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <button
              type="button"
              className={styles.forgotLink}
              onClick={() => setShowForgotNote(v => !v)}
            >
              Forgot password?
            </button>
          </div>

          {showForgotNote && (
            <div className={styles.forgotNote}>
              Contact your SOC administrator to reset your password.
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><Shield size={20} /></div>
            <span className={styles.logoText}>አውራ AI</span>
          </div>
          <p className={styles.checkingText}>Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

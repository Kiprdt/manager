import { useState } from 'react';
import { useAuthStore } from '../../store/auth-store';
import styles from './AuthScreen.module.css';

export function AuthScreen() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, name.trim() || undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <h1 className={styles.logo}>LIFE MANAGER</h1>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabOn : ''}`}
            onClick={() => setMode('login')}
          >
            Вход
          </button>
          <button
            className={`${styles.tab} ${mode === 'register' ? styles.tabOn : ''}`}
            onClick={() => setMode('register')}
          >
            Регистрация
          </button>
        </div>

        {mode === 'register' && (
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя (необязательно)"
          />
        )}
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
        />
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Пароль"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        {err && <p className={styles.err}>{err}</p>}

        <button className={styles.submit} onClick={submit} disabled={busy || !email || !password}>
          {busy ? '…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </div>
    </div>
  );
}

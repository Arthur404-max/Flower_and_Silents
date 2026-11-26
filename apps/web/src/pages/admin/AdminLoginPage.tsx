import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, FlaskConical, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useAdminMe } from '../../hooks/useQueries';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminLogin } from '../../lib/api';
import { errorMessage } from '../../lib/errors';

export function AdminLoginPage() {
  useDocumentTitle('Вход администратора');
  const session = useAdminMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => adminLogin(email.trim(), password),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'me'], data);
      const state = location.state as { from?: unknown } | null;
      const from = typeof state?.from === 'string' && state.from.startsWith('/admin') ? state.from : '/admin';
      navigate(from, { replace: true });
    },
    onError: (requestError) => setError(errorMessage(requestError, 'Не удалось войти.')),
  });

  if (session.data) return <Navigate to="/admin" replace />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль.');
      return;
    }
    login.mutate();
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand"><Logo /><span>ЦветоТишина · демо</span></div>
        <p className="eyebrow">Панель управления</p>
        <h1>Спокойный вход<br /><em>в рабочую часть</em></h1>
        <p className="admin-login-description">Управление демо-каталогом, категориями и заказами.</p>
        <div className="admin-demo-warning"><FlaskConical size={21} aria-hidden="true" /><div><strong>Демонстрационный режим</strong><p>Используйте учётные данные из окружения проекта. Вход доступен только при запущенном API.</p></div></div>
        <form onSubmit={submit} className="admin-login-form">
          <label className="form-field"><span className="form-field-label">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="admin@example.ru" required disabled={login.isPending} /></label>
          <label className="form-field"><span className="form-field-label">Пароль</span><span className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Ваш пароль" aria-label="Пароль" required disabled={login.isPending} /><button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" className="button button-primary button-large button-full" disabled={login.isPending}>{login.isPending ? <><LoaderCircle className="spin" size={19} aria-hidden="true" /> Проверяем…</> : <>Войти в панель <ArrowRight size={18} aria-hidden="true" /></>}</button>
        </form>
        <p className="admin-login-footnote"><LockKeyhole size={14} aria-hidden="true" /> Сессия хранится в HttpOnly cookie. CSRF-токен не показывается в интерфейсе.</p>
      </section>
      <div className="admin-login-art" aria-hidden="true"><span>Flower2</span><div>Цветы<br />и тишина</div></div>
    </main>
  );
}

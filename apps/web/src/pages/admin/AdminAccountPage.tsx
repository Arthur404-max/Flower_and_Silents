import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAdminMe } from '../../hooks/useQueries';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { changeAdminPassword } from '../../lib/api';
import { errorMessage } from '../../lib/errors';

export function AdminAccountPage() {
  useDocumentTitle('Смена пароля');
  const session = useAdminMe();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => changeAdminPassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      showToast('Пароль изменён.', 'success');
    },
    onError: (requestError) => setError(errorMessage(requestError, 'Не удалось изменить пароль.')),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword) {
      setError('Заполните текущий и новый пароль.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Новый пароль и подтверждение не совпадают.');
      return;
    }
    change.mutate();
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><p className="eyebrow">Безопасность</p><h1>Смена пароля</h1><p>Обновление пароля администратора демо-проекта.</p></div></header>
      <div className="admin-account-grid">
        <section className="admin-panel admin-password-panel"><div className="password-panel-icon"><KeyRound size={26} /></div><h2>Новый пароль</h2><p>После изменения используйте новый пароль при следующем входе.</p><form className="admin-login-form" onSubmit={submit}><label className="form-field"><span className="form-field-label">Текущий пароль</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required disabled={change.isPending} /></label><label className="form-field"><span className="form-field-label">Новый пароль</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required disabled={change.isPending} /></label><label className="form-field"><span className="form-field-label">Повторите новый пароль</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required disabled={change.isPending} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="button button-primary" disabled={change.isPending}>{change.isPending ? <><LoaderCircle className="spin" size={17} /> Меняем пароль…</> : 'Изменить пароль'}</button></form></section>
        <aside className="admin-panel admin-session-panel"><ShieldCheck size={27} /><h2>Текущая сессия</h2><dl className="order-info-list"><div><dt>Имя</dt><dd>{session.data?.user.name}</dd></div><div><dt>Email</dt><dd>{session.data?.user.email}</dd></div><div><dt>Доступ</dt><dd>HttpOnly cookie</dd></div></dl><p className="form-hint">CSRF-токен хранится в памяти приложения и добавляется к мутациям автоматически.</p></aside>
      </div>
    </div>
  );
}

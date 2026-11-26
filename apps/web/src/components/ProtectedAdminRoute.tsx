import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAdminMe } from '../hooks/useQueries';
import { ErrorState, PageLoader } from './StateViews';

export function ProtectedAdminRoute() {
  const location = useLocation();
  const session = useAdminMe();

  if (session.isLoading) return <PageLoader label="Проверяем доступ администратора…" />;
  if (session.error) {
    if (session.error instanceof ApiError && [401, 403].includes(session.error.status)) {
      return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
    }
    return <div className="admin-access-error"><ErrorState error={session.error} title="Не удалось проверить сессию" onRetry={() => void session.refetch()} /></div>;
  }
  if (!session.data) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

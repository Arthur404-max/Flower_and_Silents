import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit3, LoaderCircle, Plus, Save } from 'lucide-react';
import { AdminDialog } from '../../components/admin/AdminDialog';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createAdminCategory, deactivateAdminCategory, getAdminCategories, updateAdminCategory } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { slugify } from '../../lib/format';
import type { AdminCategory, CategoryInput } from '../../types';

export function AdminCategoriesPage() {
  useDocumentTitle('Категории');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<AdminCategory | null | undefined>(undefined);
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: ({ signal }) => getAdminCategories(signal) });
  const deactivate = useMutation({
    mutationFn: deactivateAdminCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showToast('Категория деактивирована.', 'success');
    },
    onError: (error) => showToast(errorMessage(error, 'Не удалось деактивировать категорию.'), 'error'),
  });

  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><p className="eyebrow">Структура каталога</p><h1>Категории</h1><p>Названия, адреса разделов и порядок показа на витрине.</p></div><button type="button" className="button button-primary" onClick={() => setEditing(null)}><Plus size={17} /> Добавить категорию</button></header>
      {categories.isLoading ? <div className="admin-loading-block" role="status">Загружаем категории…</div> : categories.error ? <ErrorState error={categories.error} onRetry={() => void categories.refetch()} /> : categories.data?.length ? (
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Название</th><th>Slug</th><th>Порядок</th><th><span className="sr-only">Действия</span></th></tr></thead><tbody>{categories.data.map((category) => (
          <tr key={category.id}><td><strong>{category.name}</strong>{!category.isActive && <span className="table-secondary">Неактивна</span>}</td><td><code>{category.slug}</code></td><td>{category.sortOrder}</td><td><div className="table-actions"><button type="button" className="icon-button" onClick={() => setEditing(category)} aria-label={`Редактировать ${category.name}`}><Edit3 size={17} /></button><button type="button" className="icon-button icon-button-danger" disabled={!category.isActive || deactivate.isPending} onClick={() => { if (window.confirm(`Деактивировать категорию «${category.name}»?`)) deactivate.mutate(category.id); }} aria-label={`Деактивировать ${category.name}`}><Archive size={17} /></button></div></td></tr>
        ))}</tbody></table></div>
      ) : <EmptyState title="Категорий пока нет" description="Добавьте первую категорию, чтобы наполнить каталог." action={<button type="button" className="button button-secondary" onClick={() => setEditing(null)}><Plus size={17} /> Добавить категорию</button>} />}
      {editing !== undefined && <CategoryEditor key={editing?.id ?? 'new'} category={editing} onClose={() => setEditing(undefined)} onSaved={() => { queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditing(undefined); }} />}
    </div>
  );
}

function CategoryEditor({ category, onClose, onSaved }: { category: AdminCategory | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const input: CategoryInput = { name: name.trim(), slug: slug.trim(), sortOrder: Number(sortOrder) };
      return category ? updateAdminCategory(category.id, input) : createAdminCategory(input);
    },
    onSuccess: () => {
      showToast(category ? 'Категория обновлена.' : 'Категория создана.', 'success');
      onSaved();
    },
    onError: (requestError) => setError(errorMessage(requestError, 'Не удалось сохранить категорию.')),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !slug.trim() || !Number.isInteger(Number(sortOrder))) {
      setError('Заполните название, slug и целочисленный порядок.');
      return;
    }
    save.mutate();
  };

  return (
    <AdminDialog title={category ? 'Редактировать категорию' : 'Новая категория'} onClose={onClose}>
      <form className="admin-editor-form" onSubmit={submit}>
        <div className="admin-editor-scroll admin-category-form">
          <label className="form-field"><span className="form-field-label">Название</span><input value={name} onChange={(event) => { setName(event.target.value); if (!category) setSlug(slugify(event.target.value)); }} required autoFocus /></label>
          <label className="form-field"><span className="form-field-label">Slug</span><input value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9-]+" placeholder="peonies" required /><small className="form-hint">Латинские буквы, цифры и дефис</small></label>
          <label className="form-field"><span className="form-field-label">Порядок</span><input type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
        <div className="admin-dialog-footer"><button type="button" className="button button-ghost" onClick={onClose}>Отмена</button><button type="submit" className="button button-primary" disabled={save.isPending}>{save.isPending ? <><LoaderCircle className="spin" size={17} /> Сохраняем…</> : <><Save size={17} /> Сохранить</>}</button></div>
      </form>
    </AdminDialog>
  );
}

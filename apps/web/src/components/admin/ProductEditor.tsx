import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle, Save, Upload } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { createAdminProduct, updateAdminProduct, uploadAdminImage } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { kopecksToInput } from '../../lib/format';
import type { AdminProduct, AdminProductInput, Category } from '../../types';
import { AdminDialog } from './AdminDialog';
import { SmartImage } from '../SmartImage';

interface ProductForm {
  name: string;
  categoryId: string;
  description: string;
  composition: string;
  size: string;
  price: string;
  oldPrice: string;
  stock: string;
  badge: string;
  imageUrl: string;
}

function initialForm(product: AdminProduct | null, categories: Category[]): ProductForm {
  return {
    name: product?.name ?? '',
    categoryId: product?.categoryId ?? categories[0]?.id ?? '',
    description: product?.description ?? '',
    composition: product?.composition ?? '',
    size: product?.size ?? '',
    price: kopecksToInput(product?.price ?? null),
    oldPrice: kopecksToInput(product?.oldPrice ?? null),
    stock: String(product?.stock ?? 0),
    badge: product?.badge ?? '',
    imageUrl: product?.imageUrl ?? '',
  };
}

export function ProductEditor({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: AdminProduct | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (product: AdminProduct) => void;
}) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProductForm>(() => initialForm(product, categories));
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: ({ imageUrl }) => {
      setForm((current) => ({ ...current, imageUrl }));
      showToast('Изображение загружено.', 'success');
    },
    onError: (requestError) => showToast(errorMessage(requestError, 'Не удалось загрузить изображение.'), 'error'),
  });
  const save = useMutation({
    mutationFn: async () => {
      const input: AdminProductInput = {
        name: form.name.trim(),
        categoryId: form.categoryId,
        description: form.description.trim(),
        composition: form.composition.trim(),
        size: form.size.trim(),
        price: Number(form.price),
        oldPrice: form.oldPrice.trim() ? Number(form.oldPrice) : null,
        stock: Number(form.stock),
        badge: form.badge.trim() || null,
        imageUrl: form.imageUrl.trim(),
      };
      return product ? updateAdminProduct(product.id, input, product.version) : createAdminProduct(input);
    },
    onSuccess: (savedProduct) => {
      showToast(product ? 'Товар обновлён.' : 'Товар создан.', 'success');
      onSaved(savedProduct);
    },
    onError: (requestError) => setError(errorMessage(requestError, 'Не удалось сохранить товар.')),
  });

  const update = (key: keyof ProductForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = form.price.trim() ? Number(form.price) : null;
    const oldPrice = form.oldPrice.trim() ? Number(form.oldPrice) : null;
    const stock = Number(form.stock);
    if (!form.name.trim() || !form.categoryId || !form.composition.trim() || !form.size.trim()) {
      setError('Заполните название, категорию, состав и размер.');
      return;
    }
    if (price === null || !Number.isInteger(price) || price < 0) {
      setError('Укажите корректную целую цену в рублях.');
      return;
    }
    if (oldPrice !== null && (!Number.isInteger(oldPrice) || oldPrice < 0)) {
      setError('Проверьте старую цену в рублях.');
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError('Остаток должен быть целым неотрицательным числом.');
      return;
    }
    if (!form.imageUrl.trim()) {
      setError('Добавьте изображение или URL изображения.');
      return;
    }
    save.mutate();
  };

  return (
    <AdminDialog title={product ? 'Редактировать товар' : 'Новый товар'} description="Цены вводятся в рублях." onClose={onClose} wide>
      <form className="admin-editor-form" onSubmit={submit}>
        <div className="admin-editor-scroll">
          <div className="admin-product-editor-grid">
            <div className="admin-editor-fields">
              <label className="form-field form-field-wide"><span className="form-field-label">Название</span><input value={form.name} onChange={(event) => update('name', event.target.value)} required autoFocus /></label>
              <label className="form-field"><span className="form-field-label">Категория</span><select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} required><option value="" disabled>Выберите категорию</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="form-field"><span className="form-field-label">Размер</span><input value={form.size} onChange={(event) => update('size', event.target.value)} placeholder="Например, M" required /></label>
              <label className="form-field form-field-wide"><span className="form-field-label">Описание</span><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows={3} /></label>
              <label className="form-field form-field-wide"><span className="form-field-label">Состав</span><textarea value={form.composition} onChange={(event) => update('composition', event.target.value)} rows={3} required /></label>
              <label className="form-field"><span className="form-field-label">Цена, ₽</span><input type="number" min="0" step="1" inputMode="decimal" value={form.price} onChange={(event) => update('price', event.target.value)} required /></label>
              <label className="form-field"><span className="form-field-label">Старая цена, ₽</span><input type="number" min="0" step="1" inputMode="decimal" value={form.oldPrice} onChange={(event) => update('oldPrice', event.target.value)} /></label>
              <label className="form-field"><span className="form-field-label">Остаток</span><input type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={(event) => update('stock', event.target.value)} required /></label>
              <label className="form-field"><span className="form-field-label">Badge</span><input value={form.badge} onChange={(event) => update('badge', event.target.value)} placeholder="Необязательно" /></label>
            </div>
            <div className="admin-image-editor">
              <div className="admin-image-preview">{form.imageUrl ? <SmartImage src={form.imageUrl} alt="Предпросмотр товара" /> : <span><ImagePlus size={30} aria-hidden="true" />Изображение не добавлено</span>}</div>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} aria-label="Файл изображения" />
              <button type="button" className="button button-secondary button-full" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>{upload.isPending ? <><LoaderCircle className="spin" size={17} /> Загружаем…</> : <><Upload size={17} /> Загрузить изображение</>}</button>
              <label className="form-field"><span className="form-field-label">URL изображения</span><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="/images/roses.jpg" /></label>
              <p className="form-hint">Multipart-поле: <code>image</code>. После загрузки URL появится автоматически.</p>
            </div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
        <div className="admin-dialog-footer"><button type="button" className="button button-ghost" onClick={onClose} disabled={save.isPending}>Отмена</button><button type="submit" className="button button-primary" disabled={save.isPending || upload.isPending}>{save.isPending ? <><LoaderCircle className="spin" size={17} /> Сохраняем…</> : <><Save size={17} /> Сохранить товар</>}</button></div>
      </form>
    </AdminDialog>
  );
}

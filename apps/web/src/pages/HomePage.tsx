import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowRight, Flower2, Leaf, MessageCircle, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoNotice } from '../components/DemoNotice';
import { ProductGrid } from '../components/ProductGrid';
import { SectionHeading } from '../components/StateViews';
import { SmartImage } from '../components/SmartImage';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStoreConfig } from '../hooks/useQueries';
import { getCategories, getProducts } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { categoryImage } from '../lib/products';

const benefits = [
  {
    icon: Leaf,
    title: 'Состав без догадок',
    text: 'Цветы, размер и детали букета собраны в одной карточке.',
  },
  {
    icon: WalletCards,
    title: 'Стоимость заранее',
    text: 'Сервер пересчитывает корзину до создания демо-заказа.',
  },
  {
    icon: MessageCircle,
    title: 'Можно оставить заметку',
    text: 'Добавьте комментарий и укажите, нужны ли приборы.',
  },
  {
    icon: ShieldCheck,
    title: 'Спокойный сценарий',
    text: 'Понятные шаги от выбора букета до статуса заказа.',
  },
];

export function HomePage() {
  useDocumentTitle('Цветы и тишина рядом');
  const config = useStoreConfig();
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 5 * 60 * 1000,
  });
  const products = useQuery({
    queryKey: ['products', { sort: 'popular', limit: 8 }],
    queryFn: ({ signal }) => getProducts({ sort: 'popular', limit: 8 }, signal),
  });
  const categoryList = categories.data ?? [];

  return (
    <>
      <section className="hero section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker"><span /> Цветы · настроение · пауза</p>
            <h1>Цветы, после которых становится <em>тише</em></h1>
            <p className="hero-description">Букеты для неспешных моментов. Выберите настроение, а детали и стоимость мы соберём в понятном порядке.</p>
            <div className="hero-actions">
              <Link to="/catalog" className="button button-primary button-large">Выбрать букет <ArrowRight size={19} aria-hidden="true" /></Link>
              <Link to="/how-it-works" className="button button-ghost button-large">Как это работает <ArrowDownRight size={18} aria-hidden="true" /></Link>
            </div>
            <div className="hero-footnote"><Flower2 size={18} aria-hidden="true" /><span>Демо-каталог из реального API · без выдуманных отзывов</span></div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-frame">
              <SmartImage src="/images/hero.jpg" alt="Спокойная флористическая композиция" loading="eager" fetchPriority="high" />
              <span className="hero-image-label"><Sparkles size={16} aria-hidden="true" /> Немного тишины в букете</span>
            </div>
            <div className="hero-seal" aria-hidden="true"><FlowerMarkDecoration /></div>
          </div>
        </div>
      </section>

      <div className="container">
        <DemoNotice config={config.data} />
      </div>

      <section className="section categories-section">
        <div className="container">
          <SectionHeading
            eyebrow="По настроению"
            title="Категории"
            description="Начните с того, что хочется подарить или поставить рядом."
            action={<Link to="/catalog" className="text-link">Смотреть всё <ArrowRight size={17} aria-hidden="true" /></Link>}
          />
          {categories.isLoading ? (
            <div className="category-grid" aria-label="Загрузка категорий" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton-category" key={index} />)}
            </div>
          ) : categories.error ? (
            <div className="inline-error" role="alert">Не удалось загрузить категории: {errorMessage(categories.error)} <button type="button" onClick={() => void categories.refetch()}>Повторить</button></div>
          ) : categoryList.length > 0 ? (
            <div className="category-grid">
              {categoryList.map((category, index) => (
                <Link key={category.id} to={`/catalog?category=${encodeURIComponent(category.slug)}`} className={`category-card category-card-${index % 3}`}>
                  <SmartImage src={categoryImage(category)} alt="" loading="lazy" />
                  <span className="category-shade" />
                  <span className="category-card-content"><small>{String(index + 1).padStart(2, '0')}</small><strong>{category.name}</strong><ArrowRight size={20} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-copy">Категории появятся после заполнения демо-каталога.</p>
          )}
        </div>
      </section>

      <section className="section selection-section">
        <div className="container">
          <SectionHeading
            eyebrow="Из каталога"
            title="Наш выбор"
            description="Букеты и наборы, которые сейчас доступны в демо-витрине."
            action={<Link to="/catalog" className="button button-secondary">Весь каталог <ArrowRight size={17} aria-hidden="true" /></Link>}
          />
          <ProductGrid products={products.data?.items ?? []} isLoading={products.isLoading} error={products.error} onRetry={() => void products.refetch()} />
        </div>
      </section>

      <section className="section benefits-section">
        <div className="container">
          <SectionHeading eyebrow="Просто и прозрачно" title="Меньше суеты. Больше внимания к деталям." />
          <div className="benefits-grid">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article className="benefit-card" key={title}>
                <span className="benefit-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function FlowerMarkDecoration() {
  return (
    <svg viewBox="0 0 100 100" fill="none">
      <path d="M50 80V46M50 66c-14 0-24-10-24-24 14 0 24 10 24 24Zm0-10c0-14 10-24 24-24 0 14-10 24-24 24Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 44c-10-5-13-15-7-22 8 5 13 14 7 22Zm0 0c5-10 15-13 22-7-5 8-14 13-22 7Z" fill="currentColor" opacity=".75" />
    </svg>
  );
}

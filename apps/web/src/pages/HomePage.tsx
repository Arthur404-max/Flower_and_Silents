import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@cvetotishina/shared';
import { ArrowRight, Flower2, Leaf, Mail, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    text: 'Цветы, высота и фактура букета собраны в одной карточке — без сюрпризов при получении.',
  },
  {
    icon: WalletCards,
    title: 'Прозрачная стоимость',
    text: 'Цена букетов и доставки рассчитывается заранее, до создания заказа.',
  },
  {
    icon: Mail,
    title: 'Открытка с подписью',
    text: 'Вложим плотную хлопковую открытку с вашими словами и аккуратно подпишем от руки.',
  },
  {
    icon: ShieldCheck,
    title: 'Спокойный сценарий',
    text: 'Понятные шаги от выбора композиции до отслеживания статуса сборки и доставки.',
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
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker"><span /> Флористическая мастерская</p>
            <h1>Цветы, после которых становится <em>тише</em></h1>
            <p className="hero-description">
              Собираем воздушные букеты для неспешных моментов. Выберите настроение, а состав, бережную упаковку и доставку мы возьмём на себя.
            </p>
            <div className="hero-actions">
              <Link to="/catalog" className="button button-primary button-large">
                Выбрать букет <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/how-it-works" className="button button-secondary button-large">
                Как это работает
              </Link>
            </div>
            <div className="hero-meta">
              <div>
                <strong>{config.data ? `От ${formatMoney(config.data.freeDeliveryFrom)}` : 'Бесплатно'}</strong>
                <span>бесплатная доставка по городу</span>
              </div>
              <span className="hero-meta-divider" aria-hidden="true" />
              <div>
                <strong>Вручную к заказу</strong>
                <span>свежая срезка и актуальный состав</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <figure className="hero-image-frame">
              <SmartImage
                src="/images/hero.jpg"
                alt="Воздушная флористическая композиция из светлых пионов и ранункулюсов в керамической вазе"
                loading="eager"
                fetchPriority="high"
              />
              <figcaption className="hero-caption">
                <Flower2 size={14} aria-hidden="true" />
                <span>Сезонная коллекция · утренний свет</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section categories-section">
        <div className="container">
          <SectionHeading
            eyebrow="По настроению"
            title="Категории"
            description="Начните с оттенка, фактуры или повода — от нежных пионов до лаконичных сухоцветов."
            action={<Link to="/catalog" className="text-link">Смотреть всё <ArrowRight size={16} aria-hidden="true" /></Link>}
          />
          {categories.isLoading ? (
            <div className="category-grid" aria-label="Загрузка категорий" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => <div className="skeleton skeleton-category" key={index} />)}
            </div>
          ) : categories.error ? (
            <div className="inline-error" role="alert">
              Не удалось загрузить категории: {errorMessage(categories.error)}{' '}
              <button type="button" onClick={() => void categories.refetch()}>Повторить</button>
            </div>
          ) : categoryList.length > 0 ? (
            <div className="category-grid">
              {categoryList.map((category, index) => (
                <Link
                  key={category.id}
                  to={`/catalog?category=${encodeURIComponent(category.slug)}`}
                  className="category-card"
                >
                  <SmartImage src={categoryImage(category)} alt="" loading="lazy" />
                  <span className="category-shade" />
                  <span className="category-card-content">
                    <small>{String(index + 1).padStart(2, '0')}</small>
                    <strong>{category.name}</strong>
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-copy">Категории появятся после добавления в каталог.</p>
          )}
        </div>
      </section>

      <section className="section selection-section">
        <div className="container">
          <SectionHeading
            eyebrow="Из каталога"
            title="Наш выбор"
            description="Букеты и подарочные наборы, доступные к сборке сегодня."
            action={<Link to="/catalog" className="button button-secondary">Весь каталог <ArrowRight size={16} aria-hidden="true" /></Link>}
          />
          <ProductGrid
            products={products.data?.items ?? []}
            isLoading={products.isLoading}
            error={products.error}
            onRetry={() => void products.refetch()}
          />
        </div>
      </section>

      <section className="section atelier-section">
        <div className="container">
          <div className="atelier-grid">
            <div className="atelier-photo">
              <SmartImage
                src="/images/atelier.jpg"
                alt="Флорист перевязывает букет из кремовых роз и пионов шёлковой лентой в мастерской"
                loading="lazy"
              />
            </div>
            <div className="atelier-copy">
              <p className="eyebrow">О мастерской</p>
              <h2>Каждый букет собираем вручную, <em>без спешки</em></h2>
              <p>
                Мы не держим готовые букеты на витрине по несколько дней. Флорист подбирает свежие стебли под ваш заказ, оборачивает их в матовую бумагу и перевязывает шёлковой или льняной лентой.
              </p>
              <div className="atelier-terms">
                <div>
                  <span className="atelier-term-label">Доставка</span>
                  <strong>{config.data ? formatMoney(config.data.deliveryFee) : 'По тарифу'}</strong>
                  <small>{config.data ? `Бесплатно от ${formatMoney(config.data.freeDeliveryFrom)}` : 'Бережно в аквабоксе'}</small>
                </div>
                <div>
                  <span className="atelier-term-label">Самовывоз</span>
                  <strong>Бесплатно</strong>
                  <small>{config.data?.address ?? 'Ежедневно с 09:00 до 21:00'}</small>
                </div>
              </div>
              <Link to="/how-it-works" className="text-link">
                Подробнее о доставке и оформлении <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section benefits-section">
        <div className="container">
          <SectionHeading
            eyebrow="Просто и прозрачно"
            title="Меньше суеты. Больше внимания к деталям."
          />
          <div className="benefits-grid">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article className="benefit-card" key={title}>
                <span className="benefit-icon"><Icon size={21} strokeWidth={1.6} aria-hidden="true" /></span>
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

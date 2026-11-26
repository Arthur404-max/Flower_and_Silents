import { ArrowRight, Check, CreditCard, Flower2, MapPin, PackageCheck, ShoppingBag, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoNotice } from '../components/DemoNotice';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStoreConfig } from '../hooks/useQueries';

const steps = [
  {
    icon: Flower2,
    number: '01',
    title: 'Выберите букет',
    text: 'Откройте каталог, найдите нужную категорию или воспользуйтесь поиском. В карточке есть состав, размер, цена и доступный остаток.',
  },
  {
    icon: ShoppingBag,
    number: '02',
    title: 'Соберите корзину',
    text: 'Добавьте букеты и измените количество. Корзина хранится в браузере, поэтому не исчезнет при переходе между страницами.',
  },
  {
    icon: MapPin,
    number: '03',
    title: 'Укажите способ получения',
    text: 'На оформлении выберите самовывоз или доставку. Для доставки понадобится адрес. Контакты и адрес магазина появятся, когда их добавят в настройки.',
  },
  {
    icon: CreditCard,
    number: '04',
    title: 'Создайте заказ',
    text: 'Стоимость пересчитается перед оформлением. После создания заказа на его странице будет доступно подтверждение оплаты.',
  },
  {
    icon: PackageCheck,
    number: '05',
    title: 'Следите за статусом',
    text: 'После создания откроется страница заказа с составом, суммами и историей статуса. Доступ к ней сохраняется на этом устройстве.',
  },
];

export function HowItWorksPage() {
  useDocumentTitle('Как это работает');
  const config = useStoreConfig();

  return (
    <div className="how-page">
      <section className="page-intro page-intro-how section-small">
        <div className="container">
          <p className="eyebrow">Понятный сценарий</p>
          <h1>От выбора до <em>тишины</em></h1>
          <p>Пять понятных шагов от выбора букета до отслеживания заказа.</p>
        </div>
      </section>
      <div className="container"><DemoNotice config={config.data} /></div>
      <section className="section">
        <div className="container how-steps">
          {steps.map(({ icon: Icon, number, title, text }) => (
            <article className="how-step" key={number}>
              <div className="how-step-number">{number}</div>
              <div className="how-step-content"><span className="benefit-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span><h2>{title}</h2><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="section container">
        <div className="delivery-explainer">
          <div><Store size={28} strokeWidth={1.5} aria-hidden="true" /><h2>Самовывоз</h2><p>Адрес и часы работы не указаны: контакты будут добавлены. До оформления можно проверить состав и стоимость заказа.</p></div>
          <div><MapPin size={28} strokeWidth={1.5} aria-hidden="true" /><h2>Доставка</h2><p>Тариф и порог бесплатной доставки берутся из настроек магазина.</p></div>
          <div><Check size={28} strokeWidth={1.5} aria-hidden="true" /><h2>Проверка итога</h2><p>Стоимость букетов, доставки и возможного сервисного сбора показывается после пересчёта.</p></div>
        </div>
        <div className="how-cta"><div><p className="eyebrow">Начните с каталога</p><h2>Какой букет напоминает вам о паузе?</h2></div><Link to="/catalog" className="button button-primary button-large">Выбрать букет <ArrowRight size={18} aria-hidden="true" /></Link></div>
      </section>
    </div>
  );
}

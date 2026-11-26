import { ArrowLeft, Flower2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Страница не найдена');
  return (
    <section className="not-found section">
      <div className="container">
        <span className="not-found-flower"><Flower2 size={46} strokeWidth={1.3} aria-hidden="true" /></span>
        <p className="eyebrow">404</p>
        <h1>Здесь больше нет <em>букетов</em></h1>
        <p>Возможно, страница переехала или ссылка больше не действует.</p>
        <Link to="/" className="button button-primary"><ArrowLeft size={17} aria-hidden="true" /> Вернуться на главную</Link>
      </div>
    </section>
  );
}

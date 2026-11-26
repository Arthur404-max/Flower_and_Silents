import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The public fallback deliberately does not expose internals.
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="fatal-error">
        <span className="state-icon"><AlertCircle size={28} aria-hidden="true" /></span>
        <h1>Страница устала</h1>
        <p>Произошла непредвиденная ошибка. Обновите страницу — сохранённая корзина останется на устройстве.</p>
        <button type="button" className="button button-primary" onClick={() => window.location.reload()}><RefreshCw size={17} aria-hidden="true" /> Обновить страницу</button>
      </main>
    );
  }
}

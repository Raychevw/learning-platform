import { Component } from 'react';

/**
 * Запобігає «білому екрану»: будь-яка помилка рендеру показує зрозуміле
 * повідомлення з можливістю оновити сторінку.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[STUDEVO UI]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-error-screen">
        <div className="app-error-card">
          <span className="app-error-badge">STUDEVO</span>
          <h1>Щось пішло не так</h1>
          <p>
            Інтерфейс зіткнувся з непередбаченою помилкою. Ваші дані збережені на сервері —
            оновіть сторінку, щоб продовжити роботу.
          </p>
          <pre>{String(this.state.error?.message || this.state.error)}</pre>
          <div className="app-error-actions">
            <button type="button" className="btn-studevo-primary" onClick={() => window.location.reload()}>
              Оновити сторінку
            </button>
            <button
              type="button"
              className="btn-studevo-secondary"
              onClick={() => this.setState({ error: null })}
            >
              Спробувати ще раз
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import React from 'react';

// Composant ErrorBoundary pour capturer les erreurs d'exécution dans l'arbre React
class ErrorBoundary extends React.Component<{
  children: React.ReactNode
}, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    // Met à jour l'état pour afficher l'UI de repli
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log l’erreur (console ou service externe comme Sentry)
    console.error('Erreur capturée par ErrorBoundary :', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // UI de repli personnalisée et plus claire
      return (
        <div style={{ color: '#b91c1c', textAlign: 'center', margin: '2rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '2rem' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oups, une erreur inattendue est survenue.</h2>
          <p style={{ marginBottom: '1rem' }}>
            Nous sommes désolés pour la gêne occasionnée.<br />
            Essayez de rafraîchir la page ou de revenir plus tard.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            Si le problème persiste, contactez le support&nbsp;:
            <a href="mailto:admin@fermestandre.com" style={{ color: '#b91c1c', textDecoration: 'underline', marginLeft: 4 }}>support@votreprojet.com</a>
          </p>
          <button onClick={() => window.location.reload()} style={{ background: '#b91c1c', color: 'white', border: 'none', borderRadius: 4, padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary; 
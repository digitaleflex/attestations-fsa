"use client";

// This component renders when an error bubbles up to the root level
// It must be a Client Component and render its own <html> and <body> tags

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <head>
        <title>Erreur - FSA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .error-card {
            background: white;
            border-radius: 1rem;
            padding: 3rem 2rem;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
          }
          h1 {
            font-size: 2.5rem;
            font-weight: 900;
            color: #dc2626;
            margin-bottom: 1rem;
          }
          p {
            color: #64748b;
            font-size: 1.125rem;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          button {
            padding: 0.875rem 2.5rem;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
          }
          .error-code {
            display: inline-block;
            background: #f1f5f9;
            padding: 0.5rem 1rem;
            border-radius: 0.375rem;
            font-family: monospace;
            font-size: 0.875rem;
            color: #475569;
            margin-bottom: 1.5rem;
          }
        `}</style>
      </head>
      <body>
        <div className="error-card">
          <h1>Erreur Système</h1>
          {error.digest && (
            <div className="error-code">Code: {error.digest}</div>
          )}
          <p>
            {error.message || 'Une erreur inattendue est survenue. Veuillez réessayer ou contacter le support technique.'}
          </p>
          <button onClick={() => reset()}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

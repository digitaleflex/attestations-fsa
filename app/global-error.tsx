"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '900', color: '#dc2626', margin: 0 }}>Erreur</h1>
            <p style={{ color: '#64748b', marginTop: '1rem' }}>{error.message || 'Une erreur inattendue est survenue'}</p>
            <button onClick={() => reset()} style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}>Reessayer</button>
          </div>
        </div>
      </body>
    </html>
  );
}

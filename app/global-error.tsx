"use client";

// Minimal global error boundary - MUST use "use client" per Next.js spec
// This component cannot use any hooks or context to avoid static generation errors

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return ({
    type: "html",
    props: {
      lang: "fr",
      children: [
        {
          type: "head",
          props: {
            children: [
              { type: "title", props: { children: "Erreur - FSA" } },
              {
                type: "style",
                props: {
                  dangerouslySetInnerHTML: {
                    __html: "body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}div{text-align:center;background:#fff;padding:3rem 2rem;border-radius:1rem;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);max-width:500px}h1{font-size:2.5rem;font-weight:900;color:#dc2626;margin:0 0 1rem}p{color:#64748b;font-size:1.125rem;margin-bottom:2rem}button{padding:.875rem 2.5rem;background:#3b82f6;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer}"
                  }
                }
              }
            ]
          }
        },
        {
          type: "body",
          props: {
            children: {
              type: "div",
              props: {
                children: [
                  { type: "h1", props: { children: "Erreur Système" } },
                  error.digest ? { type: "p", props: { style: { fontFamily: "monospace", fontSize: ".875rem", color: "#475569", background: "#f1f5f9", padding: ".5rem 1rem", borderRadius: ".375rem", display: "inline-block", marginBottom: "1.5rem" }, children: `Code: ${error.digest}` } } : null,
                  { type: "p", props: { children: error.message || "Une erreur inattendue est survenue. Veuillez réessayer ou contacter le support technique." } },
                  { type: "button", props: { onClick: reset, children: "Réessayer" } }
                ]
              }
            }
          }
        }
      ]
    }
  } as any);
}

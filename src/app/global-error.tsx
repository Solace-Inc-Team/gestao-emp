"use client";

// último recurso: falhou o próprio layout, então não dá para contar com o CSS do app
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>O sistema está com um problema</h1>
          <p style={{ color: "#666", lineHeight: 1.5 }}>A equipe da Solace já foi avisada. Tente de novo em alguns instantes.</p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: 0, background: "#171717", color: "#fff", cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}

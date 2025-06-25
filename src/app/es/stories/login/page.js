"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const referrer = searchParams.get("ref") || "";

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Inicia sesión</h1>
      <p>
        {referrer && (
          <>
            Has sido redirigido desde: <strong>{referrer}</strong>
          </>
        )}
      </p>
      {/* Replace with your actual login form */}
      <form>
        <input type="email" placeholder="Correo electrónico" />
        <input type="password" placeholder="Contraseña" />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

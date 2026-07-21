"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApiError } from "@/presentation/api/client";
import { iniciarSesion } from "@/presentation/api/auth";
import { LoginForm } from "@/presentation/components/presenters/auth/LoginForm";
import {
  MENSAJE_ERROR_GENERICO,
  puedeIniciar,
  redirectSeguro,
} from "@/presentation/components/presenters/auth/login";
import { landingPara } from "@/presentation/components/presenters/nav/nav";

/**
 * Container del login (R1.1, R1.5). Envía las credenciales, y en éxito redirige
 * al destino saneado (`redirect` del querystring, solo rutas internas) usando
 * una recarga dura para que el middleware vea la nueva cookie de sesión.
 */
export function LoginContainer() {
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!puedeIniciar(usuario, clave)) return;
    setProcesando(true);
    setError(null);
    try {
      const user = await iniciarSesion(usuario.trim(), clave);
      // `redirect` explícito (venías de una ruta protegida) manda; si no, cada
      // rol aterriza en su pantalla principal.
      const pedido = searchParams.get("redirect");
      const destino = pedido
        ? redirectSeguro(pedido)
        : landingPara(user);
      // Recarga dura: el middleware (edge) debe leer la cookie recién fijada.
      window.location.assign(destino);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : MENSAJE_ERROR_GENERICO);
      setProcesando(false);
    }
  }, [usuario, clave, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm
        usuario={usuario}
        clave={clave}
        onUsuario={setUsuario}
        onClave={setClave}
        onSubmit={submit}
        puedeEnviar={puedeIniciar(usuario, clave)}
        procesando={procesando}
        error={error}
      />
    </main>
  );
}

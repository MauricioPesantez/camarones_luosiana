import { Suspense } from "react";

import { LoginContainer } from "@/presentation/components/containers/LoginContainer";

/**
 * Ruta pública de login (R1.1, R1.5). Destino de las redirecciones del
 * middleware cuando no hay sesión válida. `useSearchParams` (dentro del
 * container) exige un límite de Suspense en el App Router.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContainer />
    </Suspense>
  );
}

import { CajaContainer } from "@/presentation/components/containers/CajaContainer";

/**
 * Ruta de caja y cierre (R10, R11, R13). El middleware (Tarea 17) restringe el
 * acceso al rol admin; el container revalida la sesión y renderiza la apertura
 * o la jornada abierta según el estado de caja.
 */
export default function CajaPage() {
  return <CajaContainer />;
}

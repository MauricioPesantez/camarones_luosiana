import { CobroContainer } from "@/presentation/components/containers/CobroContainer";

/**
 * Ruta de cobro. El middleware (Tarea 17) restringe el acceso al permiso de
 * cobro; el container revalida `puedeCobrar` para mostrar la pantalla (R2.3).
 */
export default function CobrarPage() {
  return <CobroContainer />;
}

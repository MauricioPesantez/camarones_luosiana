import { KdsContainer } from "@/presentation/components/containers/KdsContainer";

/**
 * Ruta del KDS (cocina). El middleware (Tarea 17) restringe el acceso a los
 * roles COCINA/ADMIN; aquí solo se monta el container.
 */
export default function KdsPage() {
  return <KdsContainer />;
}

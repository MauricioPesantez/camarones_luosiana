import { OrderTakingContainer } from "@/presentation/components/containers/OrderTakingContainer";

/**
 * Ruta de toma de orden (Mesero/Operador). El middleware (Tarea 17) restringe
 * el acceso por rol; aquí solo se monta el container.
 */
export default function OrdenPage() {
  return <OrderTakingContainer />;
}

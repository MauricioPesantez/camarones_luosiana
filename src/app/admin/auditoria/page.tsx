import { AuditoriaContainer } from "@/presentation/components/containers/AuditoriaContainer";

/**
 * Ruta de consulta de auditoría (R16.2, R16.3, R16.4). Solo admin: el
 * middleware y el endpoint restringen el acceso; el container lo revalida.
 */
export default function AdminAuditoriaPage() {
  return <AuditoriaContainer />;
}

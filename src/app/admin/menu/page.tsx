import { MenuAdminContainer } from "@/presentation/components/containers/MenuAdminContainer";

/**
 * Ruta de administración de menú (R3.1, R3.6). El middleware restringe el
 * acceso al rol admin; el container revalida la sesión.
 */
export default function AdminMenuPage() {
  return <MenuAdminContainer />;
}

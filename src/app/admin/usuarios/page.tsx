import { UsuariosContainer } from "@/presentation/components/containers/UsuariosContainer";

/**
 * Ruta de gestión de usuarios (R2.1, R2.3, R2.6). El middleware restringe el
 * acceso al rol admin; el container revalida la sesión.
 */
export default function AdminUsuariosPage() {
  return <UsuariosContainer />;
}

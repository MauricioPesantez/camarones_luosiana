import { User } from "@/domain/user/User";

/**
 * Puerto para la persistencia de usuarios.
 *
 * Abstrae el acceso a la entidad `User`.
 */
export interface UserRepository {
  /** Busca un usuario por su nombre de usuario (login). */
  porUsuario(usuario: string): Promise<User | null>;

  /** Obtiene un usuario por su id, o `null` si no existe. */
  obtener(id: string): Promise<User | null>;

  /** Lista todos los usuarios del sistema. */
  listar(): Promise<User[]>;

  /** Persiste los cambios de un usuario existente o crea uno nuevo. */
  guardar(u: User): Promise<void>;
}

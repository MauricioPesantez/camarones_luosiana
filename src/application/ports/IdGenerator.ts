/**
 * Facade para la generación de identificadores únicos.
 *
 * Abstrae la fuente de ids (UUID, cuid, etc.) para que los casos de uso no
 * dependan de un SDK concreto y puedan inyectar un generador determinista en
 * tests. La implementación concreta vive en infraestructura.
 */
export interface IdGenerator {
  /** Genera un nuevo identificador único. */
  generate(): string;
}

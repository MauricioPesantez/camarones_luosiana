/**
 * Error base para violaciones de reglas de negocio del dominio.
 *
 * Lo lanzan las entidades y casos de uso cuando una operación viola una
 * invariante de negocio (p. ej. una transición de estado no permitida, R6.7).
 * Los route handlers lo mapean a HTTP 422.
 */
export class DomainError extends Error {
  /** Código estable y legible por máquina para identificar el tipo de error. */
  readonly code: string;

  constructor(message: string, code = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
    this.code = code;
    // Mantiene la cadena de prototipos correcta al transpilar a ES5/ES6.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

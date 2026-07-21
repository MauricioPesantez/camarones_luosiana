import { DomainError } from "../shared/DomainError";
import { Role } from "./Role";

/**
 * Propiedades para crear/reconstituir un `User`.
 */
export interface UserProps {
  id: string;
  usuario: string;
  claveHash: string;
  nombre: string;
  roles: Role[];
  puedeCobrar: boolean;
  activo: boolean;
}

/**
 * Entidad `User`: un usuario del sistema con roles y permisos (R2).
 *
 * Implementa helpers de autorización del dominio: `tieneRol`, `esAdmin`,
 * `puedeCobrar`. El flag `puedeCobrar` es independiente del rol (R2.4).
 */
export class User {
  private constructor(
    readonly id: string,
    private _usuario: string,
    private _claveHash: string,
    private _nombre: string,
    private _roles: Role[],
    private _puedeCobrar: boolean,
    private _activo: boolean,
  ) {}

  static crear(props: UserProps): User {
    const id = props.id?.trim();
    if (!id) {
      throw new DomainError("El usuario requiere un id", "USER_ID_VACIO");
    }
    const usuario = props.usuario?.trim();
    if (!usuario) {
      throw new DomainError(
        "El usuario requiere un nombre de usuario",
        "USER_USUARIO_VACIO",
      );
    }
    const nombre = props.nombre?.trim();
    if (!nombre) {
      throw new DomainError("El usuario requiere un nombre", "USER_NOMBRE_VACIO");
    }
    if (!props.roles || props.roles.length === 0) {
      throw new DomainError(
        "El usuario requiere al menos un rol",
        "USER_ROLES_VACIOS",
      );
    }
    return new User(
      id,
      usuario,
      props.claveHash,
      nombre,
      [...props.roles],
      props.puedeCobrar,
      props.activo,
    );
  }

  get usuario(): string {
    return this._usuario;
  }

  get claveHash(): string {
    return this._claveHash;
  }

  get nombre(): string {
    return this._nombre;
  }

  get roles(): readonly Role[] {
    return [...this._roles];
  }

  get puedeCobrar(): boolean {
    return this._puedeCobrar;
  }

  get activo(): boolean {
    return this._activo;
  }

  /** ¿El usuario tiene el rol indicado? */
  tieneRol(rol: Role): boolean {
    return this._roles.includes(rol);
  }

  /** ¿El usuario es administrador? */
  esAdmin(): boolean {
    return this._roles.includes(Role.ADMIN);
  }

  /** Asigna un rol al usuario (si no lo tiene ya). */
  asignarRol(rol: Role): void {
    if (!this._roles.includes(rol)) {
      this._roles.push(rol);
    }
  }

  /** Revoca un rol del usuario. */
  revocarRol(rol: Role): void {
    this._roles = this._roles.filter((r) => r !== rol);
  }

  /** Actualiza el permiso de cobro. */
  establecerPuedeCobrar(puede: boolean): void {
    this._puedeCobrar = puede;
  }

  /** Desactiva el usuario (R2.6). */
  desactivar(): void {
    this._activo = false;
  }

  /** Reactiva el usuario. */
  activar(): void {
    this._activo = true;
  }

  /** Actualiza el hash de la clave. */
  cambiarClave(nuevoHash: string): void {
    this._claveHash = nuevoHash;
  }

  cambiarNombre(nombre: string): void {
    const limpio = nombre.trim();
    if (!limpio) {
      throw new DomainError("El usuario requiere un nombre", "USER_NOMBRE_VACIO");
    }
    this._nombre = limpio;
  }
}

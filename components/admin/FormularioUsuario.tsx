"use client";

import { FormEvent, useState } from "react";
import { ROLES, UsuarioAdmin } from "@/types/usuario";

interface Props {
  usuario: UsuarioAdmin | null;
  /** true cuando el admin se esta editando a si mismo: no puede cambiarse el rol. */
  esUsuarioActual: boolean;
  onCancelar: () => void;
  onGuardado: () => void;
}

const claseCampo =
  "w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500";
const claseEtiqueta = "block text-sm font-semibold text-gray-700 mb-1";

export default function FormularioUsuario({
  usuario,
  esUsuarioActual,
  onCancelar,
  onGuardado,
}: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [rol, setRol] = useState(usuario?.rol ?? "mesero");
  const [password, setPassword] = useState("");
  const [quitarPassword, setQuitarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const tendraPassword = quitarPassword
    ? false
    : password.trim() !== "" || (usuario?.tienePassword ?? false);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    const cuerpo: Record<string, unknown> = { nombre, rol };

    // Al editar, un campo de clave vacio no toca la clave existente.
    if (quitarPassword) cuerpo.password = null;
    else if (!usuario || password.trim() !== "") cuerpo.password = password;

    try {
      const res = await fetch(usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios", {
        method: usuario ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el usuario");
        return;
      }

      onGuardado();
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      setError("Error de conexión al guardar el usuario");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <label className={claseEtiqueta} htmlFor="usuario-nombre">
          Nombre
        </label>
        <input
          id="usuario-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={claseCampo}
          autoFocus
        />
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="usuario-rol">
          Rol
        </label>
        <select
          id="usuario-rol"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          className={`${claseCampo} disabled:bg-gray-100 disabled:text-gray-500`}
          disabled={esUsuarioActual}
        >
          {ROLES.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
        {esUsuarioActual && (
          <p className="mt-1 text-xs text-gray-500">
            No puedes cambiar tu propio rol: perderías el acceso al panel.
          </p>
        )}
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="usuario-password">
          Contraseña {usuario ? "(dejar vacío para no cambiarla)" : "(opcional)"}
        </label>
        <input
          id="usuario-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (e.target.value !== "") setQuitarPassword(false);
          }}
          className={claseCampo}
          autoComplete="new-password"
        />
        {usuario?.tienePassword && (
          <button
            type="button"
            onClick={() => {
              setQuitarPassword(true);
              setPassword("");
            }}
            className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Quitar contraseña
          </button>
        )}
      </div>

      {!tendraPassword && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-3 py-2">
          Sin contraseña, este usuario entra al sistema con solo elegir su nombre en el login.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-semibold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50"
        >
          {guardando ? "Guardando..." : usuario ? "Guardar cambios" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}

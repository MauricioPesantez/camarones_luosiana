"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { obtenerEtiquetaRol, UsuarioAdmin } from "@/types/usuario";
import ModalFormulario from "@/components/admin/ModalFormulario";
import FormularioUsuario from "@/components/admin/FormularioUsuario";

/** vista=admin trae tambien los inactivos, cada uno con tienePassword. */
async function obtenerUsuarios(): Promise<UsuarioAdmin[]> {
  try {
    const res = await fetch("/api/usuarios?vista=admin");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    return [];
  }
}

export default function UsuariosPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdmin | null>(null);

  const esAdmin = usuario?.rol === "admin";

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      setUsuarios(await obtenerUsuarios());
    } finally {
      setLoading(false);
    }
  };

  // El estado se escribe dentro del callback de la promesa: hacerlo de forma
  // sincrona en el efecto encadena renders.
  useEffect(() => {
    if (!esAdmin) return;

    let vigente = true;

    obtenerUsuarios().then((data) => {
      if (!vigente) return;
      setUsuarios(data);
      setLoading(false);
    });

    return () => {
      vigente = false;
    };
  }, [esAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || !esAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  const abrirCreacion = () => {
    setUsuarioEditando(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setUsuarioEditando(null);
  };

  const alGuardar = async () => {
    cerrarModal();
    await cargarUsuarios();
  };

  const alternarActivo = async (registro: UsuarioAdmin) => {
    // Desactivarse a uno mismo deja el panel sin forma de volver a entrar.
    if (registro.id === usuario.id) {
      alert("No puedes desactivar tu propio usuario");
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${registro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !registro.activo }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo cambiar el estado del usuario");
        return;
      }

      await cargarUsuarios();
    } catch (error) {
      console.error("Error al cambiar estado del usuario:", error);
      alert("Error de conexión al cambiar el estado del usuario");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight">Usuarios</h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Personal con acceso al sistema
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 whitespace-nowrap"
            >
              ← Admin
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">
            {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={abrirCreacion}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-semibold"
          >
            + Nuevo usuario
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando usuarios...</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {usuarios.map((registro) => (
                <li
                  key={registro.id}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">
                      {registro.nombre}
                      {registro.id === usuario.id && (
                        <span className="ml-2 text-xs font-normal text-gray-400">(tú)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {obtenerEtiquetaRol(registro.rol)} ·{" "}
                      {registro.tienePassword ? "con contraseña" : "sin contraseña"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {registro.activo ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
                        Inactivo
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setUsuarioEditando(registro);
                        setModalAbierto(true);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternarActivo(registro)}
                      disabled={registro.id === usuario.id}
                      className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-40"
                    >
                      {registro.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalFormulario
          titulo={usuarioEditando ? "Editar usuario" : "Nuevo usuario"}
          onCerrar={cerrarModal}
        >
          <FormularioUsuario
            usuario={usuarioEditando}
            esUsuarioActual={usuarioEditando?.id === usuario.id}
            onCancelar={cerrarModal}
            onGuardado={alGuardar}
          />
        </ModalFormulario>
      )}
    </div>
  );
}

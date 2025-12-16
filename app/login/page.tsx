"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

export default function LoginPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const res = await fetch("/api/usuarios");
        const data = await res.json();
        setUsuarios(data.filter((u: Usuario) => u.activo));
      } catch (error) {
        console.error("Error al cargar usuarios:", error);
      }
    };

    cargarUsuarios();
  }, []);

  const handleUsuarioChange = async (usuarioId: string) => {
    setUsuarioSeleccionado(usuarioId);
    setPassword("");

    if (usuarioId) {
      try {
        const res = await fetch(`/api/usuarios/${usuarioId}`);

        if (!res.ok) {
          console.error("Error al obtener usuario:", await res.text());
          setRequiresPassword(false);
          return;
        }

        const usuario = await res.json();
        setRequiresPassword(!!usuario.password);
      } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
        setRequiresPassword(false);
      }
    } else {
      setRequiresPassword(false);
    }
  };

  const handleLogin = async () => {
    if (!usuarioSeleccionado) {
      alert("Por favor selecciona un usuario");
      return;
    }

    const usuario = usuarios.find((u) => u.id === usuarioSeleccionado);
    if (!usuario) return;

    // Verificar contraseña si es necesario
    if (requiresPassword) {
      if (!password) {
        alert("Por favor ingresa tu contraseña");
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: usuarioSeleccionado,
          password,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        alert("Contraseña incorrecta");
        return;
      }
    }

    // Guardar sesión
    localStorage.setItem("usuario", JSON.stringify(usuario));

    // Redirigir según rol
    if (usuario.rol === "admin") {
      router.push("/admin");
    } else if (usuario.rol === "mesero") {
      router.push("/mesero");
    } else if (usuario.rol === "cocina") {
      router.push("/cocina");
    } else {
      router.push("/mesero");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Camarones Louisiana 🦐
          </h1>
          <p className="text-gray-600">Selecciona tu usuario para continuar</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuario
            </label>
            <select
              value={usuarioSeleccionado}
              onChange={(e) => handleUsuarioChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            >
              <option value="">-- Selecciona tu nombre --</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} ({usuario.rol})
                </option>
              ))}
            </select>
          </div>

          {requiresPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="Ingresa tu contraseña"
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!usuarioSeleccionado}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            Iniciar Sesión
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          Sistema de Gestión de Órdenes v1.0
        </div>
      </div>
    </div>
  );
}

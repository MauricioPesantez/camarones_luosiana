"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

const rolRedirects: Record<string, string> = {
  admin: "/admin",
  mesero: "/mesero",
  cocina: "/cocina",
  digital: "/digital",
};

export function useAuth(requiredRole?: string) {
  const router = useRouter();

  const [usuario] = useState<Usuario | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("usuario");
    return saved ? (JSON.parse(saved) as Usuario) : null;
  });

  useEffect(() => {
    if (!usuario) {
      router.push("/login");
    } else if (requiredRole && usuario.rol !== requiredRole) {
      router.push(rolRedirects[usuario.rol] ?? "/login");
    }
  }, [router, requiredRole, usuario]);

  const logout = () => {
    localStorage.removeItem("usuario");
    router.push("/login");
  };

  return { usuario, loading: false, logout };
}

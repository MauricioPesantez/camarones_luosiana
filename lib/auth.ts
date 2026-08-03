"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface Usuario {
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

  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("usuario");
    return saved ? (JSON.parse(saved) as Usuario) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) throw new Error("Sesion no valida");
        const data = await response.json();
        if (!active) return;
        setUsuario(data.usuario);
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        if (requiredRole && data.usuario.rol !== requiredRole) {
          router.replace(rolRedirects[data.usuario.rol] ?? "/login");
        }
      } catch {
        if (!active) return;
        localStorage.removeItem("usuario");
        setUsuario(null);
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    };
    void validate();
    return () => {
      active = false;
    };
  }, [router, requiredRole]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem("usuario");
    setUsuario(null);
    router.push("/login");
  };

  return { usuario, loading, logout };
}

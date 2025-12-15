"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem("usuario");
    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  const logout = () => {
    localStorage.removeItem("usuario");
    router.push("/login");
  };

  return { usuario, loading, logout };
}

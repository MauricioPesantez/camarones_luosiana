import { useEffect, useState, useSyncExternalStore } from "react";
import {
  anterioresDe,
  estadoRevision,
  huellaOrden,
  marcasVigentes,
  type ErrorAnterior,
  type MarcasRevision,
  type OrdenRevisable,
  type RevisionGuardada,
} from "../../../types/revision";
import {
  crearColaGuardado,
  crearEnvioRevision,
  type EstadoGuardado,
  type ValorRevision,
} from "./cola-guardado";

/** Lo que el admin ve de una orden mientras tiene marcas en esta pestaña. */
export interface Borrador {
  marcas: MarcasRevision;
  revisada: boolean;
  cambios: string[];
  /** Errores anotados antes de que la orden cambiara, también los que el admin acaba de quitar. */
  anteriores: ErrorAnterior[];
  /** Ya estaba revisada cuando cambió: solo esas salen como "Cambió, por revisar". */
  eraRevisada: boolean;
}

/** Por id de orden. Nunca se muta: cada cambio es un objeto nuevo. */
export interface EstadoColas {
  borradores: Record<string, Borrador>;
  guardados: Record<string, EstadoGuardado>;
  /** Motivo del servidor cuando no aceptó el último envío. */
  rechazos: Record<string, string | null>;
}

export interface Catalogo {
  estado: "sin_pedir" | "cargando" | "error" | "listo";
  productos: { id: string; nombre: string }[];
}

interface Entrada {
  cola: ReturnType<typeof crearColaGuardado<ValorRevision>>;
  /** Último valor puesto: solo su respuesta puede dejarla como revisada. */
  ultimo: ValorRevision | null;
  /** El admin eligió salir sin guardarla: se suelta al terminar su envío. */
  descartada: boolean;
}

/** Lo que se ve de una orden sin marcas en esta pestaña: sale de lo último guardado. */
export function borradorInicial(
  orden: OrdenRevisable,
  revision: RevisionGuardada | null,
): Borrador {
  const estado = estadoRevision(orden, revision);
  const { marcas, cambios } = marcasVigentes(orden, revision?.detalle ?? null);
  return {
    marcas,
    revisada: estado === "bien" || estado === "con_errores",
    cambios,
    anteriores: anterioresDe(orden, revision?.detalle ?? null),
    eraRevisada: estado === "cambio",
  };
}

export type ColasRevision = ReturnType<typeof useColasRevision>;

const sinClaves = <T,>(registro: Record<string, T>, claves: readonly string[]) =>
  Object.fromEntries(Object.entries(registro).filter(([clave]) => !claves.includes(clave)));

/** Una cola por orden, con sus marcas. Vive más que la pantalla de revisión. */
export function crearColasRevision(
  onGuardada: (revision: RevisionGuardada) => void,
  transportar?: typeof fetch,
) {
  let estado: EstadoColas = { borradores: {}, guardados: {}, rechazos: {} };
  let abierta = false;
  const entradas = new Map<string, Entrada>();
  const oyentes = new Set<() => void>();

  const cambiar = (parcial: Partial<EstadoColas>) => {
    estado = { ...estado, ...parcial };
    oyentes.forEach((oyente) => oyente());
  };

  const olvidar = (ids: readonly string[]) => {
    ids.forEach((id) => entradas.delete(id));
    cambiar({
      borradores: sinClaves(estado.borradores, ids),
      guardados: sinClaves(estado.guardados, ids),
      rechazos: sinClaves(estado.rechazos, ids),
    });
  };

  const entradaDe = (orden: OrdenRevisable & { id: string }, version: number): Entrada => {
    const { id } = orden;
    const existente = entradas.get(id);
    if (existente) return existente;
    // Un envío de una orden ya olvidada puede terminar después: no debe revivirla.
    const vigente = () => entradas.get(id) === entrada;
    const entrada: Entrada = {
      ultimo: null,
      descartada: false,
      cola: crearColaGuardado({
        enviar: crearEnvioRevision({
          ordenId: id,
          version,
          huella: huellaOrden(orden),
          alGuardar: (revision, valor) => {
            onGuardada(revision);
            if (!vigente() || entrada.ultimo !== valor) return;
            cambiar({
              borradores: {
                ...estado.borradores,
                [id]: {
                  ...estado.borradores[id],
                  revisada: revision.revisada,
                  // Al quedar revisada ya se atendió lo que cambió.
                  ...(revision.revisada ? { cambios: [] } : {}),
                },
              },
            });
          },
          alRechazar: (error) => {
            if (vigente()) cambiar({ rechazos: { ...estado.rechazos, [id]: error } });
          },
          transportar,
        }),
        alCambiar: (guardado) => {
          if (!vigente()) return;
          cambiar({ guardados: { ...estado.guardados, [id]: guardado } });
          if (guardado === "guardando") return;
          if (entrada.descartada || (!abierta && guardado === "guardado")) olvidar([id]);
        },
      }),
    };
    entradas.set(id, entrada);
    return entrada;
  };

  return {
    leer: () => estado,
    suscribir(oyente: () => void) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    abrir() {
      abierta = true;
    },
    cerrar() {
      abierta = false;
      // Lo guardado se suelta para que ganen los datos frescos; lo demás conserva su cola.
      olvidar(Object.keys(estado.guardados).filter((id) => estado.guardados[id] === "guardado"));
    },
    /** `version` solo cuenta si la orden aún no tiene cola. */
    poner(
      orden: OrdenRevisable & { id: string },
      version: number,
      borrador: Borrador,
      revisada = borrador.revisada,
    ) {
      const entrada = entradaDe(orden, version);
      entrada.descartada = false;
      entrada.ultimo = { marcas: borrador.marcas, revisada };
      cambiar({ borradores: { ...estado.borradores, [orden.id]: borrador } });
      entrada.cola.poner(entrada.ultimo);
    },
    reintentar(id: string) {
      entradas.get(id)?.cola.reintentar();
    },
    async vaciar(ids: readonly string[]) {
      const vacias = await Promise.all(ids.map((id) => entradas.get(id)?.cola.vaciar() ?? true));
      return vacias.every(Boolean);
    },
    olvidar,
    descartar(ids: readonly string[]) {
      for (const id of ids) {
        const entrada = entradas.get(id);
        if (!entrada) continue;
        if (estado.guardados[id] === "guardando") entrada.descartada = true;
        else olvidar([id]);
      }
    },
  };
}

/** Se llama fuera de la pantalla para que las marcas sin guardar sobrevivan a "Atrás". */
export function useColasRevision(
  abierta: boolean,
  onGuardada: (revision: RevisionGuardada) => void,
) {
  const [colas] = useState(() => crearColasRevision(onGuardada));
  const estado = useSyncExternalStore(colas.suscribir, colas.leer, colas.leer);
  const haySinGuardar = Object.values(estado.guardados).some((g) => g !== "guardado");

  useEffect(() => {
    if (!abierta) return;
    colas.abrir();
    return () => colas.cerrar();
  }, [abierta, colas]);

  useEffect(() => {
    if (!haySinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [haySinGuardar]);

  // Aquí y no en la pantalla: un faltante sin guardar necesita su nombre al reabrir.
  const [catalogo, setCatalogo] = useState<Catalogo>({ estado: "sin_pedir", productos: [] });
  const cargarCatalogo = async () => {
    setCatalogo({ estado: "cargando", productos: [] });
    try {
      const res = await fetch("/api/productos?vista=admin");
      const productos = await res.json();
      if (!res.ok || !Array.isArray(productos)) throw new Error("Respuesta inválida");
      setCatalogo({ estado: "listo", productos });
    } catch {
      setCatalogo({ estado: "error", productos: [] });
    }
  };

  return { ...colas, estado, catalogo, cargarCatalogo };
}

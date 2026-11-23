// Bitácora de errores de las revisiones. Pura, sin Prisma: la usa la ruta del reporte.
import {
  erroresDe,
  marcasVigentes,
  type OrdenRevisable,
  type RevisionGuardada,
  type TipoError,
} from "../types/revision";

export interface FilaBitacora {
  orden: OrdenRevisable & {
    id: string;
    numeroDiario: number | null;
    createdAt: Date;
    creadorNombre: string;
    cobradaPor: string | null;
  };
  revision: RevisionGuardada;
}
export interface Bitacora {
  ordenesRevisadas: number;
  porTipo: Record<TipoError, number>;
  porPersona: { nombre: string; total: number; porTipo: Record<TipoError, number> }[];
  errores: {
    ordenId: string;
    fecha: string;
    numeroDiario: number | null;
    tipo: TipoError;
    texto: string;
    persona: string;
    cambio: boolean;
  }[];
}

const ceros = (): Record<TipoError, number> => ({ falto: 0, no_iba: 0, cantidad: 0, metodo: 0, total: 0 });
const diaEcuador = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guayaquil",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function armarBitacora(filas: readonly FilaBitacora[]): Bitacora {
  const porTipo = ceros();
  const personas = new Map<string, { nombre: string; total: number; porTipo: Record<TipoError, number> }>();
  const errores: Bitacora["errores"] = [];

  const recientesPrimero = [...filas].sort((a, b) => b.orden.createdAt.getTime() - a.orden.createdAt.getTime());
  for (const { orden, revision } of recientesPrimero) {
    const cambio = marcasVigentes(orden, revision.detalle).cambios.length > 0;
    const fecha = diaEcuador.format(orden.createdAt);
    for (const e of erroresDe(revision.detalle)) {
      const persona =
        e.persona ?? (e.de === "creador" ? orden.creadorNombre : orden.cobradaPor || orden.creadorNombre);
      errores.push({
        ordenId: orden.id, fecha, numeroDiario: orden.numeroDiario, tipo: e.tipo, texto: e.texto, persona,
        cambio: cambio || e.anterior === true,
      });
      porTipo[e.tipo]++;
      const p = personas.get(persona) ?? { nombre: persona, total: 0, porTipo: ceros() };
      p.total++;
      p.porTipo[e.tipo]++;
      personas.set(persona, p);
    }
  }

  const porPersona = [...personas.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  return { ordenesRevisadas: filas.length, porTipo, porPersona, errores };
}

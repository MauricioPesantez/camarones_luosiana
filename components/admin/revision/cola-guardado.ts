import type { MarcasRevision, RevisionGuardada } from "../../../types/revision";

export type EstadoGuardado = "guardado" | "guardando" | "error" | "conflicto";
export type ResultadoEnvio = "ok" | "error" | "conflicto";

/** Guarda de a un envío: mientras uno está en curso solo se recuerda el último valor. */
export function crearColaGuardado<T>({
  enviar,
  alCambiar,
}: {
  enviar: (valor: T) => Promise<ResultadoEnvio>;
  alCambiar: (estado: EstadoGuardado) => void;
}): { poner(valor: T): void; reintentar(): void; vaciar(): Promise<boolean> } {
  let estado: EstadoGuardado = "guardado";
  let porEnviar: { valor: T } | null = null;
  let esperando: ((guardado: boolean) => void)[] = [];

  const cambiar = (nuevo: EstadoGuardado) => {
    estado = nuevo;
    alCambiar(nuevo);
  };
  const avisar = (guardado: boolean) => {
    const avisados = esperando;
    esperando = [];
    avisados.forEach((resolver) => resolver(guardado));
  };

  const procesar = async () => {
    cambiar("guardando");
    while (porEnviar) {
      const envio: { valor: T } = porEnviar;
      porEnviar = null;
      let resultado: ResultadoEnvio;
      try {
        resultado = await enviar(envio.valor);
      } catch {
        resultado = "error";
      }
      if (resultado !== "ok") {
        // Si llegó un valor más nuevo, ese es el que se reintenta.
        porEnviar ??= envio;
        cambiar(resultado);
        avisar(false);
        return;
      }
    }
    cambiar("guardado");
    avisar(true);
  };

  return {
    poner(valor) {
      porEnviar = { valor };
      if (estado === "guardado") void procesar();
    },
    reintentar() {
      if (estado === "error") void procesar();
    },
    vaciar() {
      if (estado !== "guardando") return Promise.resolve(estado === "guardado");
      return new Promise((resolver) => esperando.push(resolver));
    },
  };
}

export interface ValorRevision {
  marcas: MarcasRevision;
  revisada: boolean;
}

/** Envía la revisión de una orden, siempre con la versión de su última respuesta. */
export function crearEnvioRevision({
  ordenId,
  version: versionInicial,
  huella,
  alGuardar,
  alRechazar,
  transportar = (...args) => fetch(...args),
}: {
  ordenId: string;
  version: number;
  huella: string;
  alGuardar: (revision: RevisionGuardada, valor: ValorRevision) => void;
  /** Por qué el servidor no aceptó el envío; null al empezar otro. */
  alRechazar: (error: string | null) => void;
  transportar?: typeof fetch;
}): (valor: ValorRevision) => Promise<ResultadoEnvio> {
  let version = versionInicial;
  // Pudo guardarse aunque no llegó la respuesta: se repite tal cual antes de
  // mandar otra cosa, o el servidor vería la versión vieja como un conflicto.
  let incierto: { valor: ValorRevision; cuerpo: string } | null = null;

  const mandar = async (
    valor: ValorRevision,
    cuerpo = JSON.stringify({ ...valor, version, huella }),
  ): Promise<ResultadoEnvio> => {
    alRechazar(null);
    try {
      const res = await transportar(`/api/admin/ordenes/${ordenId}/revision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 409) return "conflicto";
      if ([400, 401, 403, 404].includes(res.status)) {
        const datos = await res.json().catch(() => null);
        if (typeof datos?.error === "string") alRechazar(datos.error);
      }
      if (res.status === 400) {
        incierto = null;
        return "error";
      }
      if (!res.ok) throw new Error(`Respuesta ${res.status}`);
      const revision = (await res.json()).revision as RevisionGuardada;
      version = revision.version;
      incierto = null;
      alGuardar(revision, valor);
      return "ok";
    } catch {
      incierto ??= { valor, cuerpo };
      return "error";
    }
  };

  return async (valor) => {
    const previo = incierto;
    if (previo) {
      const resultado = await mandar(previo.valor, previo.cuerpo);
      if (resultado === "ok" && previo.valor === valor) return "ok";
      if (resultado !== "ok" && incierto) return resultado;
    }
    return mandar(valor);
  };
}

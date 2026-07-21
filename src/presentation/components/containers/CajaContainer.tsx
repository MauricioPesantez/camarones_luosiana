"use client";

import { useCallback, useEffect, useState } from "react";

import { Role } from "@/domain/user/Role";
import type { EstadoCajaDTO, SessionUserDTO } from "@/presentation/http/dto";
import type { TipoMovimientoManual } from "@/presentation/api/caja";
import { ApiError } from "@/presentation/api/client";
import { sesionActual } from "@/presentation/api/auth";
import {
  abrirCaja,
  cerrarCaja,
  estadoCaja,
  registrarMovimiento,
} from "@/presentation/api/caja";
import { useUI } from "@/presentation/components/ui";
import { AperturaCaja } from "@/presentation/components/presenters/caja/AperturaCaja";
import { CierrePanel } from "@/presentation/components/presenters/caja/CierrePanel";
import { MovimientosPanel } from "@/presentation/components/presenters/caja/MovimientosPanel";
import {
  MENSAJE_CAJA_ABIERTA,
  MENSAJE_CAJA_CERRADA,
  diferenciaEnVivo,
  mensajeConfirmarApertura,
  mensajeConfirmarCierre,
  mensajeMovimientoRegistrado,
  puedeAbrir,
  puedeCerrar,
  puedeRegistrarMovimiento,
} from "@/presentation/components/presenters/caja/caja";

const MENSAJE_ERROR_GENERICO = "Ocurrió un error. Intenta de nuevo.";

/**
 * Container de la pantalla de caja/cierre (R10, R11, R13). Solo admin (R2.5):
 * revalida la sesión y muestra la apertura o la jornada abierta según el estado.
 * Wirea apertura, movimientos manuales y cierre con `useUI` (modal de
 * confirmación del cierre R13, toasts), refrescando el estado tras cada acción.
 */
export function CajaContainer() {
  const { toast, confirm } = useUI();
  const [usuario, setUsuario] = useState<SessionUserDTO | null | undefined>(
    undefined,
  );
  const [estado, setEstado] = useState<EstadoCajaDTO | null>(null);

  const [fondo, setFondo] = useState("");
  const [tipoMov, setTipoMov] = useState<TipoMovimientoManual>("PAGO_PROVEEDOR");
  const [montoMov, setMontoMov] = useState("");
  const [notaMov, setNotaMov] = useState("");
  const [contado, setContado] = useState("");
  const [procesando, setProcesando] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setEstado(await estadoCaja());
    } catch {
      setEstado((prev) => prev);
    }
  }, []);

  useEffect(() => {
    sesionActual()
      .then(setUsuario)
      .catch(() => setUsuario(null));
  }, []);

  useEffect(() => {
    if (usuario?.roles.includes(Role.ADMIN)) {
      void refrescar();
    }
  }, [usuario, refrescar]);

  const manejarError = useCallback(
    (e: unknown) => {
      toast(e instanceof ApiError ? e.message : MENSAJE_ERROR_GENERICO);
    },
    [toast],
  );

  const abrir = useCallback(async () => {
    const monto = Number(fondo);
    if (!puedeAbrir(fondo === "" ? null : monto)) return;
    const ok = await confirm({
      title: "Abrir caja",
      message: mensajeConfirmarApertura(monto),
    });
    if (!ok) return;
    setProcesando(true);
    try {
      await abrirCaja(monto);
      toast(MENSAJE_CAJA_ABIERTA);
      setFondo("");
      await refrescar();
    } catch (e) {
      manejarError(e);
    } finally {
      setProcesando(false);
    }
  }, [fondo, confirm, toast, refrescar, manejarError]);

  const registrar = useCallback(async () => {
    const monto = Number(montoMov);
    if (!puedeRegistrarMovimiento(montoMov === "" ? null : monto)) return;
    setProcesando(true);
    try {
      await registrarMovimiento({
        tipo: tipoMov,
        monto,
        nota: notaMov.trim() || null,
      });
      toast(mensajeMovimientoRegistrado(tipoMov));
      setMontoMov("");
      setNotaMov("");
      await refrescar();
    } catch (e) {
      manejarError(e);
    } finally {
      setProcesando(false);
    }
  }, [montoMov, tipoMov, notaMov, toast, refrescar, manejarError]);

  const cerrar = useCallback(async () => {
    if (!estado?.sesion) return;
    const monto = Number(contado);
    if (!puedeCerrar(contado === "" ? null : monto)) return;
    const diferencia = diferenciaEnVivo(monto, estado.esperado);
    const ok = await confirm({
      title: "Cerrar caja",
      message: mensajeConfirmarCierre(monto, diferencia),
      danger: true,
      confirmLabel: "Cerrar caja",
    });
    if (!ok) return;
    setProcesando(true);
    try {
      const resultado = await cerrarCaja(monto);
      toast(MENSAJE_CAJA_CERRADA);
      setContado("");
      await refrescar();
      if (resultado.ordenesCerradas > 0) {
        toast(`${resultado.ordenesCerradas} órdenes cerradas`);
      }
    } catch (e) {
      manejarError(e);
    } finally {
      setProcesando(false);
    }
  }, [estado, contado, confirm, toast, refrescar, manejarError]);

  if (usuario === undefined) {
    return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  }

  if (!usuario?.roles.includes(Role.ADMIN)) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        Requiere rol de administrador.
      </p>
    );
  }

  if (estado === null) {
    return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  }

  return (
    <section className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-xl font-bold text-foreground">Caja</h1>

      {estado.sesion === null ? (
        <AperturaCaja
          fondo={fondo}
          onFondo={setFondo}
          onAbrir={abrir}
          puedeAbrir={puedeAbrir(fondo === "" ? null : Number(fondo))}
          procesando={procesando}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <MovimientosPanel
            movimientos={estado.movimientos}
            tipo={tipoMov}
            onTipo={setTipoMov}
            monto={montoMov}
            onMonto={setMontoMov}
            nota={notaMov}
            onNota={setNotaMov}
            onRegistrar={registrar}
            puedeRegistrar={puedeRegistrarMovimiento(
              montoMov === "" ? null : Number(montoMov),
            )}
            procesando={procesando}
          />
          <CierrePanel
            esperado={estado.esperado}
            puente={estado.puente}
            contado={contado}
            onContado={setContado}
            onCerrar={cerrar}
            puedeCerrar={puedeCerrar(contado === "" ? null : Number(contado))}
            procesando={procesando}
          />
        </div>
      )}
    </section>
  );
}

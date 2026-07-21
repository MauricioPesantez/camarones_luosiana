"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MetodoPago } from "@/domain/order/MetodoPago";
import type { OrderDTO, SessionUserDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import { sesionActual } from "@/presentation/api/auth";
import { cobrarOrden } from "@/presentation/api/orders";
import { useUI } from "@/presentation/components/ui";
import { CobroPanel } from "@/presentation/components/presenters/cobro/CobroPanel";
import { OrdenesCobrablesList } from "@/presentation/components/presenters/cobro/OrdenesCobrablesList";
import {
  MENSAJE_COMPROBANTE_CARGADO,
  mensajeCobroRegistrado,
  mensajeConfirmarCobro,
  ordenesCobrables,
  puedeRegistrarCobro,
} from "@/presentation/components/presenters/cobro/cobro";
import { usePollingOrders } from "@/presentation/hooks/usePollingOrders";

/**
 * Container de la pantalla de cobro (R9). Solo accesible a usuarios con
 * `puedeCobrar` (R2.3); el middleware gatea la ruta y aquí se revalida para
 * mostrar la pantalla o un aviso. Reutiliza `usePollingOrders` y filtra a las
 * órdenes entregadas; wirea el flujo de cobro con `useUI` (comprobante R9.5,
 * modal R9.4, toast R9.4).
 */
export function CobroContainer() {
  const { toast, confirm } = useUI();
  const { orders, refetch } = usePollingOrders();
  const [usuario, setUsuario] = useState<SessionUserDTO | null | undefined>(
    undefined,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.EFECTIVO);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    sesionActual()
      .then(setUsuario)
      .catch(() => setUsuario(null));
  }, []);

  const cobrables = useMemo(() => ordenesCobrables(orders), [orders]);
  const seleccionada = useMemo<OrderDTO | null>(
    () => cobrables.find((o) => o.id === selectedId) ?? null,
    [cobrables, selectedId],
  );

  const seleccionar = useCallback((order: OrderDTO) => {
    setSelectedId(order.id);
    setMetodo(MetodoPago.EFECTIVO);
    setComprobante(null);
  }, []);

  const cargarComprobante = useCallback(
    (file: File) => {
      setComprobante(file);
      toast(MENSAJE_COMPROBANTE_CARGADO);
    },
    [toast],
  );

  const registrar = useCallback(async () => {
    if (!seleccionada) return;
    const ok = await confirm({
      title: "Registrar cobro",
      message: mensajeConfirmarCobro(seleccionada.total, metodo),
    });
    if (!ok) return;
    setProcesando(true);
    try {
      await cobrarOrden(seleccionada.id, metodo, comprobante ?? undefined);
      toast(mensajeCobroRegistrado(seleccionada.numero));
      setSelectedId(null);
      setComprobante(null);
      refetch();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Ocurrió un error. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }, [seleccionada, metodo, comprobante, confirm, toast, refetch]);

  if (usuario === undefined) {
    return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  }

  if (!usuario?.puedeCobrar) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        No tienes permiso de cobro.
      </p>
    );
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-6 p-4 md:grid-cols-[18rem_1fr]">
      <div>
        <h1 className="mb-4 text-xl font-bold text-foreground">Cobrar</h1>
        <OrdenesCobrablesList
          orders={cobrables}
          selectedId={selectedId}
          onSelect={seleccionar}
        />
      </div>

      {seleccionada ? (
        <CobroPanel
          order={seleccionada}
          metodo={metodo}
          onMetodo={setMetodo}
          comprobanteNombre={comprobante?.name ?? null}
          onComprobante={cargarComprobante}
          onRegistrar={registrar}
          puedeRegistrar={puedeRegistrarCobro(seleccionada, metodo, comprobante !== null)}
          procesando={procesando}
        />
      ) : (
        <p className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-muted-foreground">
          Selecciona una orden para cobrar.
        </p>
      )}
    </section>
  );
}

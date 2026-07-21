"use client";

import { useCallback, useEffect, useState } from "react";

import type { MenuItemDTO, OrderDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import {
  agregarItem,
  cancelarOrden,
  crearOrden,
  enviarACocina,
  listarMenu,
  ordenesActivas,
  quitarItem,
} from "@/presentation/api/orders";
import { useUI } from "@/presentation/components/ui";

import { Cart } from "@/presentation/components/presenters/order/Cart";
import { ChannelFields } from "@/presentation/components/presenters/order/ChannelForm";
import { MenuGrid } from "@/presentation/components/presenters/order/MenuGrid";
import { OrdenesActivasList } from "@/presentation/components/presenters/order/OrdenesActivasList";
import {
  MENSAJE_CANCELAR,
  agregarAlBorrador,
  borradorAPayload,
  borradorInicial,
  mensajeAgregado,
  mensajeConfirmarEnvio,
  mensajeOrdenEnviada,
  mensajeQuitado,
  menuConStockLocal,
  permiteEditarItems,
  puedeCrearBorrador,
  puedeEnviarACocina,
  quitarDelBorrador,
  resumenBorrador,
  totalUnidades,
  totalUnidadesBorrador,
  validarBorrador,
  type OrderDraft,
} from "@/presentation/components/presenters/order/orderTaking";
import { OrderStatus } from "@/domain/order/OrderStatus";

/**
 * Container de la pantalla de toma de orden (Mesero/Operador).
 *
 * Dos fases:
 * 1. **Componer** (`order === null`): se arma la orden completa en memoria
 *    (canal + carrito), descontando el stock localmente sobre el menú ya
 *    cargado (una sola consulta al abrir la pantalla). La orden se crea al final
 *    en una sola operación transaccional (`crearOrden` con `items`).
 * 2. **Editar** (`order !== null`): la orden ya existe; se puede seguir
 *    agregando/quitando ítems (running tab), enviarla a cocina o cancelarla.
 *    Tras enviar o cancelar se vuelve a la pantalla de nueva orden.
 *
 * Una orden activa existente puede reabrirse desde la lista para editarla.
 */
export function OrderTakingContainer() {
  const { toast, confirm } = useUI();
  const [menu, setMenu] = useState<MenuItemDTO[]>([]);
  const [draft, setDraft] = useState<OrderDraft>(borradorInicial);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [creando, setCreando] = useState(false);
  const [errorBorrador, setErrorBorrador] = useState<string | null>(null);
  const [mostrarActivas, setMostrarActivas] = useState(false);
  const [activas, setActivas] = useState<OrderDTO[]>([]);

  // Carga el menú una sola vez al abrir la pantalla (no por cada ítem).
  const cargarMenu = useCallback(() => {
    return listarMenu()
      .then(setMenu)
      .catch((e) => toast(mensajeError(e)));
  }, [toast]);

  useEffect(() => {
    cargarMenu();
  }, [cargarMenu]);

  // -------------------------------------------------------------------------
  // Fase 1: componer el borrador
  // -------------------------------------------------------------------------

  const cambiarDraft = useCallback((patch: Partial<OrderDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrorBorrador(null);
  }, []);

  const agregarABorrador = useCallback((item: MenuItemDTO) => {
    setDraft((prev) => ({ ...prev, lineas: agregarAlBorrador(prev.lineas, item) }));
  }, []);

  const quitarDeBorrador = useCallback((menuItemId: string) => {
    setDraft((prev) => ({
      ...prev,
      lineas: quitarDelBorrador(prev.lineas, menuItemId),
    }));
  }, []);

  const crear = useCallback(async () => {
    const errorValidacion = validarBorrador(draft);
    if (errorValidacion) {
      setErrorBorrador(errorValidacion);
      return;
    }
    setCreando(true);
    try {
      const nueva = await crearOrden(borradorAPayload(draft));
      // El servidor ya descontó el stock de los ítems creados; refléjalo local.
      setMenu((prev) => menuConStockLocal(prev, draft.lineas));
      setOrder(nueva);
      setDraft(borradorInicial());
      setErrorBorrador(null);
    } catch (e) {
      if (e instanceof ApiError) setErrorBorrador(e.message);
      else toast(mensajeError(e));
    } finally {
      setCreando(false);
    }
  }, [draft, toast]);

  // -------------------------------------------------------------------------
  // Fase 2: editar la orden creada / reabierta
  // -------------------------------------------------------------------------

  const agregar = useCallback(
    async (item: MenuItemDTO) => {
      if (!order) return;
      try {
        const actualizada = await agregarItem(order.id, item.id, 1);
        setOrder(actualizada);
        // Descuento local del stock (sin volver a consultar el menú completo).
        setMenu((prev) => ajustarStockLocal(prev, item.id, -1));
        toast(mensajeAgregado(item.nombre));
      } catch (e) {
        toast(mensajeError(e));
      }
    },
    [order, toast],
  );

  const quitar = useCallback(
    async (itemId: string) => {
      if (!order) return;
      const item = order.items.find((i) => i.id === itemId);
      try {
        const actualizada = await quitarItem(order.id, itemId);
        setOrder(actualizada);
        if (item) {
          setMenu((prev) => ajustarStockLocal(prev, item.menuItemId, item.cantidad));
          toast(mensajeQuitado(item.nombrePlato));
        }
      } catch (e) {
        toast(mensajeError(e));
      }
    },
    [order, toast],
  );

  // Vuelve a la pantalla de nueva orden y refresca el stock (p. ej. tras una
  // cancelación que restaura stock en el servidor).
  const volverANuevaOrden = useCallback(() => {
    setOrder(null);
    setDraft(borradorInicial());
    setErrorBorrador(null);
    cargarMenu();
  }, [cargarMenu]);

  const enviar = useCallback(async () => {
    if (!order) return;
    const ok = await confirm({
      title: "Enviar a cocina",
      message: mensajeConfirmarEnvio(totalUnidades(order)),
    });
    if (!ok) return;
    try {
      await enviarACocina(order.id);
      toast(mensajeOrdenEnviada);
      volverANuevaOrden();
    } catch (e) {
      toast(mensajeError(e));
    }
  }, [order, confirm, toast, volverANuevaOrden]);

  const cancelar = useCallback(async () => {
    if (!order) return;
    const ok = await confirm({
      title: "Cancelar orden",
      message: MENSAJE_CANCELAR,
      danger: true,
      confirmLabel: "Cancelar orden",
      cancelLabel: "Volver",
    });
    if (!ok) return;
    try {
      await cancelarOrden(order.id);
      toast("Orden cancelada");
      volverANuevaOrden();
    } catch (e) {
      toast(mensajeError(e));
    }
  }, [order, confirm, toast, volverANuevaOrden]);

  // -------------------------------------------------------------------------
  // Reabrir una orden activa existente para editarla
  // -------------------------------------------------------------------------

  const abrirActivas = useCallback(async () => {
    setMostrarActivas(true);
    try {
      setActivas(await ordenesActivas());
    } catch (e) {
      toast(mensajeError(e));
    }
  }, [toast]);

  const reabrir = useCallback(
    (o: OrderDTO) => {
      setMostrarActivas(false);
      setOrder(o);
      // Stock fresco del servidor: refleja los descuentos ya confirmados.
      cargarMenu();
    },
    [cargarMenu],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (mostrarActivas) {
    return (
      <section className="mx-auto max-w-2xl p-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Órdenes activas</h1>
          <button
            type="button"
            onClick={() => setMostrarActivas(false)}
            className="min-h-[44px] rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Volver
          </button>
        </header>
        <OrdenesActivasList orders={activas} onReabrir={reabrir} />
      </section>
    );
  }

  // Fase 1: componer
  if (!order) {
    const menuLocal = menuConStockLocal(menu, draft.lineas);
    const resumen = resumenBorrador(draft);
    const cartView = {
      items: draft.lineas.map((l) => ({
        id: l.menuItemId,
        nombrePlato: l.nombre,
        precioUnit: l.precioUnit,
        cantidad: l.cantidad,
      })),
      ...resumen,
    };

    return (
      <section className="mx-auto grid max-w-4xl gap-6 p-4 md:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Nueva orden</h1>
            <button
              type="button"
              onClick={abrirActivas}
              className="min-h-[44px] rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Órdenes activas
            </button>
          </header>
          <ChannelFields draft={draft} onChange={cambiarDraft} />
          <MenuGrid items={menuLocal} onAgregar={agregarABorrador} />
        </div>

        <aside className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <h2 className="font-semibold text-foreground">
            Carrito ({totalUnidadesBorrador(draft.lineas)})
          </h2>
          <Cart view={cartView} onQuitar={quitarDeBorrador} />

          {errorBorrador && (
            <p className="text-sm text-destructive">{errorBorrador}</p>
          )}

          <button
            type="button"
            onClick={crear}
            disabled={creando || !puedeCrearBorrador(draft)}
            className="mt-auto min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creando ? "Creando…" : "Crear orden"}
          </button>
        </aside>
      </section>
    );
  }

  // Fase 2: editar la orden
  const editable = permiteEditarItems(order.estado);
  const puedeCancelar = order.estado === OrderStatus.ABIERTA;

  return (
    <section className="mx-auto grid max-w-4xl gap-6 p-4 md:grid-cols-[1fr_20rem]">
      <div>
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            Orden #{order.numero || "—"}
          </h1>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {order.estado}
          </span>
        </header>
        <MenuGrid items={menu} onAgregar={agregar} disabled={!editable} />
      </div>

      <aside className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <h2 className="font-semibold text-foreground">Carrito</h2>
        <Cart view={order} onQuitar={quitar} editable={editable} />

        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={enviar}
            disabled={!puedeEnviarACocina(order)}
            className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Enviar a cocina
          </button>
          {puedeCancelar && (
            <button
              type="button"
              onClick={cancelar}
              className="min-h-[44px] rounded-md border border-destructive px-4 font-medium text-destructive hover:bg-destructive/10"
            >
              Cancelar orden
            </button>
          )}
          <button
            type="button"
            onClick={volverANuevaOrden}
            className="min-h-[44px] rounded-md border border-input px-4 font-medium text-foreground hover:bg-muted"
          >
            Nueva orden
          </button>
        </div>
      </aside>
    </section>
  );
}

/** Ajusta el stock local de un plato del menú (sin consultar el servidor). */
function ajustarStockLocal(
  menu: MenuItemDTO[],
  menuItemId: string,
  delta: number,
): MenuItemDTO[] {
  return menu.map((m) =>
    m.id === menuItemId
      ? { ...m, stockDelDia: Math.max(0, m.stockDelDia + delta) }
      : m,
  );
}

function mensajeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Ocurrió un error. Intenta de nuevo.";
}

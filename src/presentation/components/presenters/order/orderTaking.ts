import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import type { CrearOrdenPayload } from "@/presentation/api/orders";
import type { MenuItemDTO, OrderDTO } from "@/presentation/http/dto";

/**
 * Lógica de vista pura de la pantalla de toma de orden.
 *
 * Sin React ni fetching: mensajes de feedback, validación del formulario de
 * canal (espejo cliente de R4.4/R4.5 para UX inmediata; el dominio sigue siendo
 * la autoridad) y banderas derivadas. Aislado para poder probarlo en Node.
 */

/** Toast al agregar un ítem (R5.3): "{plato} agregado". */
export const mensajeAgregado = (plato: string): string => `${plato} agregado`;

/** Toast sutil al quitar un ítem (R5.4): "{plato} quitado". */
export const mensajeQuitado = (plato: string): string => `${plato} quitado`;

/** Toast al confirmar el envío a cocina (R17.3). */
export const mensajeOrdenEnviada = "Orden enviada a cocina";

/** Mensaje del modal de envío a cocina (R17.3): "Se enviarán N ítems...". */
export function mensajeConfirmarEnvio(numItems: number): string {
  const unidad = numItems === 1 ? "ítem" : "ítems";
  return `Se enviarán ${numItems} ${unidad} a cocina. ¿Continuar?`;
}

/** Mensaje del modal danger de cancelación (R17.2). Texto exacto de la spec. */
export const MENSAJE_CANCELAR =
  "Se cancelará y quedará en el historial de auditoría. ¿Continuar?";

export interface ChannelFormData {
  canal: OrderChannel;
  mesa?: number | null;
  clienteNombre?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
}

/**
 * Valida los datos requeridos según el canal (R4.4, R4.5). Devuelve el mensaje
 * de error para mostrar inline, o `null` si es válido.
 */
export function validarDatosDeCanal(data: ChannelFormData): string | null {
  if (data.canal === OrderChannel.SALON) {
    if (data.mesa == null || !Number.isInteger(data.mesa) || data.mesa <= 0) {
      return "Ingresa el número de mesa";
    }
  }
  if (data.canal === OrderChannel.DELIVERY) {
    if (!data.clienteDireccion || data.clienteDireccion.trim() === "") {
      return "Ingresa la dirección del cliente";
    }
  }
  return null;
}

/** Un plato se puede agregar solo si está disponible y con stock (R3, R5.1). */
export function puedeAgregarPlato(item: MenuItemDTO): boolean {
  return item.disponible && item.stockDelDia > 0;
}

/**
 * Estados en los que la orden admite editar ítems (R5.1, R5.5): `ABIERTA`,
 * `EN_PREPARACION` (agregar/quitar) y `ENTREGADA` (running tab, agregar).
 */
export function permiteEditarItems(estado: OrderDTO["estado"]): boolean {
  return (
    estado === OrderStatus.ABIERTA ||
    estado === OrderStatus.EN_PREPARACION ||
    estado === OrderStatus.ENTREGADA
  );
}

/** Solo se envía a cocina desde `ABIERTA` y con al menos un ítem (R6.1). */
export function puedeEnviarACocina(order: OrderDTO): boolean {
  return order.estado === OrderStatus.ABIERTA && order.items.length > 0;
}

/** Total de unidades en la orden (suma de cantidades). */
export function totalUnidades(order: OrderDTO): number {
  return order.items.reduce((acc, it) => acc + it.cantidad, 0);
}

// ---------------------------------------------------------------------------
// Borrador de orden (compose): arma la orden completa en memoria y se crea al
// final en una sola operación. El stock se descuenta localmente sobre el menú
// ya cargado; no se vuelve a consultar el servidor por cada ítem.
// ---------------------------------------------------------------------------

/** Recargo fijo de envases en DELIVERY/RETIRAR (espejo de R8.2 en cliente). */
export const RECARGO_ENVASES = 0.5;

/** Una línea del carrito en el borrador (aún sin persistir). */
export interface DraftLine {
  menuItemId: string;
  nombre: string;
  precioUnit: number;
  cantidad: number;
}

/** Datos de canal editables del borrador (mesa/envío como texto de input). */
export interface OrderDraft {
  canal: OrderChannel;
  mesa: string;
  clienteNombre: string;
  clienteDireccion: string;
  clienteTelefono: string;
  envio: string;
  lineas: DraftLine[];
}

/** Borrador vacío inicial (canal SALON por defecto). */
export function borradorInicial(): OrderDraft {
  return {
    canal: OrderChannel.SALON,
    mesa: "",
    clienteNombre: "",
    clienteDireccion: "",
    clienteTelefono: "",
    envio: "",
    lineas: [],
  };
}

/** Cantidad de un plato ya presente en el carrito del borrador. */
export function cantidadEnBorrador(
  lineas: readonly DraftLine[],
  menuItemId: string,
): number {
  return lineas.find((l) => l.menuItemId === menuItemId)?.cantidad ?? 0;
}

/** Agrega una unidad del plato al borrador (o incrementa su cantidad). */
export function agregarAlBorrador(
  lineas: readonly DraftLine[],
  item: MenuItemDTO,
): DraftLine[] {
  const existente = lineas.find((l) => l.menuItemId === item.id);
  if (existente) {
    return lineas.map((l) =>
      l.menuItemId === item.id ? { ...l, cantidad: l.cantidad + 1 } : l,
    );
  }
  return [
    ...lineas,
    {
      menuItemId: item.id,
      nombre: item.nombre,
      precioUnit: item.precio,
      cantidad: 1,
    },
  ];
}

/** Quita una unidad del plato del borrador; elimina la línea al llegar a 0. */
export function quitarDelBorrador(
  lineas: readonly DraftLine[],
  menuItemId: string,
): DraftLine[] {
  return lineas
    .map((l) =>
      l.menuItemId === menuItemId ? { ...l, cantidad: l.cantidad - 1 } : l,
    )
    .filter((l) => l.cantidad > 0);
}

/**
 * Menú con el stock ajustado por lo que ya está en el carrito, para que el grid
 * refleje el stock restante sin volver a consultar al servidor (evita el fetch
 * por ítem). Un plato cuyo stock local llega a 0 queda deshabilitado.
 */
export function menuConStockLocal(
  menu: readonly MenuItemDTO[],
  lineas: readonly DraftLine[],
): MenuItemDTO[] {
  return menu.map((item) => {
    const enCarrito = cantidadEnBorrador(lineas, item.id);
    if (enCarrito === 0) return item;
    return { ...item, stockDelDia: Math.max(0, item.stockDelDia - enCarrito) };
  });
}

/** Resumen de montos del borrador (subtotal, envases, envío, total). */
export interface ResumenBorrador {
  subtotal: number;
  envases: number;
  envio: number;
  total: number;
}

/** Calcula los montos del borrador replicando las reglas del dominio (R8). */
export function resumenBorrador(draft: OrderDraft): ResumenBorrador {
  const subtotal = draft.lineas.reduce(
    (acc, l) => acc + l.precioUnit * l.cantidad,
    0,
  );
  const envases =
    draft.canal === OrderChannel.DELIVERY || draft.canal === OrderChannel.RETIRAR
      ? RECARGO_ENVASES
      : 0;
  const envio =
    draft.canal === OrderChannel.DELIVERY ? Number(draft.envio) || 0 : 0;
  return { subtotal, envases, envio, total: subtotal + envases + envio };
}

/** Total de unidades en el borrador. */
export function totalUnidadesBorrador(lineas: readonly DraftLine[]): number {
  return lineas.reduce((acc, l) => acc + l.cantidad, 0);
}

/** El borrador se puede crear si tiene al menos un ítem y el canal es válido. */
export function puedeCrearBorrador(draft: OrderDraft): boolean {
  return draft.lineas.length > 0 && validarDatosDeCanal(draftAChannelData(draft)) === null;
}

/** Proyecta el borrador a los datos de canal para validación. */
function draftAChannelData(draft: OrderDraft): ChannelFormData {
  return {
    canal: draft.canal,
    mesa: draft.mesa.trim() === "" ? null : Number(draft.mesa),
    clienteNombre: draft.clienteNombre.trim() || null,
    clienteDireccion: draft.clienteDireccion.trim() || null,
    clienteTelefono: draft.clienteTelefono.trim() || null,
  };
}

/** Valida el borrador (datos de canal). Devuelve mensaje inline o `null`. */
export function validarBorrador(draft: OrderDraft): string | null {
  return validarDatosDeCanal(draftAChannelData(draft));
}

/** Construye el payload de creación a partir del borrador. */
export function borradorAPayload(draft: OrderDraft): CrearOrdenPayload {
  const datos = draftAChannelData(draft);
  return {
    canal: datos.canal,
    mesa: datos.mesa,
    clienteNombre: datos.clienteNombre,
    clienteDireccion: datos.clienteDireccion,
    clienteTelefono: datos.clienteTelefono,
    envio:
      draft.canal === OrderChannel.DELIVERY && draft.envio.trim() !== ""
        ? Number(draft.envio)
        : undefined,
    items: draft.lineas.map((l) => ({
      menuItemId: l.menuItemId,
      cantidad: l.cantidad,
    })),
  };
}

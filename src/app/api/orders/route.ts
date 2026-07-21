import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import { OrderChannel } from "@/domain/order/OrderChannel";
import type { CrearOrdenItemInput } from "@/application/use-cases/orders/CrearOrdenConItems";
import { getCrearOrdenConItems } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

interface CrearOrdenBody {
  canal?: unknown;
  mesa?: unknown;
  clienteNombre?: unknown;
  clienteDireccion?: unknown;
  clienteTelefono?: unknown;
  envio?: unknown;
  items?: unknown;
}

/**
 * `POST /api/orders` (R4, R5.1). Crea una orden en estado `ABIERTA` con
 * validación por canal (mesa en SALON, dirección en DELIVERY) y, opcionalmente,
 * con los ítems del carrito en una sola operación transaccional que descuenta
 * el stock de cada plato (`CrearOrdenConItems`). El creador es el usuario de la
 * sesión. Si no se envían ítems, se crea la orden vacía.
 */
export async function POST(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: CrearOrdenBody;
  try {
    body = (await request.json()) as CrearOrdenBody;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  if (!esCanalValido(body.canal)) {
    return badRequest("Canal inválido");
  }

  const items = parseItems(body.items);
  if (items === null) {
    return badRequest("Ítems inválidos");
  }

  const resultado = await getCrearOrdenConItems().ejecutar({
    canal: body.canal,
    creadoPorId: session.id,
    mesa: typeof body.mesa === "number" ? body.mesa : null,
    clienteNombre:
      typeof body.clienteNombre === "string" ? body.clienteNombre : null,
    clienteDireccion:
      typeof body.clienteDireccion === "string" ? body.clienteDireccion : null,
    clienteTelefono:
      typeof body.clienteTelefono === "string" ? body.clienteTelefono : null,
    envio: typeof body.envio === "number" ? Money.de(body.envio) : undefined,
    items,
  });

  return respondResult(resultado, toOrderDTO, 201);
}

function esCanalValido(v: unknown): v is OrderChannel {
  return (
    typeof v === "string" &&
    (Object.values(OrderChannel) as string[]).includes(v)
  );
}

/**
 * Normaliza `body.items` a una lista de líneas válidas. Devuelve `[]` si no se
 * envían ítems (orden vacía) y `null` si el formato es inválido (para responder
 * 400 sin llegar al caso de uso).
 */
function parseItems(raw: unknown): CrearOrdenItemInput[] | null {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const items: CrearOrdenItemInput[] = [];
  for (const linea of raw) {
    if (typeof linea !== "object" || linea === null) {
      return null;
    }
    const { menuItemId, cantidad } = linea as {
      menuItemId?: unknown;
      cantidad?: unknown;
    };
    if (
      typeof menuItemId !== "string" ||
      menuItemId.trim() === "" ||
      typeof cantidad !== "number" ||
      !Number.isInteger(cantidad) ||
      cantidad <= 0
    ) {
      return null;
    }
    items.push({ menuItemId, cantidad });
  }
  return items;
}

// Fuente unica de la navegacion. No importa React a proposito: es data mas
// funciones puras, asi el drawer, la barra inferior y la topbar rinden lo
// mismo y esto se puede testear con ts-node.
//
// Escala de z-index de la app (los componentes usan las clases literales):
//   barra inferior / topbar   z-30
//   banner SSE de cocina      z-40
//   overlay del drawer        z-50
//   panel del drawer          z-[51]
//   modales                   z-[60]
//   modal anidado             z-[70]

export type Rol = "mesero" | "digital" | "cocina" | "admin";

export interface ContextoNav {
  permisoNotificaciones: NotificationPermission | "no-soportado";
}

export interface EntradaNav {
  id: string;
  label: string;
  emoji: string;
  href: string;
  hijos?: EntradaNav[];
  enBarraInferior?: boolean;
  labelCorto?: string;
  visible?: (ctx: ContextoNav) => boolean;
}

export interface SeccionNav {
  titulo: string;
  items: EntradaNav[];
}

export interface Acento {
  texto: string;
  fondo: string;
  borde: string;
}

export const ACENTO_POR_ROL: Record<Rol, Acento> = {
  mesero: {
    texto: "text-blue-600",
    fondo: "bg-blue-50",
    borde: "border-blue-600",
  },
  digital: {
    texto: "text-indigo-600",
    fondo: "bg-indigo-50",
    borde: "border-indigo-600",
  },
  cocina: {
    texto: "text-amber-600",
    fondo: "bg-amber-50",
    borde: "border-amber-600",
  },
  admin: {
    texto: "text-slate-700",
    fondo: "bg-slate-100",
    borde: "border-slate-700",
  },
};

export const ACENTO_NEUTRO: Acento = {
  texto: "text-gray-700",
  fondo: "bg-gray-100",
  borde: "border-gray-700",
};

const SESION: SeccionNav = {
  titulo: "Sesión",
  items: [
    { id: "logout", label: "Cerrar sesión", emoji: "🚪", href: "#logout" },
  ],
};

const NAV_POR_ROL: Record<Rol, SeccionNav[]> = {
  mesero: [
    {
      titulo: "Operación",
      items: [
        {
          id: "crear",
          label: "Crear orden",
          labelCorto: "Crear",
          emoji: "➕",
          href: "/mesero?vista=crear",
          enBarraInferior: true,
        },
        {
          id: "ordenes",
          label: "Mis órdenes",
          labelCorto: "Órdenes",
          emoji: "📋",
          href: "/mesero?vista=ordenes",
          enBarraInferior: true,
        },
      ],
    },
    {
      titulo: "Caja",
      items: [
        {
          id: "retiro",
          label: "Retiro de caja",
          labelCorto: "Retiro",
          emoji: "💸",
          href: "/mesero?vista=retiro",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
  digital: [
    {
      titulo: "Operación",
      items: [
        {
          id: "crear",
          label: "Nuevo pedido",
          labelCorto: "Nuevo",
          emoji: "➕",
          href: "/digital?vista=crear",
          enBarraInferior: true,
        },
        {
          id: "pedidos",
          label: "Mis pedidos",
          labelCorto: "Pedidos",
          emoji: "📋",
          href: "/digital?vista=pedidos",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
  cocina: [
    {
      titulo: "Operación",
      items: [
        {
          id: "monitor",
          label: "Monitor de cocina",
          emoji: "🍳",
          href: "/cocina",
        },
      ],
    },
    {
      titulo: "Preferencias",
      items: [
        {
          id: "notificaciones",
          label: "Activar notificaciones",
          emoji: "🔔",
          href: "#notificaciones",
          visible: (ctx) => ctx.permisoNotificaciones === "default",
        },
      ],
    },
    SESION,
  ],
  admin: [
    {
      titulo: "Cuadre",
      items: [
        {
          id: "cuadre",
          label: "Cuadre de caja",
          labelCorto: "Cuadre",
          emoji: "💵",
          href: "/admin",
          enBarraInferior: true,
        },
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        {
          id: "productos",
          label: "Productos",
          emoji: "📦",
          href: "/admin/productos?tab=stock",
          enBarraInferior: true,
          hijos: [
            {
              id: "stock",
              label: "Stock",
              emoji: "📦",
              href: "/admin/productos?tab=stock",
            },
            {
              id: "menu",
              label: "Menú",
              emoji: "🍽️",
              href: "/admin/productos?tab=menu",
            },
          ],
        },
      ],
    },
    {
      titulo: "Análisis",
      items: [
        {
          id: "reportes",
          label: "Reportes",
          emoji: "📊",
          href: "/admin/reportes?tab=modificaciones",
          enBarraInferior: true,
          hijos: [
            {
              id: "modificaciones",
              label: "Modificaciones",
              emoji: "✏️",
              href: "/admin/reportes?tab=modificaciones",
            },
            {
              id: "cortesias",
              label: "Cortesías",
              emoji: "🎁",
              href: "/admin/reportes?tab=cortesias",
            },
          ],
        },
      ],
    },
    {
      titulo: "Equipo",
      items: [
        {
          id: "usuarios",
          label: "Usuarios",
          emoji: "👥",
          href: "/admin/usuarios",
          enBarraInferior: true,
        },
      ],
    },
    SESION,
  ],
};

const MAX_BARRA_INFERIOR = 4;
const MIN_BARRA_INFERIOR = 2;

export function esRolConocido(rol: string): rol is Rol {
  return rol in NAV_POR_ROL;
}

export function acentoDeRol(rol: string): Acento {
  return esRolConocido(rol) ? ACENTO_POR_ROL[rol] : ACENTO_NEUTRO;
}

export function resolverNav(rol: string, ctx: ContextoNav): SeccionNav[] {
  // `Usuario.rol` es String en el schema, no un enum, asi que un rol nuevo en
  // la BD no debe romper la app: cae a un nav con solo cerrar sesion.
  const secciones = esRolConocido(rol) ? NAV_POR_ROL[rol] : [SESION];

  return secciones
    .map((seccion) => ({
      ...seccion,
      items: seccion.items.filter((item) => item.visible?.(ctx) ?? true),
    }))
    .filter((seccion) => seccion.items.length > 0);
}

// Un padre queda activo cuando lo esta cualquiera de sus hijos: en
// /admin/productos?tab=menu el destino activo es "menu", pero la barra
// inferior y el drawer listan "productos".
export function esItemActivo(item: EntradaNav, activoId: string): boolean {
  return (
    item.id === activoId ||
    (item.hijos?.some((hijo) => hijo.id === activoId) ?? false)
  );
}

export function itemsBarraInferior(secciones: SeccionNav[]): EntradaNav[] {
  const items = secciones
    .flatMap((seccion) => seccion.items)
    .filter((item) => item.enBarraInferior)
    .slice(0, MAX_BARRA_INFERIOR);

  return items.length >= MIN_BARRA_INFERIOR ? items : [];
}

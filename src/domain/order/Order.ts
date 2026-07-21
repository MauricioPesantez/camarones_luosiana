import { DomainError } from "../shared/DomainError";
import { MetodoPago } from "./MetodoPago";
import { Money } from "./Money";
import { OrderChannel } from "./OrderChannel";
import { OrderStatus } from "./OrderStatus";
import { OrderItem } from "./OrderItem";

/**
 * Propiedades para crear o reconstituir una `Order` (p. ej. desde el
 * repositorio).
 *
 * Los montos (`envio`, `envases`, `subtotal`, `total`) y el `estado` son
 * opcionales: al crear una orden nueva toman sus valores por defecto
 * (cero y `ABIERTA`). El repositorio, al reconstituir, los provee con los
 * valores persistidos.
 */
export interface OrderProps {
  id: string;
  /** Número visible para el usuario ("#N"); autoincremental en persistencia. */
  numero: number;
  canal: OrderChannel;
  estado?: OrderStatus;
  mesa?: number | null;
  clienteNombre?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  envio?: Money;
  envases?: Money;
  subtotal?: Money;
  total?: Money;
  /** Método de pago con el que se cobró la orden (null hasta el cobro, R9.1). */
  metodoPago?: MetodoPago | null;
  /** URL del comprobante de transferencia asociado a la orden (R9.3). */
  comprobanteUrl?: string | null;
  items?: OrderItem[];
  /** Id del usuario que creó la orden. */
  creadoPorId: string;
}

/**
 * Entidad `Order`: el pedido de un cliente con uno o más ítems, un canal y un
 * estado (R4, R5, R6, R8).
 *
 * Esta tarea (4.1) define la estructura de la entidad: identidad, datos de
 * cliente/canal, ítems y los campos de monto mutables con sus getters. La
 * lógica de negocio se incorpora en tareas posteriores dejando "costuras"
 * claras:
 * - `recalcular()` (subtotal, envases por canal, envío, total) → Tarea 4.2.
 * - `transicionarA(estado, contexto)` (máquina de estados) → Tarea 4.3.
 *
 * Los campos de monto se mantienen como privados mutables con getters de solo
 * lectura, de modo que el cálculo de totales sea la única vía para mutarlos
 * (el total nunca se edita a mano; ver Property 2 del diseño).
 */
export class Order {
  private constructor(
    readonly id: string,
    readonly numero: number,
    readonly canal: OrderChannel,
    readonly creadoPorId: string,
    private _estado: OrderStatus,
    private _mesa: number | null,
    private _clienteNombre: string | null,
    private _clienteDireccion: string | null,
    private _clienteTelefono: string | null,
    private _envio: Money,
    private _envases: Money,
    private _subtotal: Money,
    private _total: Money,
    private _metodoPago: MetodoPago | null,
    private _comprobanteUrl: string | null,
    private readonly _items: OrderItem[],
  ) {}

  /**
   * Crea una `Order` validando sus invariantes básicas: `id` y `creadoPorId`
   * no vacíos, y `numero` entero. El estado inicial por defecto es `ABIERTA`
   * (R4.1, R4.2, R4.3) y los montos por defecto son cero.
   *
   * Las reglas de datos requeridos por canal (mesa en `SALON`, dirección en
   * `DELIVERY`) se validan en el caso de uso `CrearOrden` (Tarea 13.1).
   */
  static crear(props: OrderProps): Order {
    const id = props.id?.trim();
    if (!id) {
      throw new DomainError("La orden requiere un id", "ORDER_ID_VACIO");
    }
    const creadoPorId = props.creadoPorId?.trim();
    if (!creadoPorId) {
      throw new DomainError(
        "La orden requiere el id del usuario creador",
        "ORDER_CREADO_POR_VACIO",
      );
    }
    if (!Number.isInteger(props.numero)) {
      throw new DomainError(
        "El número de orden debe ser un entero",
        "ORDER_NUMERO_INVALIDO",
      );
    }

    return new Order(
      id,
      props.numero,
      props.canal,
      creadoPorId,
      props.estado ?? OrderStatus.ABIERTA,
      props.mesa ?? null,
      props.clienteNombre ?? null,
      props.clienteDireccion ?? null,
      props.clienteTelefono ?? null,
      props.envio ?? Money.cero(),
      props.envases ?? Money.cero(),
      props.subtotal ?? Money.cero(),
      props.total ?? Money.cero(),
      props.metodoPago ?? null,
      props.comprobanteUrl ?? null,
      props.items ? [...props.items] : [],
    );
  }

  get estado(): OrderStatus {
    return this._estado;
  }

  /**
   * Tabla de transiciones permitidas de la máquina de estados (R6).
   *
   * Mapea cada estado de origen al conjunto de estados destino alcanzables.
   * Es data-driven y pura: la lógica de `transicionarA` solo consulta este
   * mapa. Los estados terminales (`CERRADA`, `CANCELADA`) tienen una lista
   * vacía y por tanto rechazan toda transición (R6.7).
   *
   * - ABIERTA → ENVIADA_A_COCINA (R6.1) | CANCELADA (R6.8)
   * - ENVIADA_A_COCINA → EN_PREPARACION (R6.2) | CANCELADA (solo admin, R7.1/R7.2)
   * - EN_PREPARACION → LISTA (R6.3) | CANCELADA (solo admin, R7.1/R7.2)
   * - LISTA → ENTREGADA (R6.4)
   * - ENTREGADA → ENTREGADA (cuenta abierta) | COBRADA (R6.5)
   * - COBRADA → CERRADA (R6.6) | CANCELADA (solo admin, R7.2)
   * - CERRADA → (terminal)
   * - CANCELADA → (terminal)
   */
  private static readonly TRANSICIONES: Readonly<
    Record<OrderStatus, readonly OrderStatus[]>
  > = {
    [OrderStatus.ABIERTA]: [OrderStatus.ENVIADA_A_COCINA, OrderStatus.CANCELADA],
    [OrderStatus.ENVIADA_A_COCINA]: [
      OrderStatus.EN_PREPARACION,
      OrderStatus.CANCELADA,
    ],
    [OrderStatus.EN_PREPARACION]: [OrderStatus.LISTA, OrderStatus.CANCELADA],
    [OrderStatus.LISTA]: [OrderStatus.ENTREGADA],
    [OrderStatus.ENTREGADA]: [OrderStatus.ENTREGADA, OrderStatus.COBRADA],
    [OrderStatus.COBRADA]: [OrderStatus.CERRADA, OrderStatus.CANCELADA],
    [OrderStatus.CERRADA]: [],
    [OrderStatus.CANCELADA]: [],
  };

  /**
   * Estados de origen desde los cuales una cancelación requiere privilegios de
   * administrador (R7.1, R7.2). Cancelar desde `ABIERTA` no requiere admin
   * (R6.8).
   */
  private static readonly CANCELACION_REQUIERE_ADMIN: readonly OrderStatus[] = [
    OrderStatus.ENVIADA_A_COCINA,
    OrderStatus.EN_PREPARACION,
    OrderStatus.COBRADA,
  ];

  /** Indica si el estado actual es terminal (no admite más transiciones). */
  esTerminal(): boolean {
    return Order.TRANSICIONES[this._estado].length === 0;
  }

  /**
   * Indica si, desde el estado actual, es posible transicionar a `nuevoEstado`
   * bajo el `contexto` dado, sin mutar la orden. Útil para la UI y para evitar
   * `try/catch` cuando solo se quiere consultar.
   */
  puedeTransicionarA(
    nuevoEstado: OrderStatus,
    contexto?: { esAdmin?: boolean },
  ): boolean {
    const permitido = Order.TRANSICIONES[this._estado].includes(nuevoEstado);
    if (!permitido) {
      return false;
    }
    if (
      nuevoEstado === OrderStatus.CANCELADA &&
      Order.CANCELACION_REQUIERE_ADMIN.includes(this._estado)
    ) {
      return contexto?.esAdmin === true;
    }
    return true;
  }

  /**
   * Aplica una transición de la máquina de estados (R6, R7).
   *
   * Reglas:
   * - Si el par (origen → `nuevoEstado`) no está en la tabla de transiciones
   *   permitidas, lanza `DomainError` (`ORDER_TRANSICION_INVALIDA`) y conserva
   *   el estado actual (R6.7). Los estados terminales (`CERRADA`, `CANCELADA`)
   *   rechazan toda transición.
   * - Cancelar desde `ENVIADA_A_COCINA`, `EN_PREPARACION` o `COBRADA` requiere
   *   `contexto.esAdmin === true`; en caso contrario lanza `DomainError`
   *   (`ORDER_CANCELACION_REQUIERE_ADMIN`) y conserva el estado (R7.1, R7.2).
   *   Cancelar desde `ABIERTA` no requiere admin (R6.8).
   *
   * Este método solo hace cumplir la máquina de estados y la regla de admin.
   * Los efectos colaterales (restauración de stock, auditoría) viven en los
   * casos de uso (Tareas 13.x).
   */
  transicionarA(
    nuevoEstado: OrderStatus,
    contexto?: { esAdmin?: boolean },
  ): void {
    const permitidos = Order.TRANSICIONES[this._estado];
    if (!permitidos.includes(nuevoEstado)) {
      throw new DomainError(
        `Transición no permitida de ${this._estado} a ${nuevoEstado}`,
        "ORDER_TRANSICION_INVALIDA",
      );
    }

    if (
      nuevoEstado === OrderStatus.CANCELADA &&
      Order.CANCELACION_REQUIERE_ADMIN.includes(this._estado) &&
      contexto?.esAdmin !== true
    ) {
      throw new DomainError(
        `Cancelar una orden en estado ${this._estado} requiere privilegios de administrador`,
        "ORDER_CANCELACION_REQUIERE_ADMIN",
      );
    }

    this._estado = nuevoEstado;
  }

  /**
   * Registra el cobro de la orden (R6.5, R9.2, R9.3): transiciona el estado de
   * `ENTREGADA` a `COBRADA` (haciendo cumplir la máquina de estados) y asienta
   * el `metodoPago` y, cuando aplica, la `comprobanteUrl` del comprobante de
   * transferencia asociado.
   *
   * Delega en `transicionarA` la validación de estado: si la orden no está en
   * `ENTREGADA` lanza `ORDER_TRANSICION_INVALIDA` sin mutar el método de pago
   * (idempotencia: una orden ya `COBRADA` no admite un segundo cobro). Los
   * efectos sobre la caja (movimientos) los orquesta el caso de uso
   * `CobrarOrden` dentro de la misma transacción.
   */
  registrarCobro(metodoPago: MetodoPago, comprobanteUrl?: string | null): void {
    this.transicionarA(OrderStatus.COBRADA);
    this._metodoPago = metodoPago;
    this._comprobanteUrl = comprobanteUrl ?? null;
  }

  get mesa(): number | null {
    return this._mesa;
  }

  get clienteNombre(): string | null {
    return this._clienteNombre;
  }

  get clienteDireccion(): string | null {
    return this._clienteDireccion;
  }

  get clienteTelefono(): string | null {
    return this._clienteTelefono;
  }

  get envio(): Money {
    return this._envio;
  }

  get envases(): Money {
    return this._envases;
  }

  get subtotal(): Money {
    return this._subtotal;
  }

  get total(): Money {
    return this._total;
  }

  /** Método de pago con el que se cobró la orden, o `null` si aún no se cobra (R9.1). */
  get metodoPago(): MetodoPago | null {
    return this._metodoPago;
  }

  /** URL del comprobante de transferencia asociado, o `null` si no aplica (R9.3). */
  get comprobanteUrl(): string | null {
    return this._comprobanteUrl;
  }

  /** Copia defensiva de los ítems de la orden (no permite mutar el arreglo interno). */
  get items(): readonly OrderItem[] {
    return [...this._items];
  }

  /**
   * Agrega un ítem a la orden (gestión trivial del arreglo). El recálculo de
   * totales tras agregar lo realiza `recalcular()` (Tarea 4.2), invocado por el
   * caso de uso `AgregarItemAOrden`.
   */
  agregarItem(item: OrderItem): void {
    this._items.push(item);
  }

  /**
   * Quita un ítem de la orden por su id y lo devuelve (o `null` si no existe).
   * El recálculo de totales y la restauración de stock los gestiona el caso de
   * uso `QuitarItem` (Tarea 4.2 / Tarea 13.2).
   */
  quitarItem(itemId: string): OrderItem | null {
    const indice = this._items.findIndex((it) => it.id === itemId);
    if (indice === -1) {
      return null;
    }
    const [removido] = this._items.splice(indice, 1);
    return removido;
  }

  /** Recargo_Envases fijo aplicado a las órdenes `DELIVERY` y `RETIRAR` (R8.2). */
  private static readonly RECARGO_ENVASES = Money.de(0.5);

  /**
   * Registra el valor variable del Envio (carrera) de una orden de delivery
   * (R8.4). El monto debe ser no negativo y solo se admite cuando el canal es
   * `DELIVERY`; en otros canales no existe envío y se rechaza la operación.
   *
   * Tras establecer el envío conviene invocar `recalcular()` para reflejar el
   * nuevo valor en el `total`.
   */
  establecerEnvio(monto: Money): void {
    if (this.canal !== OrderChannel.DELIVERY) {
      throw new DomainError(
        "El envío solo aplica a órdenes de canal DELIVERY",
        "ORDER_ENVIO_CANAL_INVALIDO",
      );
    }
    if (monto.esNegativo()) {
      throw new DomainError(
        "El envío no puede ser negativo",
        "ORDER_ENVIO_NEGATIVO",
      );
    }
    this._envio = monto;
  }

  /**
   * Recalcula los montos derivados de la orden a partir de sus ítems y su canal
   * (R8). Es la única vía para mutar `subtotal`, `envases`, `envio` y `total`
   * (el total nunca se edita a mano; ver Property 2 del diseño):
   *
   * - `subtotal` = Σ (`precioUnit` × `cantidad`) de todos los ítems (R8.1).
   * - `envases` = $0.50 si el canal es `DELIVERY` o `RETIRAR`; $0.00 en `SALON`
   *   (R8.2, R8.3).
   * - `envio` = el valor variable ya registrado solo en `DELIVERY`; se fuerza a
   *   cero en los demás canales (R8.4).
   * - `total` = `subtotal` + `envases` + `envio` (R8.5).
   *
   * Es idempotente: invocarla dos veces sin cambiar ítems ni canal produce los
   * mismos montos.
   */
  recalcular(): void {
    this._subtotal = this._items.reduce(
      (acc, item) => acc.suma(item.importe()),
      Money.cero(),
    );

    this._envases =
      this.canal === OrderChannel.DELIVERY || this.canal === OrderChannel.RETIRAR
        ? Order.RECARGO_ENVASES
        : Money.cero();

    // El envío solo aplica a DELIVERY; en otros canales se anula.
    if (this.canal !== OrderChannel.DELIVERY) {
      this._envio = Money.cero();
    }

    this._total = this._subtotal.suma(this._envases).suma(this._envio);
  }
}

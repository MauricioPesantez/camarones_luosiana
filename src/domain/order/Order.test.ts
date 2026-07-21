import { describe, it, expect } from "vitest";
import { Order } from "./Order";
import { OrderItem } from "./OrderItem";
import { Money } from "./Money";
import { OrderChannel } from "./OrderChannel";
import { OrderStatus } from "./OrderStatus";
import { DomainError } from "../shared/DomainError";

function crearOrden(overrides: Partial<Parameters<typeof Order.crear>[0]> = {}) {
  return Order.crear({
    id: "ord-1",
    numero: 1,
    canal: OrderChannel.SALON,
    creadoPorId: "user-1",
    ...overrides,
  });
}

function crearItem(id: string, cantidad = 1) {
  return OrderItem.crear({
    id,
    menuItemId: "mi-1",
    nombrePlato: "Ceviche",
    precioUnit: Money.de(5),
    cantidad,
  });
}

describe("Order", () => {
  describe("creación", () => {
    it("crea una orden con estado inicial ABIERTA y montos en cero (R4.1)", () => {
      const orden = crearOrden();
      expect(orden.id).toBe("ord-1");
      expect(orden.numero).toBe(1);
      expect(orden.canal).toBe(OrderChannel.SALON);
      expect(orden.estado).toBe(OrderStatus.ABIERTA);
      expect(orden.envio.esCero()).toBe(true);
      expect(orden.envases.esCero()).toBe(true);
      expect(orden.subtotal.esCero()).toBe(true);
      expect(orden.total.esCero()).toBe(true);
      expect(orden.items).toEqual([]);
    });

    it("conserva los datos de cliente para canal DELIVERY (R4.2)", () => {
      const orden = crearOrden({
        canal: OrderChannel.DELIVERY,
        clienteNombre: "Ana",
        clienteDireccion: "Av. Solano 123",
        clienteTelefono: "099",
      });
      expect(orden.canal).toBe(OrderChannel.DELIVERY);
      expect(orden.clienteNombre).toBe("Ana");
      expect(orden.clienteDireccion).toBe("Av. Solano 123");
      expect(orden.clienteTelefono).toBe("099");
    });

    it("registra el número de mesa para canal SALON (R4.1)", () => {
      expect(crearOrden({ canal: OrderChannel.SALON, mesa: 3 }).mesa).toBe(3);
    });

    it("rechaza id o creador vacíos y número no entero", () => {
      expect(() => crearOrden({ id: "  " })).toThrow(DomainError);
      expect(() => crearOrden({ creadoPorId: "" })).toThrow(DomainError);
      expect(() => crearOrden({ numero: 1.5 })).toThrow(DomainError);
    });
  });

  describe("gestión de ítems", () => {
    it("agrega ítems y expone una copia defensiva del arreglo", () => {
      const orden = crearOrden();
      orden.agregarItem(crearItem("oi-1"));
      orden.agregarItem(crearItem("oi-2"));
      expect(orden.items).toHaveLength(2);

      // Mutar la copia no afecta el estado interno de la orden.
      const copia = orden.items as OrderItem[];
      copia.pop();
      expect(orden.items).toHaveLength(2);
    });

    it("quita un ítem por id y lo devuelve; null si no existe", () => {
      const orden = crearOrden();
      const item = crearItem("oi-1");
      orden.agregarItem(item);

      expect(orden.quitarItem("inexistente")).toBeNull();
      expect(orden.quitarItem("oi-1")).toBe(item);
      expect(orden.items).toHaveLength(0);
    });
  });

  describe("recalcular (totales por canal, R8)", () => {
    it("SALON: sin envases ni envío; total = subtotal (R8.1, R8.3)", () => {
      const orden = crearOrden({ canal: OrderChannel.SALON });
      orden.agregarItem(crearItem("oi-1", 2)); // 5.00 × 2 = 10.00
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(10);
      expect(orden.envases.toDecimal()).toBe(0);
      expect(orden.envio.toDecimal()).toBe(0);
      expect(orden.total.toDecimal()).toBe(10);
    });

    it("DELIVERY: envases 0.50 + envío variable; total = subtotal + 0.50 + envío (R8.2, R8.4, R8.5)", () => {
      const orden = crearOrden({ canal: OrderChannel.DELIVERY });
      orden.agregarItem(crearItem("oi-1", 2)); // 10.00
      orden.establecerEnvio(Money.de(1.5));
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(10);
      expect(orden.envases.toDecimal()).toBe(0.5);
      expect(orden.envio.toDecimal()).toBe(1.5);
      expect(orden.total.toDecimal()).toBe(12);
    });

    it("RETIRAR: envases 0.50 sin envío; total = subtotal + 0.50 (R8.2, R8.5)", () => {
      const orden = crearOrden({ canal: OrderChannel.RETIRAR });
      orden.agregarItem(crearItem("oi-1", 1)); // 5.00
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(5);
      expect(orden.envases.toDecimal()).toBe(0.5);
      expect(orden.envio.toDecimal()).toBe(0);
      expect(orden.total.toDecimal()).toBe(5.5);
    });

    it("suma correctamente varios ítems con sus cantidades (R8.1)", () => {
      const orden = crearOrden({ canal: OrderChannel.SALON });
      orden.agregarItem(crearItem("oi-1", 3)); // 5.00 × 3 = 15.00
      orden.agregarItem(crearItem("oi-2", 2)); // 5.00 × 2 = 10.00
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(25);
      expect(orden.total.toDecimal()).toBe(25);
    });

    it("es idempotente: recalcular dos veces da los mismos montos", () => {
      const orden = crearOrden({ canal: OrderChannel.DELIVERY });
      orden.agregarItem(crearItem("oi-1", 2));
      orden.establecerEnvio(Money.de(2));

      orden.recalcular();
      const subtotal1 = orden.subtotal.toDecimal();
      const envases1 = orden.envases.toDecimal();
      const envio1 = orden.envio.toDecimal();
      const total1 = orden.total.toDecimal();

      orden.recalcular();
      expect(orden.subtotal.toDecimal()).toBe(subtotal1);
      expect(orden.envases.toDecimal()).toBe(envases1);
      expect(orden.envio.toDecimal()).toBe(envio1);
      expect(orden.total.toDecimal()).toBe(total1);
    });

    it("orden vacía SALON: subtotal y total en cero", () => {
      const orden = crearOrden({ canal: OrderChannel.SALON });
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(0);
      expect(orden.total.toDecimal()).toBe(0);
    });

    it("orden vacía DELIVERY: total = 0.50 + envío aunque no haya ítems", () => {
      const orden = crearOrden({ canal: OrderChannel.DELIVERY });
      orden.establecerEnvio(Money.de(2.5));
      orden.recalcular();

      expect(orden.subtotal.toDecimal()).toBe(0);
      expect(orden.envases.toDecimal()).toBe(0.5);
      expect(orden.envio.toDecimal()).toBe(2.5);
      expect(orden.total.toDecimal()).toBe(3);
    });
  });

  describe("establecerEnvio (R8.4)", () => {
    it("rechaza establecer envío en canales distintos de DELIVERY", () => {
      const salon = crearOrden({ canal: OrderChannel.SALON });
      const retirar = crearOrden({ canal: OrderChannel.RETIRAR });
      expect(() => salon.establecerEnvio(Money.de(1))).toThrow(DomainError);
      expect(() => retirar.establecerEnvio(Money.de(1))).toThrow(DomainError);
    });

    it("rechaza un envío negativo en DELIVERY", () => {
      const orden = crearOrden({ canal: OrderChannel.DELIVERY });
      expect(() => orden.establecerEnvio(Money.de(-1))).toThrow(DomainError);
    });
  });

  describe("transicionarA (máquina de estados, R6/R7)", () => {
    it("recorre el camino feliz completo actualizando el estado (R6.1-R6.6)", () => {
      const orden = crearOrden();
      expect(orden.estado).toBe(OrderStatus.ABIERTA);

      orden.transicionarA(OrderStatus.ENVIADA_A_COCINA); // R6.1
      expect(orden.estado).toBe(OrderStatus.ENVIADA_A_COCINA);

      orden.transicionarA(OrderStatus.EN_PREPARACION); // R6.2
      expect(orden.estado).toBe(OrderStatus.EN_PREPARACION);

      orden.transicionarA(OrderStatus.LISTA); // R6.3
      expect(orden.estado).toBe(OrderStatus.LISTA);

      orden.transicionarA(OrderStatus.ENTREGADA); // R6.4
      expect(orden.estado).toBe(OrderStatus.ENTREGADA);

      orden.transicionarA(OrderStatus.COBRADA); // R6.5
      expect(orden.estado).toBe(OrderStatus.COBRADA);

      orden.transicionarA(OrderStatus.CERRADA); // R6.6
      expect(orden.estado).toBe(OrderStatus.CERRADA);
    });

    it("permite la auto-transición ENTREGADA→ENTREGADA (cuenta abierta)", () => {
      const orden = crearOrden({ estado: OrderStatus.ENTREGADA });
      orden.transicionarA(OrderStatus.ENTREGADA);
      expect(orden.estado).toBe(OrderStatus.ENTREGADA);
    });

    it("permite cancelar desde ABIERTA sin privilegios de admin (R6.8)", () => {
      const orden = crearOrden({ estado: OrderStatus.ABIERTA });
      orden.transicionarA(OrderStatus.CANCELADA);
      expect(orden.estado).toBe(OrderStatus.CANCELADA);
    });

    describe("cancelaciones que requieren admin (R7.1, R7.2)", () => {
      const origenesQueRequierenAdmin = [
        OrderStatus.ENVIADA_A_COCINA,
        OrderStatus.EN_PREPARACION,
        OrderStatus.COBRADA,
      ];

      for (const origen of origenesQueRequierenAdmin) {
        it(`rechaza cancelar desde ${origen} sin esAdmin y conserva el estado`, () => {
          const orden = crearOrden({ estado: origen });
          expect(() => orden.transicionarA(OrderStatus.CANCELADA)).toThrow(
            DomainError,
          );
          expect(() =>
            orden.transicionarA(OrderStatus.CANCELADA, { esAdmin: false }),
          ).toThrow(DomainError);
          expect(orden.estado).toBe(origen);
        });

        it(`permite cancelar desde ${origen} con { esAdmin: true }`, () => {
          const orden = crearOrden({ estado: origen });
          orden.transicionarA(OrderStatus.CANCELADA, { esAdmin: true });
          expect(orden.estado).toBe(OrderStatus.CANCELADA);
        });
      }
    });

    it("lanza DomainError en transiciones inválidas y conserva el estado (R6.7)", () => {
      const casos: Array<[OrderStatus, OrderStatus]> = [
        [OrderStatus.ABIERTA, OrderStatus.LISTA],
        [OrderStatus.ABIERTA, OrderStatus.ENTREGADA],
        [OrderStatus.ABIERTA, OrderStatus.COBRADA],
        [OrderStatus.LISTA, OrderStatus.COBRADA],
        [OrderStatus.EN_PREPARACION, OrderStatus.ENTREGADA],
      ];

      for (const [origen, destino] of casos) {
        const orden = crearOrden({ estado: origen });
        expect(() => orden.transicionarA(destino)).toThrow(DomainError);
        expect(orden.estado).toBe(origen);
      }
    });

    it("los estados terminales rechazan toda transición (CERRADA, CANCELADA)", () => {
      const destinos = [
        OrderStatus.ABIERTA,
        OrderStatus.ENVIADA_A_COCINA,
        OrderStatus.EN_PREPARACION,
        OrderStatus.LISTA,
        OrderStatus.ENTREGADA,
        OrderStatus.COBRADA,
        OrderStatus.CERRADA,
        OrderStatus.CANCELADA,
      ];

      for (const terminal of [OrderStatus.CERRADA, OrderStatus.CANCELADA]) {
        for (const destino of destinos) {
          const orden = crearOrden({ estado: terminal });
          expect(() =>
            orden.transicionarA(destino, { esAdmin: true }),
          ).toThrow(DomainError);
          expect(orden.estado).toBe(terminal);
        }
        expect(crearOrden({ estado: terminal }).esTerminal()).toBe(true);
      }
    });

    it("esTerminal() es falso para estados no terminales", () => {
      expect(crearOrden({ estado: OrderStatus.ABIERTA }).esTerminal()).toBe(
        false,
      );
      expect(crearOrden({ estado: OrderStatus.COBRADA }).esTerminal()).toBe(
        false,
      );
    });

    it("puedeTransicionarA refleja las reglas sin mutar la orden", () => {
      const abierta = crearOrden({ estado: OrderStatus.ABIERTA });
      expect(abierta.puedeTransicionarA(OrderStatus.ENVIADA_A_COCINA)).toBe(
        true,
      );
      expect(abierta.puedeTransicionarA(OrderStatus.CANCELADA)).toBe(true);
      expect(abierta.puedeTransicionarA(OrderStatus.LISTA)).toBe(false);
      expect(abierta.estado).toBe(OrderStatus.ABIERTA);

      const cobrada = crearOrden({ estado: OrderStatus.COBRADA });
      expect(cobrada.puedeTransicionarA(OrderStatus.CANCELADA)).toBe(false);
      expect(
        cobrada.puedeTransicionarA(OrderStatus.CANCELADA, { esAdmin: true }),
      ).toBe(true);
    });
  });
});

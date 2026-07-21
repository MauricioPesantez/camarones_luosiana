import type { Clock } from "@/application/ports/Clock";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { calcularCierre } from "@/domain/caja/cierre";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { AuditEntry } from "@/domain/audit/AuditEntry";
import { Money } from "@/domain/order/Money";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { err, ok, type Result } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";

import { defaultIdGen } from "./registrarMovimientoEfectivo";

/** Acción registrada en auditoría al cerrar la caja (R16.2). */
export const ACCION_CERRAR_CAJA = "CERRAR_CAJA";

/** Entrada del caso de uso `CerrarCaja`. */
export interface CerrarCajaInput {
  /** Usuario que solicita el cierre (debe ser admin, R13.6). */
  actor: User;
  /** Efectivo físico contado por el administrador (R13.2). */
  efectivoContado: Money;
}

/** Resultado del cierre: la sesión cerrada y el cuadre legible (R13.1–R13.3). */
export interface CerrarCajaResultado {
  /** Sesión ya marcada como `CERRADA` y firmada. */
  sesion: CajaSession;
  /** Efectivo esperado (Σ libro EFECTIVO, R13.1). */
  esperado: Money;
  /** Diferencia `contado − esperado` (R13.2). */
  diferencia: Money;
  /** Monto puente: Σ con signo de PAGO_CARRERA passthrough (R13.3). */
  puente: Money;
  /** Cantidad de órdenes `COBRADA` que el cierre transicionó a `CERRADA` (R6.6). */
  ordenesCerradas: number;
}

/**
 * Caso de uso `CerrarCaja` (R13, R16.1).
 *
 * Cuadra y firma la jornada: valida que el actor sea administrador (R13.6) y
 * que exista una sesión `ABIERTA`; reutiliza las funciones puras de `cierre.ts`
 * para calcular el efectivo esperado, la diferencia y el puente (R13.1–R13.3);
 * marca la sesión `CERRADA` con `efectivoContado`, `diferencia` y `firmadoPor`
 * (R13.4); asienta un `MovimientoCaja` de tipo `CIERRE`; y registra un
 * `AuditEntry` de la acción sensible (R16.1).
 *
 * Tras el cierre no queda ninguna sesión abierta, de modo que los casos de uso
 * de movimientos manuales (que exigen `sesionAbierta`) quedan bloqueados: no se
 * pueden editar ni agregar movimientos a una sesión cerrada (R13.5, Property 5).
 *
 * Operación **transaccional** (Property 7): el marcador `CIERRE`, el cierre y
 * firma de la sesión, el cierre de las órdenes `COBRADA` de la jornada (R6.6) y
 * el registro de auditoría (R16.1) se confirman juntos o se revierten juntos.
 * No queda una caja cerrada con órdenes cobradas sin cerrar, ni al revés.
 *
 * Devuelve un `Result`; no lanza para errores de negocio.
 */
export class CerrarCaja {
  constructor(
    private readonly tx: TransactionRunner,
    private readonly clock: Clock,
    private readonly idGen: () => string = defaultIdGen,
  ) {}

  async ejecutar(
    input: CerrarCajaInput,
  ): Promise<Result<CerrarCajaResultado>> {
    const { actor, efectivoContado } = input;

    // R13.6: solo el administrador puede cerrar la caja.
    if (!actor.esAdmin()) {
      return err(
        new DomainError(
          "Solo un administrador puede cerrar la caja",
          "CAJA_CERRAR_NO_AUTORIZADO",
        ),
      );
    }

    try {
      const resultado = await this.tx.run(async ({ caja, orders, audit }) => {
        // Exige una sesión abierta para cerrar.
        const sesion = await caja.sesionAbierta();
        if (!sesion) {
          throw new DomainError(
            "No hay una sesión de caja abierta",
            "CAJA_NO_ABIERTA",
          );
        }

        // R13.1–R13.3: cuadre derivado de los movimientos (funciones puras).
        const movimientos = await caja.movimientosDeSesion(sesion.id);
        const { esperado, diferencia, puente } = calcularCierre(
          movimientos,
          efectivoContado,
        );

        const ahora = this.clock.now();

        // Movimiento marcador de CIERRE (monto cero: no altera el cuadre). Se
        // asienta mientras la sesión sigue abierta, antes de cerrarla.
        const cierreMov = MovimientoCaja.crear({
          id: this.idGen(),
          sesionId: sesion.id,
          tipo: TipoMovimiento.CIERRE,
          libro: Libro.EFECTIVO,
          monto: Money.cero(),
          empleadoId: actor.id,
          nota: "Cierre de caja",
          timestamp: ahora,
        });
        await caja.agregarMovimiento(cierreMov);

        // R6.6: como parte del cierre del día, todas las órdenes `COBRADA`
        // pendientes pasan a `CERRADA`. Las órdenes en otros estados no se
        // tocan (`cobradas()` solo devuelve las cobradas). La máquina de
        // estados de `Order` hace cumplir que COBRADA → CERRADA es válida.
        const cobradas = await orders.cobradas();
        for (const orden of cobradas) {
          orden.transicionarA(OrderStatus.CERRADA);
          await orders.guardar(orden);
        }

        // R13.4: marca CERRADA, persiste contado/diferencia/firma. `cerrar`
        // lanza si la sesión ya estaba cerrada (no se puede recerrar).
        sesion.cerrar({
          efectivoContado,
          diferencia,
          firmadoPorId: actor.id,
          closedAt: ahora,
        });
        await caja.cerrarSesion(sesion);

        // R16.1: auditoría de la acción sensible (cierre de caja).
        const entrada = AuditEntry.crear({
          id: this.idGen(),
          usuarioId: actor.id,
          accion: ACCION_CERRAR_CAJA,
          entidadTipo: "CajaSession",
          entidadId: sesion.id,
          detalle: {
            esperado: esperado.toDecimal(),
            efectivoContado: efectivoContado.toDecimal(),
            diferencia: diferencia.toDecimal(),
            puente: puente.toDecimal(),
            ordenesCerradas: cobradas.length,
          },
          timestamp: ahora,
        });
        await audit.registrar(entrada);

        return {
          sesion,
          esperado,
          diferencia,
          puente,
          ordenesCerradas: cobradas.length,
        };
      });

      return ok(resultado);
    } catch (e) {
      if (e instanceof DomainError) {
        return err(e);
      }
      throw e;
    }
  }
}

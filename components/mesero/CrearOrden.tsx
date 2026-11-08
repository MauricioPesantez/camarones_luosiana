"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ItemSinStock } from "@/types/stock";
import { ROL_ABRE_CAJA } from "@/types/caja";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: string | number;
  stock: number;
  stockMinimo: number | null;
}

interface ItemCarrito {
  productoId: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  observaciones?: string;
  /** Combos: una salsa por unidad, siempre con largo `cantidad`. */
  nivelesPicante?: (NivelPicante | "")[];
}

import { useAuth } from "@/lib/auth";
import {
  MetodoPago,
  NIVELES_PICANTE,
  NivelPicante,
  RECARGO_RECIPIENTES,
  TipoOrden,
  calcularRecargoEnvases,
  esCategoriaCombo,
} from "@/types/orden";

export default function CrearOrden() {
  const { usuario, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cajaVerificada, setCajaVerificada] = useState(false);
  const [errorCaja, setErrorCaja] = useState("");
  const [intentoCaja, setIntentoCaja] = useState(0);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [tipoOrden, setTipoOrden] = useState<TipoOrden>(() =>
    usuario?.rol === "digital" ? "para_llevar" : "local",
  );
  const [numeroMesa, setNumeroMesa] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [ubicacionUrl, setUbicacionUrl] = useState("");
  const [referenciaEntrega, setReferenciaEntrega] = useState("");
  const [costoEnvio, setCostoEnvio] = useState("");
  // Solo domicilio: define si al motorizado se le cobra o se le entrega dinero.
  const [metodoPagoPrevisto, setMetodoPagoPrevisto] = useState<MetodoPago | "">(
    "",
  );
  const [transferenciaConfirmada, setTransferenciaConfirmada] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [loading, setLoading] = useState(false);
  // Se activa al tocar "Enviar" con datos faltantes; desde ahí se marca el campo.
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [itemsSinStock, setItemsSinStock] = useState<ItemSinStock[]>([]);
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  const [agregadoReciente, setAgregadoReciente] = useState<Set<string>>(
    new Set(),
  );
  const [carritoAlcanzado, setCarritoAlcanzado] = useState(false);
  const inicioRef = useRef<HTMLDivElement>(null);
  const carritoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading || usuario?.rol !== ROL_ABRE_CAJA) return;
    let vigente = true;
    const verificarCaja = async () => {
      try {
        const res = await fetch("/api/caja", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo verificar la caja");
        if (!vigente) return;
        if (data.caja?.estado !== "abierta") {
          router.replace("/mesero?vista=caja&requerida=1");
          return;
        }
        setCajaVerificada(true);
      } catch (err) {
        if (vigente) {
          setErrorCaja(err instanceof Error ? err.message : "No se pudo verificar la caja");
        }
      }
    };
    void verificarCaja();
    return () => { vigente = false; };
  }, [authLoading, usuario?.rol, usuario?.id, router, intentoCaja]);

  const cargarProductos = async () => {
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      // Convertir precios de string a number
      const productosConPrecio = data.map((p: Producto) => ({
        ...p,
        precio: typeof p.precio === "string" ? parseFloat(p.precio) : p.precio,
      }));
      setProductos(productosConPrecio);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    }
  };

  useEffect(() => {
    if (usuario) {
      // El setState ocurre dentro de la función async, no de forma síncrona
      // en el cuerpo del efecto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarProductos();
    }
  }, [usuario]);

  useEffect(() => {
    const actualizarDestinoScroll = () => {
      const carritoElement = carritoRef.current;
      if (!carritoElement) return;

      const limiteVisible = Math.max(120, window.innerHeight * 0.55);
      setCarritoAlcanzado(
        carritoElement.getBoundingClientRect().top <= limiteVisible,
      );
    };

    const frame = window.requestAnimationFrame(actualizarDestinoScroll);
    window.addEventListener("scroll", actualizarDestinoScroll, {
      passive: true,
    });
    window.addEventListener("resize", actualizarDestinoScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", actualizarDestinoScroll);
      window.removeEventListener("resize", actualizarDestinoScroll);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

  if (usuario.rol === ROL_ABRE_CAJA && !cajaVerificada) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        {errorCaja ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-white p-6">
            <p className="text-red-700">{errorCaja}</p>
            <button
              type="button"
              onClick={() => {
                setErrorCaja("");
                setIntentoCaja((intento) => intento + 1);
              }}
              className="mt-4 min-h-11 rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
            >
              Volver a verificar
            </button>
          </div>
        ) : (
          <p role="status" className="text-center text-gray-600">Verificando la caja de hoy...</p>
        )}
      </div>
    );
  }

  const categorias = [
    "Todas",
    ...Array.from(new Set(productos.map((p) => p.categoria))),
  ];

  const productosFiltrados =
    categoriaActiva === "Todas"
      ? productos
      : productos.filter((p) => p.categoria === categoriaActiva);

  const agregarAlCarrito = (producto: Producto) => {
    const itemExistente = carrito.find(
      (item) => item.productoId === producto.id,
    );

    if (itemExistente) {
      setCarrito(
        carrito.map((item) =>
          item.productoId === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                nivelesPicante: item.nivelesPicante && [...item.nivelesPicante, ""],
              }
            : item,
        ),
      );
    } else {
      setCarrito([
        ...carrito,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: 1,
          precioUnitario:
            typeof producto.precio === "string"
              ? parseFloat(producto.precio)
              : producto.precio,
          nivelesPicante: esCategoriaCombo(producto.categoria) ? [""] : undefined,
        },
      ]);
    }

    // Feedback visual: marcar como agregado
    setAgregadoReciente((prev) => new Set(prev).add(producto.id));
    setTimeout(() => {
      setAgregadoReciente((prev) => {
        const next = new Set(prev);
        next.delete(producto.id);
        return next;
      });
    }, 800);

    // Vibración en móvil
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(60);
    }
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad === 0) {
      setCarrito(carrito.filter((item) => item.productoId !== productoId));
    } else {
      setCarrito(
        carrito.map((item) =>
          item.productoId === productoId
            ? {
                ...item,
                cantidad,
                nivelesPicante:
                  item.nivelesPicante &&
                  Array.from(
                    { length: cantidad },
                    (_, i) => item.nivelesPicante![i] ?? "",
                  ),
              }
            : item,
        ),
      );
    }
  };

  const calcularSubtotalProductos = () => {
    return carrito.reduce(
      (total, item) => total + item.cantidad * item.precioUnitario,
      0,
    );
  };

  const calcularRecargo = () =>
    calcularRecargoEnvases(tipoOrden, carrito);

  const cantidadEnvases = carrito.reduce(
    (total, item) =>
      esCategoriaCombo(item.categoria) ? total + item.cantidad : total,
    0,
  );

  const actualizarNivelPicante = (
    productoId: string,
    unidad: number,
    nivelPicante: NivelPicante | "",
  ) => {
    setCarrito((actual) =>
      actual.map((item) =>
        item.productoId === productoId && item.nivelesPicante
          ? {
              ...item,
              nivelesPicante: item.nivelesPicante.map((nivel, i) =>
                i === unidad ? nivelPicante : nivel,
              ),
            }
          : item,
      ),
    );
  };

  // El backend acepta varias líneas del mismo producto: una por salsa.
  const itemsParaEnviar = () =>
    carrito.flatMap(({ nivelesPicante, ...item }) => {
      if (!nivelesPicante) return [item];
      const porNivel = new Map<string, number>();
      for (const nivel of nivelesPicante)
        porNivel.set(nivel, (porNivel.get(nivel) ?? 0) + 1);
      return [...porNivel].map(([nivelPicante, cantidad]) => ({
        ...item,
        cantidad,
        nivelPicante,
      }));
    });

  const calcularCostoEnvio = () =>
    tipoOrden === "domicilio" ? parseFloat(costoEnvio) || 0 : 0;

  const calcularTotal = () =>
    calcularSubtotalProductos() + calcularRecargo() + calcularCostoEnvio();

  const validarStock = async () => {
    try {
      const res = await fetch("/api/stock/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        }),
      });

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error al validar stock:", error);
      return {
        hayStock: false,
        itemsSinStock: [],
        mensaje: "Error al validar stock",
      };
    }
  };

  // `campo` es el id del elemento a enfocar cuando falta ese dato.
  const validarCampos = (): { campo: string; mensaje: string } | null => {
    const falta = (campo: string, mensaje: string) => ({ campo, mensaje });
    if (carrito.length === 0)
      return falta("panel-productos", "Agrega al menos un producto al carrito");
    for (const item of carrito) {
      const unidad = item.nivelesPicante?.indexOf("") ?? -1;
      if (unidad >= 0)
        return falta(
          `picante-${item.productoId}-${unidad}`,
          `Selecciona el nivel de picante para ${item.nombre}${item.cantidad > 1 ? ` #${unidad + 1}` : ""}`,
        );
    }
    if (tipoOrden === "local" && !numeroMesa)
      return falta("numero-mesa", "Ingresa el número de mesa");
    if (tipoOrden === "para_llevar" && !nombreCliente.trim())
      return falta("nombre-cliente", "Ingresa el nombre del cliente");
    if (tipoOrden === "domicilio" && !telefonoCliente.trim())
      return falta("telefono-cliente", "Ingresa el teléfono del cliente");
    if (
      tipoOrden === "domicilio" &&
      (!costoEnvio || parseFloat(costoEnvio) < 0)
    )
      return falta("costo-envio", "Ingresa el costo de envío");
    if (tipoOrden === "domicilio" && !metodoPagoPrevisto)
      return falta("metodo-pago", "Selecciona la modalidad de pago");
    if (
      tipoOrden === "domicilio" &&
      metodoPagoPrevisto === "transferencia" &&
      !transferenciaConfirmada
    )
      return falta(
        "transferencia-confirmada",
        "Confirma que la transferencia ya fue recibida",
      );
    return null;
  };

  const enviarOrden = async (solicitarAprobacion = false) => {
    const errorValidacion = validarCampos();
    if (errorValidacion) {
      setMostrarErrores(true);
      const campo = document.getElementById(errorValidacion.campo);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus({ preventScroll: true });
      return;
    }

    setLoading(true);

    try {
      // Validar stock primero
      const validacion = await validarStock();

      if (!validacion.hayStock && !solicitarAprobacion) {
        // Hay items sin stock, mostrar modal
        setItemsSinStock(validacion.itemsSinStock);
        setMostrarModalStock(true);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoOrden,
          numeroMesa: tipoOrden === "local" ? parseInt(numeroMesa) : undefined,
          nombreCliente:
            tipoOrden !== "local"
              ? nombreCliente.trim() || undefined
              : undefined,
          telefonoCliente:
            tipoOrden === "domicilio" ? telefonoCliente.trim() : undefined,
          ubicacionUrl: tipoOrden === "domicilio" ? ubicacionUrl : undefined,
          referenciaEntrega:
            tipoOrden === "domicilio" ? referenciaEntrega : undefined,
          costoEnvio:
            tipoOrden === "domicilio" ? parseFloat(costoEnvio) : undefined,
          metodoPagoPrevisto:
            tipoOrden === "domicilio" ? metodoPagoPrevisto : undefined,
          transferenciaConfirmada:
            tipoOrden === "domicilio" &&
            metodoPagoPrevisto === "transferencia"
              ? transferenciaConfirmada
              : false,
          mesero: usuario?.nombre || "Desconocido",
          creadorId: usuario?.id,
          observaciones,
          items: itemsParaEnviar(),
          solicitarAprobacion: solicitarAprobacion,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (solicitarAprobacion && data.pendienteAprobacion) {
          alert(
            "Orden creada y enviada para aprobación del administrador.\nSerá procesada una vez aprobada.",
          );
        } else if (data.impresion.success) {
          alert("¡Orden enviada e impresa exitosamente!");
        } else {
          alert("Orden guardada pero falló la impresión");
        }
        // Limpiar formulario
        setCarrito([]);
        setNumeroMesa("");
        setNombreCliente("");
        setTelefonoCliente("");
        setUbicacionUrl("");
        setReferenciaEntrega("");
        setCostoEnvio("");
        setMetodoPagoPrevisto("");
        setTransferenciaConfirmada(false);
        setObservaciones("");
        setMostrarModalStock(false);
        setItemsSinStock([]);
        setMostrarErrores(false);
        // Recargar productos para actualizar stock
        await cargarProductos();
      } else {
        if (data.code === "CAJA_NO_DISPONIBLE" && usuario.rol === ROL_ABRE_CAJA) {
          router.replace("/mesero?vista=caja&requerida=1");
          return;
        }
        alert(data.error || "Error al enviar orden");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al enviar orden");
    } finally {
      setLoading(false);
    }
  };

  const getStockColor = (producto: Producto) => {
    if (producto.stock === 0) return "text-red-600";
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo)
      return "text-yellow-600";
    return "text-green-600";
  };

  const getStockBadge = (producto: Producto) => {
    if (producto.stock === 0)
      return (
        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
          Sin Stock
        </span>
      );
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo)
      return (
        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
          Stock Bajo
        </span>
      );
    return null;
  };

  const pendiente = validarCampos();
  const errorActual = mostrarErrores ? pendiente : null;
  const claseError = (campo: string) =>
    errorActual?.campo === campo ? " border-red-500 ring-2 ring-red-200" : "";
  const mensajeError = (campo: string) =>
    errorActual?.campo === campo ? (
      <p role="alert" className="mt-1 text-sm font-semibold text-red-600">
        {errorActual.mensaje}
      </p>
    ) : null;

  return (
    <div ref={inicioRef} className="min-h-screen bg-gray-100 p-4 pb-32 lg:pb-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de productos */}
          <div
            id="panel-productos"
            tabIndex={-1}
            className="lg:col-span-2 bg-white rounded-lg shadow p-6 scroll-mt-4 focus:outline-none"
          >
            {mensajeError("panel-productos")}
            {/* Selector de tipo de orden: solo visible para el agente digital */}
            {usuario?.rol === "digital" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Tipo de Pedido
                </label>
                <div className="flex gap-2">
                  {(["para_llevar", "domicilio"] as TipoOrden[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        setTipoOrden(tipo);
                        setNombreCliente("");
                        setTelefonoCliente("");
        setUbicacionUrl("");
        setReferenciaEntrega("");
                        setCostoEnvio("");
                        setMetodoPagoPrevisto("");
                        setTransferenciaConfirmada(false);
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                        tipoOrden === tipo
                          ? tipo === "para_llevar"
                            ? "bg-yellow-500 text-white"
                            : "bg-red-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {tipo === "para_llevar"
                        ? "🥡 Para Llevar"
                        : "🛵 Domicilio"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campos según tipo */}
            {tipoOrden === "local" && (
              <div className="mb-4">
                <label htmlFor="numero-mesa" className="block text-sm font-medium mb-2 text-gray-800">
                  Número de Mesa
                </label>
                <input
                  id="numero-mesa"
                  type="number"
                  inputMode="numeric"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  aria-invalid={errorActual?.campo === "numero-mesa"}
                  className={`w-full border rounded-lg px-4 py-2 text-black${claseError("numero-mesa")}`}
                  placeholder="Ej: 5"
                />
                {mensajeError("numero-mesa")}
              </div>
            )}

            {(tipoOrden === "para_llevar" || tipoOrden === "domicilio") && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Nombre del Cliente
                  {tipoOrden === "domicilio" ? " (opcional)" : " *"}
                </label>
                <input
                  id="nombre-cliente"
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  required={tipoOrden === "para_llevar"}
                  aria-invalid={errorActual?.campo === "nombre-cliente"}
                  className={`w-full border rounded-lg px-4 py-2 text-black${claseError("nombre-cliente")}`}
                  placeholder="Ej: Juan Pérez"
                />
                {mensajeError("nombre-cliente")}
              </div>
            )}

            {tipoOrden === "domicilio" && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-800">
                    Teléfono *
                  </label>
                  <input
                    id="telefono-cliente"
                    type="tel"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    required
                    aria-invalid={errorActual?.campo === "telefono-cliente"}
                    className={`w-full border rounded-lg px-4 py-2 text-black${claseError("telefono-cliente")}`}
                    placeholder="Ej: 0991234567"
                  />
                  {mensajeError("telefono-cliente")}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-800">
                    Costo de Envío ($)
                  </label>
                  <input
                    id="costo-envio"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={costoEnvio}
                    onChange={(e) => setCostoEnvio(e.target.value)}
                    aria-invalid={errorActual?.campo === "costo-envio"}
                    className={`w-full border rounded-lg px-4 py-2 text-black${claseError("costo-envio")}`}
                    placeholder="Ej: 1.50"
                  />
                  {mensajeError("costo-envio")}
                </div>
                <div>
                  <label htmlFor="ubicacion-url" className="block text-sm font-medium mb-2 text-gray-800">
                    Enlace de Google Maps
                  </label>
                  <input
                    id="ubicacion-url"
                    type="url"
                    value={ubicacionUrl}
                    onChange={(e) => setUbicacionUrl(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 text-black"
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>
                <div>
                  <label htmlFor="referencia-entrega" className="block text-sm font-medium mb-2 text-gray-800">
                    Referencia de entrega
                  </label>
                  <input
                    id="referencia-entrega"
                    type="text"
                    value={referenciaEntrega}
                    onChange={(e) => setReferenciaEntrega(e.target.value)}
                    maxLength={500}
                    className="w-full border rounded-lg px-4 py-2 text-black"
                    placeholder="Ej: casa azul, junto a la farmacia"
                  />
                </div>
              </div>
            )}

            {/* Modalidad de pago: solo domicilio. Define si al motorizado se le
                cobra el pedido (efectivo) o se le entrega el envío (transferencia). */}
            {tipoOrden === "domicilio" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Modalidad de Pago <span className="text-red-600">*</span>
                </label>
                <div
                  id="metodo-pago"
                  tabIndex={-1}
                  className={`flex gap-2 rounded-lg focus:outline-none${claseError("metodo-pago")}`}
                >
                  {(["efectivo", "transferencia"] as MetodoPago[]).map(
                    (metodo) => (
                      <button
                        key={metodo}
                        type="button"
                        onClick={() => {
                          setMetodoPagoPrevisto(metodo);
                          if (metodo !== "transferencia") {
                            setTransferenciaConfirmada(false);
                          }
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                          metodoPagoPrevisto === metodo
                            ? metodo === "efectivo"
                              ? "bg-green-600 text-white"
                              : "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {metodo === "efectivo"
                          ? "💵 Efectivo"
                          : "🏦 Transferencia"}
                      </button>
                    ),
                  )}
                </div>
                {mensajeError("metodo-pago")}
                {metodoPagoPrevisto === "efectivo" && (
                  <p className="text-xs text-gray-600 mt-2">
                    El motorizado cobra ${calcularTotal().toFixed(2)} al cliente
                    y paga ${(calcularTotal() - calcularCostoEnvio()).toFixed(2)}{" "}
                    en el local.
                  </p>
                )}
                {metodoPagoPrevisto === "transferencia" && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-600">
                      El cliente transfiere ${calcularTotal().toFixed(2)} y el
                      local le entrega ${calcularCostoEnvio().toFixed(2)} al
                      motorizado.
                    </p>
                    <label className={`flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900${claseError("transferencia-confirmada")}`}>
                      <input
                        id="transferencia-confirmada"
                        type="checkbox"
                        checked={transferenciaConfirmada}
                        onChange={(event) =>
                          setTransferenciaConfirmada(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4"
                      />
                      Confirmo que la transferencia ya fue recibida por el local
                    </label>
                    {mensajeError("transferencia-confirmada")}
                  </div>
                )}
              </div>
            )}

            {/* Filtros de categoría */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaActiva(cat)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                    categoriaActiva === cat
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de productos */}
            {categoriaActiva === "Todas" ? (
              // Vista agrupada por categoría
              <div className="space-y-6">
                {Array.from(new Set(productos.map((p) => p.categoria))).map(
                  (categoria) => {
                    const grupoProductos = productos.filter(
                      (p) => p.categoria === categoria,
                    );
                    const esCombos = categoria === "Combos";
                    return (
                      <div key={categoria}>
                        <div
                          className={`flex items-center gap-3 mb-3 pb-2 border-b-2 ${esCombos ? "border-blue-500" : "border-orange-400"}`}
                        >
                          <span
                            className={`text-lg font-bold ${esCombos ? "text-blue-700" : "text-orange-600"}`}
                          >
                            {esCombos ? "🦐" : "➕"} {categoria}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${esCombos ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
                          >
                            {grupoProductos.length} items
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {grupoProductos.map((producto) => {
                            const fueAgregado = agregadoReciente.has(
                              producto.id,
                            );
                            return (
                              <button
                                key={producto.id}
                                onClick={() => agregarAlCarrito(producto)}
                                className={`text-white p-4 rounded-lg transition-all duration-200 shadow-lg relative ${
                                  fueAgregado
                                    ? "bg-linear-to-br from-green-500 to-green-600 scale-95"
                                    : esCombos
                                      ? "bg-linear-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                                      : "bg-linear-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600"
                                }`}
                              >
                                {fueAgregado && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-500">
                                    <span className="text-3xl font-bold">
                                      ✓
                                    </span>
                                  </div>
                                )}
                                <div className="font-semibold text-sm mb-2">
                                  {producto.nombre}
                                </div>
                                <div className="text-lg font-bold mb-1">
                                  ${Number(producto.precio).toFixed(2)}
                                </div>
                                <div
                                  className={`text-xs font-semibold ${getStockColor(producto)}`}
                                >
                                  Stock: {producto.stock}
                                </div>
                                {getStockBadge(producto) && (
                                  <div className="absolute top-2 right-2">
                                    {getStockBadge(producto)}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              // Vista filtrada por categoría (lista plana)
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {productosFiltrados.map((producto) => {
                  const fueAgregado = agregadoReciente.has(producto.id);
                  return (
                    <button
                      key={producto.id}
                      onClick={() => agregarAlCarrito(producto)}
                      className={`text-white p-4 rounded-lg transition-all duration-200 shadow-lg relative ${
                        fueAgregado
                          ? "bg-linear-to-br from-green-500 to-green-600 scale-95"
                          : producto.categoria === "Combos"
                            ? "bg-linear-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                            : "bg-linear-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600"
                      }`}
                    >
                      {fueAgregado && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-500">
                          <span className="text-3xl font-bold">✓</span>
                        </div>
                      )}
                      <div className="font-semibold text-sm mb-2">
                        {producto.nombre}
                      </div>
                      <div className="text-lg font-bold mb-1">
                        ${Number(producto.precio).toFixed(2)}
                      </div>
                      <div
                        className={`text-xs font-semibold ${getStockColor(producto)}`}
                      >
                        Stock: {producto.stock}
                      </div>
                      {getStockBadge(producto) && (
                        <div className="absolute top-2 right-2">
                          {getStockBadge(producto)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Carrito */}
          <div
            ref={carritoRef}
            className="scroll-mb-32 bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-xl font-bold mb-4 text-gray-800">Carrito</h2>

            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {carrito.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay items en el carrito
                </p>
              ) : (
                carrito.map((item) => (
                  <div key={item.productoId} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2 text-black">
                      <span className="font-medium text-sm">{item.nombre}</span>
                      <span className="font-bold">
                        ${(item.cantidad * item.precioUnitario).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          actualizarCantidad(item.productoId, item.cantidad - 1)
                        }
                        className="bg-red-500 text-white w-8 h-8 rounded"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-black">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() =>
                          actualizarCantidad(item.productoId, item.cantidad + 1)
                        }
                        className="bg-green-500 text-white w-8 h-8 rounded"
                      >
                        +
                      </button>
                    </div>
                    {item.nivelesPicante?.map((nivel, unidad) => {
                      const id = `picante-${item.productoId}-${unidad}`;
                      return (
                        <div key={unidad} className="mt-3">
                          <label
                            htmlFor={id}
                            className="block text-xs font-semibold mb-1 text-gray-700"
                          >
                            Nivel de picante
                            {item.cantidad > 1 ? ` · combo ${unidad + 1}` : ""}{" "}
                            <span className="text-red-600">*</span>
                          </label>
                          <select
                            id={id}
                            value={nivel}
                            onChange={(event) =>
                              actualizarNivelPicante(
                                item.productoId,
                                unidad,
                                event.target.value as NivelPicante | "",
                              )
                            }
                            aria-invalid={errorActual?.campo === id}
                            className={`w-full border rounded-lg px-3 py-2 text-black bg-white${claseError(id)}`}
                            required
                          >
                            <option value="" disabled>
                              Selecciona una opción
                            </option>
                            {NIVELES_PICANTE.map((opcion) => (
                              <option key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </option>
                            ))}
                          </select>
                          {mensajeError(id)}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-800">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-gray-600"
                rows={3}
                placeholder="Ej: Cliente tiene prisa"
              />
            </div>

            <div className="border-t pt-4 mb-4 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal productos:</span>
                <span>${calcularSubtotalProductos().toFixed(2)}</span>
              </div>
              {tipoOrden !== "local" && cantidadEnvases > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>
                    Envases de combos ({cantidadEnvases} × $
                    {RECARGO_RECIPIENTES.toFixed(2)}):
                  </span>
                  <span>${calcularRecargo().toFixed(2)}</span>
                </div>
              )}
              {tipoOrden === "domicilio" && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Costo de envío:</span>
                  <span>${calcularCostoEnvio().toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xl font-bold text-blue-500 pt-1 border-t">
                <span>Total:</span>
                <span>${calcularTotal().toFixed(2)}</span>
              </div>
            </div>

            {pendiente && (
              <p
                className={`mb-2 text-center text-sm ${
                  mostrarErrores ? "font-semibold text-red-600" : "text-gray-500"
                }`}
              >
                Falta: {pendiente.mensaje}
              </p>
            )}
            <button
              onClick={() => enviarOrden(false)}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar a Cocina"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            // Al bajar se alinea el final del carrito para que "Enviar a Cocina"
            // quede visible y por encima de este botón flotante.
            if (carritoAlcanzado) {
              inicioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              carritoRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }
          }}
          className="lg:hidden fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-full bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 md:bottom-5"
          aria-label={
            carritoAlcanzado
              ? "Volver al inicio de la creación de la orden"
              : "Ir al carrito de la orden"
          }
        >
          {carritoAlcanzado ? "↑ Volver al inicio" : "↓ Ir al carrito"}
        </button>

        {/* Modal de Stock Insuficiente */}
        {mostrarModalStock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 text-red-600">
                ⚠️ Stock Insuficiente
              </h3>
              <p className="text-gray-700 mb-4">
                Los siguientes productos no tienen suficiente stock:
              </p>
              <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                {itemsSinStock.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-red-50 border border-red-200 rounded p-3"
                  >
                    <p className="font-semibold text-gray-800">
                      {item.productoNombre}
                    </p>
                    <div className="text-sm text-gray-600 flex justify-between">
                      <span>Solicitado: {item.cantidadSolicitada}</span>
                      <span className="text-red-600 font-semibold">
                        Disponible: {item.stockDisponible}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Puedes solicitar la aprobación del administrador para crear la
                orden de todas formas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => enviarOrden(true)}
                  disabled={loading}
                  className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-semibold disabled:bg-gray-300"
                >
                  Solicitar Aprobación
                </button>
                <button
                  onClick={() => {
                    setMostrarModalStock(false);
                    setItemsSinStock([]);
                    setLoading(false);
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

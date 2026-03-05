"use client";

import { useState, useEffect } from "react";
import { ItemSinStock } from "@/types/stock";

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
  cantidad: number;
  precioUnitario: number;
  observaciones?: string;
}

import { useAuth } from "@/lib/auth";
import { TipoOrden } from "@/types/orden";

const RECARGO_FIJO = 0.5;

export default function CrearOrden() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [tipoOrden, setTipoOrden] = useState<TipoOrden>("local");
  const [numeroMesa, setNumeroMesa] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [costoEnvio, setCostoEnvio] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [loading, setLoading] = useState(false);
  const [itemsSinStock, setItemsSinStock] = useState<ItemSinStock[]>([]);
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  const [agregadoReciente, setAgregadoReciente] = useState<Set<string>>(
    new Set(),
  );

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
      cargarProductos();
    }
  }, [usuario]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario) return null;

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
            ? { ...item, cantidad: item.cantidad + 1 }
            : item,
        ),
      );
    } else {
      setCarrito([
        ...carrito,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precioUnitario:
            typeof producto.precio === "string"
              ? parseFloat(producto.precio)
              : producto.precio,
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
          item.productoId === productoId ? { ...item, cantidad } : item,
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

  const calcularRecargo = () => (tipoOrden !== "local" ? RECARGO_FIJO : 0);

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

  const validarCampos = (): string | null => {
    if (carrito.length === 0) return "Agrega al menos un producto al carrito";
    if (tipoOrden === "local" && !numeroMesa)
      return "Ingresa el número de mesa";
    if (
      (tipoOrden === "para_llevar" || tipoOrden === "domicilio") &&
      !nombreCliente.trim()
    )
      return "Ingresa el nombre del cliente";
    if (tipoOrden === "domicilio" && !telefonoCliente.trim())
      return "Ingresa el teléfono del cliente";
    if (
      tipoOrden === "domicilio" &&
      (!costoEnvio || parseFloat(costoEnvio) < 0)
    )
      return "Ingresa el costo de envío";
    return null;
  };

  const enviarOrden = async (solicitarAprobacion = false) => {
    const errorValidacion = validarCampos();
    if (errorValidacion) {
      alert(errorValidacion);
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
            tipoOrden !== "local" ? nombreCliente.trim() : undefined,
          telefonoCliente:
            tipoOrden === "domicilio" ? telefonoCliente.trim() : undefined,
          costoEnvio:
            tipoOrden === "domicilio" ? parseFloat(costoEnvio) : undefined,
          mesero: usuario?.nombre || "Desconocido",
          observaciones,
          items: carrito,
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
        setCostoEnvio("");
        setObservaciones("");
        setMostrarModalStock(false);
        setItemsSinStock([]);
        // Recargar productos para actualizar stock
        await cargarProductos();
      } else {
        alert("Error al enviar orden");
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Solo mostrar header si no es cocinero (el cocinero tiene el selector arriba) */}
        {usuario?.rol !== "cocina" && (
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-black">Nueva Orden</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Usuario: <span className="font-bold">{usuario?.nombre}</span>
              </span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}

        {usuario?.rol === "cocina" && (
          <h1 className="text-3xl font-bold text-black mb-6">Nueva Orden</h1>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de productos */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            {/* Selector de tipo de orden */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-800">
                Tipo de Orden
              </label>
              <div className="flex gap-2">
                {(["local", "para_llevar", "domicilio"] as TipoOrden[]).map(
                  (tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => {
                        setTipoOrden(tipo);
                        setNumeroMesa("");
                        setNombreCliente("");
                        setTelefonoCliente("");
                        setCostoEnvio("");
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                        tipoOrden === tipo
                          ? tipo === "local"
                            ? "bg-blue-600 text-white"
                            : tipo === "para_llevar"
                              ? "bg-yellow-500 text-white"
                              : "bg-red-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {tipo === "local"
                        ? "🍽 Local"
                        : tipo === "para_llevar"
                          ? "🥡 Para Llevar"
                          : "🛵 Domicilio"}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Campos según tipo */}
            {tipoOrden === "local" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Número de Mesa
                </label>
                <input
                  type="number"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 text-black"
                  placeholder="Ej: 5"
                />
              </div>
            )}

            {(tipoOrden === "para_llevar" || tipoOrden === "domicilio") && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 text-black"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
            )}

            {tipoOrden === "domicilio" && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-800">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 text-black"
                    placeholder="Ej: 0991234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-800">
                    Costo de Envío ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoEnvio}
                    onChange={(e) => setCostoEnvio(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2 text-black"
                    placeholder="Ej: 1.50"
                  />
                </div>
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
          <div className="bg-white rounded-lg shadow p-6">
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
              {tipoOrden !== "local" && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Recargo:</span>
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

            <button
              onClick={() => enviarOrden(false)}
              disabled={loading || !!validarCampos()}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar a Cocina"}
            </button>
          </div>
        </div>

        {/* Modal de Stock Insuficiente */}
        {mostrarModalStock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

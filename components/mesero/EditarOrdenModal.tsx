"use client";

import { useState, useEffect } from "react";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  disponible: boolean;
}

interface Item {
  id: string;
  cantidad: number;
  producto: Producto;
  precioUnitario: number;
  subtotal: number;
}

interface Orden {
  id: string;
  tipoOrden: string;
  estado: string;
  numeroMesa: number | null;
  nombreCliente: string | null;
  recargo: number | null;
  costoEnvio: number | null;
  total: number;
  items: Item[];
}

interface EditarOrdenModalProps {
  orden: Orden;
  onClose: () => void;
  onSuccess: () => void;
  usuario: { nombre: string; rol: string };
}

export default function EditarOrdenModal({
  orden,
  onClose,
  onSuccess,
  usuario,
}: EditarOrdenModalProps) {
  const [items, setItems] = useState<Item[]>(orden.items);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [razon, setRazon] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");

  // Mapa inmutable de cantidades originales al abrir el modal
  const cantidadesOriginales = new Map(
    orden.items.map((i) => [i.id, i.cantidad]),
  );

  useEffect(() => {
    // Cargar solo productos disponibles y con stock
    fetch("/api/productos")
      .then((res) => res.json())
      .then((data) =>
        setProductos(data.filter((p: Producto) => p.disponible && p.stock > 0)),
      )
      .catch((error) => console.error("Error al cargar productos:", error));
  }, []);

  const esOrdenLista = orden.estado === "lista";
  const esOrdenEnPreparacion = orden.estado === "en_preparacion";

  // Un item es "original" si ya existía cuando se abrió el modal (no es temp-)
  const esItemOriginal = (item: Item) => !item.id.startsWith("temp-");

  const modificarCantidad = (itemId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (esItemOriginal(item) && esOrdenLista) {
      // En orden lista: solo permitir subir, nunca bajar de la cantidad original
      const minCantidad = cantidadesOriginales.get(itemId) ?? 1;
      const nuevaCantidad = item.cantidad + delta;
      if (nuevaCantidad < minCantidad) return; // bloquear
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                cantidad: nuevaCantidad,
                subtotal: nuevaCantidad * i.precioUnitario,
              }
            : i,
        ),
      );
      return;
    }

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          const nuevaCantidad = Math.max(1, i.cantidad + delta);
          return {
            ...i,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * i.precioUnitario,
          };
        }
        return i;
      }),
    );
  };

  const eliminarItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    // Bloquear eliminación de items originales si la orden ya está lista
    if (item && esItemOriginal(item) && esOrdenLista) {
      alert("⛔ No puedes eliminar un item que ya fue preparado por cocina.");
      return;
    }

    // Advertencia si la orden está en preparación
    if (item && esItemOriginal(item) && esOrdenEnPreparacion) {
      const confirmar = window.confirm(
        `⚠️ "${item.producto.nombre}" puede estar siendo preparado en este momento.\n¿Estás seguro de que quieres eliminarlo?`,
      );
      if (!confirmar) return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const agregarProducto = () => {
    if (!productoSeleccionado) return;

    const producto = productos.find((p) => p.id === productoSeleccionado);
    if (!producto) return;

    // Verificar si el producto ya existe en la orden
    const itemExistente = items.find((i) => i.producto.id === producto.id);
    if (itemExistente) {
      // Incrementar cantidad si ya existe
      modificarCantidad(itemExistente.id, 1);
    } else {
      // Agregar nuevo item
      const nuevoItem: Item = {
        id: `temp-${Date.now()}`,
        cantidad: 1,
        producto,
        precioUnitario: producto.precio,
        subtotal: producto.precio,
      };
      setItems((prev) => [...prev, nuevoItem]);
    }

    setProductoSeleccionado("");
    setMostrarAgregar(false);
  };

  const calcularTotal = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    const recargo = Number(orden.recargo ?? 0);
    const envio = Number(orden.costoEnvio ?? 0);
    return subtotal + recargo + envio;
  };

  const calcularSubtotalProductos = () => {
    return items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  };

  interface CambioItem {
    accion: "eliminar" | "agregar" | "modificar";
    itemId?: string;
    productoId?: string;
    cantidad?: number;
  }

  const obtenerCambios = () => {
    const cambios: CambioItem[] = [];

    // Detectar items eliminados — solo permitir si NO son originales en orden lista
    orden.items.forEach((itemOriginal) => {
      const existe = items.find((i) => i.id === itemOriginal.id);
      if (!existe) {
        if (esOrdenLista) return; // items originales no se pueden eliminar en orden lista
        cambios.push({ accion: "eliminar", itemId: itemOriginal.id });
      }
    });

    // Detectar items modificados
    items.forEach((item) => {
      const itemOriginal = orden.items.find((i) => i.id === item.id);
      if (itemOriginal && itemOriginal.cantidad !== item.cantidad) {
        // En orden lista solo se permiten aumentos (nunca decrementos)
        if (esOrdenLista && item.cantidad < itemOriginal.cantidad) return;
        cambios.push({
          accion: "modificar",
          itemId: item.id,
          cantidad: item.cantidad,
        });
      }
    });

    // Detectar items agregados (tienen id temporal) — siempre permitido
    items.forEach((item) => {
      if (item.id.startsWith("temp-")) {
        cambios.push({
          accion: "agregar",
          productoId: item.producto.id,
          cantidad: item.cantidad,
        });
      }
    });

    return cambios;
  };

  const guardarCambios = async () => {
    if (!razon.trim()) {
      alert("La razón del cambio es obligatoria");
      return;
    }

    const cambios = obtenerCambios();
    if (cambios.length === 0) {
      alert("No hay cambios para guardar");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/ordenes/${orden.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cambios,
          razon,
          usuario,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al modificar orden");
      }

      if (data.regresaACocina) {
        alert(
          "✅ Items agregados. La orden volvió a cocina para preparar los nuevos productos.",
        );
      } else {
        alert("✅ Cambios guardados correctamente.");
      }

      onSuccess();
      onClose();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Error al modificar orden",
      );
    } finally {
      setLoading(false);
    }
  };

  const totalAnterior = orden.total;
  const totalNuevo = calcularTotal();
  const diferencia = totalNuevo - totalAnterior;
  const hayCambios = obtenerCambios().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Editar Orden</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {orden.tipoOrden === "local" &&
                `🍽 Local · Mesa ${orden.numeroMesa}`}
              {orden.tipoOrden === "para_llevar" &&
                `🥡 Para Llevar · ${orden.nombreCliente ?? ""}`}
              {orden.tipoOrden === "domicilio" &&
                `🛵 Domicilio · ${orden.nombreCliente ?? ""}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Banner aviso orden lista */}
        {orden.estado === "lista" && (
          <div className="mx-6 mt-4 bg-orange-50 border-l-4 border-orange-400 rounded-lg p-3">
            <p className="text-sm text-orange-800 font-semibold">
              ⚠️ Esta orden ya está lista
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Si agregas nuevos productos, la orden regresará a cocina para su
              preparación. Los items ya listos no se modificarán.
            </p>
          </div>
        )}

        {/* Items */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-700 mb-3">
            Items de la Orden:
          </h3>
          <div className="space-y-2 mb-4">
            {items.map((item) => {
              const esOriginal = esItemOriginal(item) && esOrdenLista;
              const cantidadOriginal = cantidadesOriginales.get(item.id) ?? 1;
              const bloqueadoMenos =
                esOriginal && item.cantidad <= cantidadOriginal;
              const bloqueadoEliminar = esOriginal;
              const advertencia = esItemOriginal(item) && esOrdenEnPreparacion;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    esOriginal
                      ? "bg-orange-50 border border-orange-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">
                        {item.producto.nombre}
                      </p>
                      {esOriginal && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                          ✓ Listo
                        </span>
                      )}
                      {advertencia && !esOriginal && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                          🍳 En preparación
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      ${Number(item.precioUnitario).toFixed(2)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => modificarCantidad(item.id, -1)}
                      disabled={bloqueadoMenos}
                      className={`w-8 h-8 rounded-lg font-bold ${
                        bloqueadoMenos
                          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                          : "bg-gray-200 hover:bg-gray-300"
                      }`}
                    >
                      -
                    </button>
                    <span className="font-bold text-lg w-8 text-center">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => modificarCantidad(item.id, 1)}
                      className="w-8 h-8 rounded-lg font-bold bg-gray-200 hover:bg-gray-300"
                    >
                      +
                    </button>
                    <button
                      onClick={() => eliminarItem(item.id)}
                      disabled={bloqueadoEliminar}
                      title={
                        bloqueadoEliminar
                          ? "No se puede eliminar un item ya preparado"
                          : "Eliminar"
                      }
                      className={`w-8 h-8 rounded-lg font-bold text-white ${
                        bloqueadoEliminar
                          ? "bg-red-200 cursor-not-allowed"
                          : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      ×
                    </button>
                    <span className="font-bold text-gray-800 w-20 text-right">
                      ${Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón Agregar Producto */}
          {!mostrarAgregar ? (
            <button
              onClick={() => setMostrarAgregar(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold mb-4"
            >
              + Agregar Producto
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2 text-black">
                Seleccionar Producto:
              </h4>
              <select
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-2 text-black"
              >
                <option value="">-- Seleccione --</option>
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre} - ${Number(producto.precio).toFixed(2)}{" "}
                    (stock: {producto.stock})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={agregarProducto}
                  disabled={!productoSeleccionado}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  Agregar
                </button>
                <button
                  onClick={() => {
                    setMostrarAgregar(false);
                    setProductoSeleccionado("");
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Razón del Cambio */}
          <div className="mb-4">
            <label className="block font-semibold text-gray-700 mb-2">
              Razón del cambio: <span className="text-red-500">*</span>
            </label>
            <textarea
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              placeholder="Ejemplo: Cliente pidió cambio, Error en el pedido, etc."
              className="w-full border rounded-lg px-3 py-2 h-20 resize-none text-black"
              required
            />
          </div>

          {/* Resumen de Totales */}
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            {/* Subtotal productos */}
            <div className="flex justify-between mb-2 text-gray-600 text-sm">
              <span>Subtotal productos:</span>
              <span className="font-medium">
                ${calcularSubtotalProductos()?.toFixed(2)}
              </span>
            </div>
            {/* Recargo para llevar / domicilio */}
            {Number(orden.recargo ?? 0) > 0 && (
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-yellow-700">
                  Recargo (
                  {orden.tipoOrden === "para_llevar"
                    ? "Para Llevar"
                    : "Domicilio"}
                  ):
                </span>
                <span className="font-medium text-yellow-700">
                  +${Number(orden.recargo).toFixed(2)}
                </span>
              </div>
            )}
            {/* Costo de envío */}
            {Number(orden.costoEnvio ?? 0) > 0 && (
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-blue-700">🛵 Costo de envío:</span>
                <span className="font-medium text-blue-700">
                  +${Number(orden.costoEnvio).toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between mb-2 text-gray-600">
              <span className="text-gray-600">Total Anterior:</span>
              <span className="font-bold">
                ${Number(totalAnterior).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between mb-2 text-gray-600">
              <span className="text-gray-600">Total Nuevo:</span>
              <span className="font-bold">
                ${Number(totalNuevo).toFixed(2)}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold text-gray-600">Diferencia:</span>
              <span
                className={`font-bold ${
                  diferencia > 0
                    ? "text-green-600"
                    : diferencia < 0
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {diferencia > 0 ? "+" : ""}${Number(diferencia).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Advertencia de cambios */}
          {hayCambios && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Atención:</strong> Esta orden será marcada como
                modificada y todos los cambios quedarán registrados en el
                historial.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={guardarCambios}
            disabled={loading || !hayCambios || !razon.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

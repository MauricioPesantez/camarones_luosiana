"use client";

import { useState, useEffect } from "react";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
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
  numeroMesa: number;
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

  useEffect(() => {
    // Cargar productos disponibles
    fetch("/api/productos")
      .then((res) => res.json())
      .then((data) => setProductos(data))
      .catch((error) => console.error("Error al cargar productos:", error));
  }, []);

  const modificarCantidad = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const nuevaCantidad = Math.max(1, item.cantidad + delta);
          return {
            ...item,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * item.precioUnitario,
          };
        }
        return item;
      }),
    );
  };

  const eliminarItem = (itemId: string) => {
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
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const obtenerCambios = () => {
    const cambios: any[] = [];

    // Detectar items eliminados
    orden.items.forEach((itemOriginal) => {
      const existe = items.find((i) => i.id === itemOriginal.id);
      if (!existe) {
        cambios.push({
          accion: "eliminar",
          itemId: itemOriginal.id,
        });
      }
    });

    // Detectar items modificados
    items.forEach((item) => {
      const itemOriginal = orden.items.find((i) => i.id === item.id);
      if (itemOriginal && itemOriginal.cantidad !== item.cantidad) {
        cambios.push({
          accion: "modificar",
          itemId: item.id,
          cantidad: item.cantidad,
        });
      }
    });

    // Detectar items agregados (tienen id temporal)
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

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al modificar orden");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || "Error al modificar orden");
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
          <h2 className="text-2xl font-bold text-gray-800">
            Editar Orden - Mesa {orden.numeroMesa}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-700 mb-3">
            Items de la Orden:
          </h3>
          <div className="space-y-2 mb-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {item.producto.nombre}
                  </p>
                  <p className="text-sm text-gray-500">
                    ${Number(item.precioUnitario).toFixed(2)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => modificarCantidad(item.id, -1)}
                    className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-lg font-bold"
                  >
                    -
                  </button>
                  <span className="font-bold text-lg w-8 text-center">
                    {item.cantidad}
                  </span>
                  <button
                    onClick={() => modificarCantidad(item.id, 1)}
                    className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-lg font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => eliminarItem(item.id)}
                    className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-lg font-bold"
                  >
                    ×
                  </button>
                  <span className="font-bold text-gray-800 w-20 text-right">
                    ${Number(item.subtotal).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
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
              <h4 className="font-semibold mb-2">Seleccionar Producto:</h4>
              <select
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-2"
              >
                <option value="">-- Seleccione --</option>
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre} - ${Number(producto.precio).toFixed(2)}
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
              className="w-full border rounded-lg px-3 py-2 h-20 resize-none"
              required
            />
          </div>

          {/* Resumen de Totales */}
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Total Anterior:</span>
              <span className="font-bold">
                ${Number(totalAnterior).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Total Nuevo:</span>
              <span className="font-bold">
                ${Number(totalNuevo).toFixed(2)}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Diferencia:</span>
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

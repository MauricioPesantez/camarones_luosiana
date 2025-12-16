"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ProductoConStock } from "@/types/stock";

export default function ProductosPage() {
  const { usuario, loading: authLoading, logout } = useAuth();
  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [productoEditando, setProductoEditando] = useState<string | null>(null);
  const [nuevoStock, setNuevoStock] = useState<{ [key: string]: number }>({});
  const [operacion, setOperacion] = useState<'agregar' | 'establecer'>('establecer');

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuario && usuario.rol === "admin") {
      cargarProductos();
    }
  }, [usuario]);

  const actualizarStock = async (productoId: string) => {
    const cantidad = nuevoStock[productoId];
    if (cantidad === undefined || cantidad === null) {
      alert("Por favor ingresa una cantidad válida");
      return;
    }

    try {
      const res = await fetch("/api/stock/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId,
          cantidad,
          operacion,
        }),
      });

      if (res.ok) {
        await cargarProductos();
        setProductoEditando(null);
        setNuevoStock({});
      } else {
        const error = await res.json();
        alert(error.error || "Error al actualizar stock");
      }
    } catch (error) {
      console.error("Error al actualizar stock:", error);
      alert("Error al actualizar stock");
    }
  };

  const getStockColor = (producto: ProductoConStock) => {
    if (producto.stock === 0) return "text-red-600 font-bold";
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo) return "text-yellow-600 font-semibold";
    return "text-green-600";
  };

  const getStockBgColor = (producto: ProductoConStock) => {
    if (producto.stock === 0) return "bg-red-50";
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo) return "bg-yellow-50";
    return "";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Acceso denegado</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gestión de Stock</h1>
            <p className="text-gray-600">Administrar inventario de productos</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = "/admin"}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Volver a Admin
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium text-gray-700">Operación:</span>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="establecer"
                checked={operacion === 'establecer'}
                onChange={(e) => setOperacion(e.target.value as 'establecer')}
                className="text-blue-600"
              />
              <span className="text-sm">Establecer cantidad</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="agregar"
                checked={operacion === 'agregar'}
                onChange={(e) => setOperacion(e.target.value as 'agregar')}
                className="text-blue-600"
              />
              <span className="text-sm">Agregar/Restar cantidad</span>
            </label>
          </div>
        </div>

        {/* Tabla de productos */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Cargando productos...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Stock Actual
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Stock Mínimo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productos.map((producto) => (
                  <tr key={producto.id} className={getStockBgColor(producto)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{producto.nombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{producto.categoria}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-lg font-bold ${getStockColor(producto)}`}>
                        {producto.stock}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-500">
                        {producto.stockMinimo || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {producto.stock === 0 ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Sin Stock
                        </span>
                      ) : producto.stockMinimo && producto.stock <= producto.stockMinimo ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Stock Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Disponible
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {productoEditando === producto.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={nuevoStock[producto.id] || ""}
                            onChange={(e) =>
                              setNuevoStock({
                                ...nuevoStock,
                                [producto.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-2 py-1 border rounded text-sm"
                            placeholder={operacion === 'agregar' ? '+/-' : 'Nuevo'}
                          />
                          <button
                            onClick={() => actualizarStock(producto.id)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setProductoEditando(null);
                              setNuevoStock({});
                            }}
                            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setProductoEditando(producto.id)}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                        >
                          Ajustar Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

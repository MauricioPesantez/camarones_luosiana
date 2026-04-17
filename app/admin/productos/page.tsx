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
  const [operacion, setOperacion] = useState<"agregar" | "establecer">(
    "establecer",
  );

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
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo)
      return "text-yellow-600 font-semibold";
    return "text-green-600";
  };

  const getStockBgColor = (producto: ProductoConStock) => {
    if (producto.stock === 0) return "bg-red-50";
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo)
      return "bg-yellow-50";
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

  const getBadge = (producto: ProductoConStock) => {
    if (producto.stock === 0)
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          Sin Stock
        </span>
      );
    if (producto.stockMinimo && producto.stock <= producto.stockMinimo)
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
          Stock Bajo
        </span>
      );
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Disponible
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 leading-tight">
              Gestión de Stock
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Administrar inventario de productos
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => (window.location.href = "/admin")}
              className="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 whitespace-nowrap"
            >
              ← Admin
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Selector de operación */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <span className="text-sm font-semibold text-gray-700 block mb-2">
            Tipo de operación:
          </span>
          <div className="flex gap-3">
            <label
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 cursor-pointer transition-colors ${operacion === "establecer" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}
            >
              <input
                type="radio"
                value="establecer"
                checked={operacion === "establecer"}
                onChange={(e) => setOperacion(e.target.value as "establecer")}
                className="hidden"
              />
              <span className="text-sm font-medium">
                📋 Establecer cantidad
              </span>
            </label>
            <label
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 cursor-pointer transition-colors ${operacion === "agregar" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}
            >
              <input
                type="radio"
                value="agregar"
                checked={operacion === "agregar"}
                onChange={(e) => setOperacion(e.target.value as "agregar")}
                className="hidden"
              />
              <span className="text-sm font-medium">➕ Agregar / Restar</span>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Cargando productos...
          </div>
        ) : (
          <>
            {/* === MOBILE: tarjetas === */}
            <div className="flex flex-col gap-3 sm:hidden">
              {productos.map((producto) => (
                <div
                  key={producto.id}
                  className={`bg-white rounded-xl shadow p-4 ${getStockBgColor(producto)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {producto.nombre}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {producto.categoria}
                      </div>
                    </div>
                    {getBadge(producto)}
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${getStockColor(producto)}`}
                      >
                        {producto.stock}
                      </div>
                      <div className="text-xs text-gray-400">Stock actual</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-500">
                        {producto.stockMinimo ?? "-"}
                      </div>
                      <div className="text-xs text-gray-400">Stock mín.</div>
                    </div>
                  </div>
                  {productoEditando === producto.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={nuevoStock[producto.id] ?? ""}
                        onChange={(e) =>
                          setNuevoStock({
                            ...nuevoStock,
                            [producto.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500"
                        placeholder={
                          operacion === "agregar"
                            ? "Ej: +5 o -2"
                            : "Nueva cantidad"
                        }
                        autoFocus
                      />
                      <button
                        onClick={() => actualizarStock(producto.id)}
                        className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-semibold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setProductoEditando(null);
                          setNuevoStock({});
                        }}
                        className="px-4 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setProductoEditando(producto.id)}
                      className="w-full py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold"
                    >
                      Ajustar Stock
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* === DESKTOP: tabla === */}
            <div className="hidden sm:block bg-white rounded-xl shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Categoría
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Stock Actual
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Stock Mín.
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productos.map((producto) => (
                    <tr key={producto.id} className={getStockBgColor(producto)}>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {producto.nombre}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {producto.categoria}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`text-lg font-bold ${getStockColor(producto)}`}
                        >
                          {producto.stock}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-500">
                        {producto.stockMinimo ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {getBadge(producto)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {productoEditando === producto.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={nuevoStock[producto.id] ?? ""}
                              onChange={(e) =>
                                setNuevoStock({
                                  ...nuevoStock,
                                  [producto.id]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-24 px-2 py-1 border rounded text-sm"
                              placeholder={
                                operacion === "agregar" ? "+/-" : "Nuevo"
                              }
                              autoFocus
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
                              className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setProductoEditando(producto.id)}
                            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
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
          </>
        )}
      </div>
    </div>
  );
}

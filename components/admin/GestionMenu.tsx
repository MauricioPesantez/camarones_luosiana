"use client";

import { useEffect, useState } from "react";
import { ProductoConStock } from "@/types/stock";
import ModalFormulario from "./ModalFormulario";
import FormularioProducto from "./FormularioProducto";

/** vista=admin es la unica forma de ver tambien los productos desactivados. */
async function obtenerProductos(): Promise<ProductoConStock[]> {
  try {
    const res = await fetch("/api/productos?vista=admin");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error al cargar productos:", error);
    return [];
  }
}

export default function GestionMenu() {
  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<ProductoConStock | null>(null);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      setProductos(await obtenerProductos());
    } finally {
      setLoading(false);
    }
  };

  // La carga inicial arranca ya en loading y solo escribe estado despues del
  // await: hacerlo de forma sincrona en el efecto encadena renders.
  useEffect(() => {
    let vigente = true;

    obtenerProductos().then((data) => {
      if (!vigente) return;
      setProductos(data);
      setLoading(false);
    });

    return () => {
      vigente = false;
    };
  }, []);

  const categorias = Array.from(new Set(productos.map((p) => p.categoria))).sort();

  const abrirCreacion = () => {
    setProductoEditando(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (producto: ProductoConStock) => {
    setProductoEditando(producto);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProductoEditando(null);
  };

  const alGuardar = async () => {
    cerrarModal();
    await cargarProductos();
  };

  const alternarDisponible = async (producto: ProductoConStock) => {
    try {
      const res = await fetch(`/api/productos/${producto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponible: !producto.disponible }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "No se pudo cambiar el estado del producto");
        return;
      }

      await cargarProductos();
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
      alert("Error de conexión al cambiar el estado del producto");
    }
  };

  const badgeEstado = (producto: ProductoConStock) =>
    producto.disponible ? (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Activo
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600">
        Inactivo
      </span>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {productos.length} producto{productos.length === 1 ? "" : "s"} en el catálogo
        </span>
        <button
          onClick={abrirCreacion}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-semibold"
        >
          + Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando productos...</div>
      ) : (
        <>
          {/* === MOBILE: tarjetas === */}
          <div className="flex flex-col gap-3 sm:hidden">
            {productos.map((producto) => (
              <div
                key={producto.id}
                className={`bg-white rounded-xl shadow p-4 ${producto.disponible ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{producto.nombre}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{producto.categoria}</div>
                  </div>
                  {badgeEstado(producto)}
                </div>
                <div className="text-lg font-bold text-gray-800 mb-3">
                  ${Number(producto.precio).toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEdicion(producto)}
                    className="flex-1 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarDisponible(producto)}
                    className="flex-1 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 font-semibold"
                  >
                    {producto.disponible ? "Desactivar" : "Activar"}
                  </button>
                </div>
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
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                    Precio
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
                  <tr key={producto.id} className={producto.disponible ? "" : "bg-gray-50"}>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {producto.nombre}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{producto.categoria}</td>
                    <td className="px-5 py-4 text-sm text-right font-semibold text-gray-800">
                      ${Number(producto.precio).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-center">{badgeEstado(producto)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => abrirEdicion(producto)}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => alternarDisponible(producto)}
                          className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
                        >
                          {producto.disponible ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalAbierto && (
        <ModalFormulario
          titulo={productoEditando ? "Editar producto" : "Nuevo producto"}
          onCerrar={cerrarModal}
        >
          <FormularioProducto
            producto={productoEditando}
            categorias={categorias}
            onCancelar={cerrarModal}
            onGuardado={alGuardar}
          />
        </ModalFormulario>
      )}
    </div>
  );
}

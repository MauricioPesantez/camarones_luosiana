"use client";

import { FormEvent, useState } from "react";
import { ProductoConStock } from "@/types/stock";

interface Props {
  producto: ProductoConStock | null;
  categorias: string[];
  onCancelar: () => void;
  onGuardado: () => void;
}

const claseCampo =
  "w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500";
const claseEtiqueta = "block text-sm font-semibold text-gray-700 mb-1";

export default function FormularioProducto({
  producto,
  categorias,
  onCancelar,
  onGuardado,
}: Props) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoria, setCategoria] = useState(producto?.categoria ?? "");
  // Prisma serializa Decimal como string: Number() antes de mostrarlo.
  const [precio, setPrecio] = useState(producto ? String(Number(producto.precio)) : "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [tiempoPreparacion, setTiempoPreparacion] = useState(
    String(producto?.tiempoPreparacion ?? 0),
  );
  const [stock, setStock] = useState("0");
  const [stockMinimo, setStockMinimo] = useState(String(producto?.stockMinimo ?? 5));
  const [disponible, setDisponible] = useState(producto?.disponible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);

    const cuerpo: Record<string, unknown> = {
      nombre,
      categoria,
      precio: Number(precio),
      descripcion,
      tiempoPreparacion: Number(tiempoPreparacion),
      stockMinimo: Number(stockMinimo),
      disponible,
    };

    // El stock solo se fija al crear: despues se ajusta en la pestana Stock.
    if (!producto) cuerpo.stock = Number(stock);

    try {
      const res = await fetch(
        producto ? `/api/productos/${producto.id}` : "/api/productos",
        {
          method: producto ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el producto");
        return;
      }

      onGuardado();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      setError("Error de conexión al guardar el producto");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <label className={claseEtiqueta} htmlFor="producto-nombre">
          Nombre
        </label>
        <input
          id="producto-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={claseCampo}
          autoFocus
        />
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="producto-categoria">
          Categoría
        </label>
        <input
          id="producto-categoria"
          list="categorias-existentes"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={claseCampo}
          placeholder="Ej: Entradas"
        />
        {/* Sugerir las categorias que ya existen evita "Bebidas" y "bebidas". */}
        <datalist id="categorias-existentes">
          {categorias.map((valor) => (
            <option key={valor} value={valor} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={claseEtiqueta} htmlFor="producto-precio">
            Precio ($)
          </label>
          <input
            id="producto-precio"
            type="number"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={claseCampo}
          />
        </div>
        <div>
          <label className={claseEtiqueta} htmlFor="producto-tiempo">
            Tiempo prep. (min)
          </label>
          <input
            id="producto-tiempo"
            type="number"
            min="0"
            value={tiempoPreparacion}
            onChange={(e) => setTiempoPreparacion(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!producto && (
          <div>
            <label className={claseEtiqueta} htmlFor="producto-stock">
              Stock inicial
            </label>
            <input
              id="producto-stock"
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={claseCampo}
            />
          </div>
        )}
        <div>
          <label className={claseEtiqueta} htmlFor="producto-stock-minimo">
            Stock mínimo
          </label>
          <input
            id="producto-stock-minimo"
            type="number"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className={claseCampo}
          />
        </div>
      </div>

      <div>
        <label className={claseEtiqueta} htmlFor="producto-descripcion">
          Descripción (opcional)
        </label>
        <textarea
          id="producto-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={claseCampo}
          rows={2}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={disponible}
          onChange={(e) => setDisponible(e.target.checked)}
          className="w-4 h-4"
        />
        Disponible en el menú
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-semibold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50"
        >
          {guardando ? "Guardando..." : producto ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

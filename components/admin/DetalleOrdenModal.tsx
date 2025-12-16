'use client';

import { useState } from 'react';
import HistorialOrdenTimeline from './HistorialOrdenTimeline';

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  estado: string;
  total: number;
  tiempoEstimado: number;
  modificada: boolean;
  createdAt: string;
  updatedAt: string;
  observaciones?: string;
  items: {
    cantidad: number;
    producto: {
      nombre: string;
      categoria: string;
    };
    precioUnitario: number;
    subtotal: number;
    observaciones?: string;
  }[];
}

interface DetalleOrdenModalProps {
  orden: Orden;
  onClose: () => void;
}

export default function DetalleOrdenModal({ orden, onClose }: DetalleOrdenModalProps) {
  const [pestanaActiva, setPestanaActiva] = useState<'resumen' | 'historial'>('resumen');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Orden Mesa {orden.numeroMesa}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(orden.createdAt).toLocaleString('es-EC')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Pestañas */}
        <div className="border-b bg-gray-50">
          <div className="flex gap-2 px-6">
            <button
              onClick={() => setPestanaActiva('resumen')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                pestanaActiva === 'resumen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 Resumen
            </button>
            <button
              onClick={() => setPestanaActiva('historial')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                pestanaActiva === 'historial'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              📜 Historial
              {orden.modificada && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Modificada
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {pestanaActiva === 'resumen' ? (
            <div className="space-y-6">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 font-semibold">Mesero</label>
                  <p className="text-lg text-gray-800">{orden.mesero}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">Estado</label>
                  <p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        orden.estado === 'completada'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {orden.estado}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">
                    Tiempo Estimado
                  </label>
                  <p className="text-lg text-gray-800">{orden.tiempoEstimado} minutos</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-semibold">Total</label>
                  <p className="text-2xl font-bold text-green-600">
                    ${Number(orden.total).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Observaciones Generales */}
              {orden.observaciones && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <label className="text-sm text-blue-900 font-semibold">
                    Observaciones Generales:
                  </label>
                  <p className="text-blue-800 mt-1">{orden.observaciones}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                  Items de la Orden:
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          P. Unit.
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orden.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-800">
                                {item.producto.nombre}
                              </p>
                              {item.observaciones && (
                                <p className="text-xs text-gray-500 italic">
                                  Nota: {item.observaciones}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.producto.categoria}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-800">
                            {item.cantidad}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            ${Number(item.precioUnitario).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            ${Number(item.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-800">
                          TOTAL:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                          ${Number(orden.total).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Badge de Modificación */}
              {orden.modificada && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-sm text-yellow-800 font-semibold">
                    ⚠️ Esta orden fue modificada después de su creación. Ver pestaña
                    "Historial" para detalles completos.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Timeline de Cambios
              </h3>
              <HistorialOrdenTimeline ordenId={orden.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

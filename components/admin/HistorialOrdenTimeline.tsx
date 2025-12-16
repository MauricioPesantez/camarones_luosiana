'use client';

import { useEffect, useState } from 'react';

interface HistorialItem {
  id: string;
  tipoAccion: string;
  descripcion: string;
  itemAfectado?: any;
  datosAntes?: any;
  datosDespues?: any;
  usuarioNombre: string;
  usuarioRol: string;
  razon?: string;
  diferenciaTotal?: number;
  createdAt: string;
}

interface HistorialOrdenTimelineProps {
  ordenId: string;
}

export default function HistorialOrdenTimeline({ ordenId }: HistorialOrdenTimelineProps) {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarHistorial = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ordenes/${ordenId}/historial`);
        const data = await res.json();
        setHistorial(data);
      } catch (error) {
        console.error('Error al cargar historial:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarHistorial();
  }, [ordenId]);

  const getIcono = (tipoAccion: string) => {
    switch (tipoAccion) {
      case 'orden_creada':
        return '📅';
      case 'item_agregado':
        return '✅';
      case 'item_eliminado':
        return '❌';
      case 'item_modificado':
        return '📝';
      case 'orden_completada':
        return '🎉';
      default:
        return '📌';
    }
  };

  const getColorClase = (tipoAccion: string) => {
    switch (tipoAccion) {
      case 'orden_creada':
        return 'bg-blue-100 border-blue-400 text-blue-800';
      case 'item_agregado':
        return 'bg-green-100 border-green-400 text-green-800';
      case 'item_eliminado':
        return 'bg-red-100 border-red-400 text-red-800';
      case 'item_modificado':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'orden_completada':
        return 'bg-purple-100 border-purple-400 text-purple-800';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-800';
    }
  };

  const formatearTipoAccion = (tipoAccion: string) => {
    switch (tipoAccion) {
      case 'orden_creada':
        return 'Orden Creada';
      case 'item_agregado':
        return 'Item Agregado';
      case 'item_eliminado':
        return 'Item Eliminado';
      case 'item_modificado':
        return 'Item Modificado';
      case 'orden_completada':
        return 'Orden Completada';
      default:
        return tipoAccion;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Cargando historial...
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay historial disponible para esta orden
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {historial.map((item, index) => (
        <div key={item.id} className="relative pl-8">
          {/* Línea vertical del timeline */}
          {index < historial.length - 1 && (
            <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-300"></div>
          )}

          {/* Punto del timeline */}
          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-sm">
            {getIcono(item.tipoAccion)}
          </div>

          {/* Contenido */}
          <div
            className={`border-l-4 rounded-lg p-4 ${getColorClase(item.tipoAccion)}`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-sm">
                  {formatearTipoAccion(item.tipoAccion)}
                </h4>
                <p className="text-xs opacity-75">
                  {new Date(item.createdAt).toLocaleString('es-EC')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{item.usuarioNombre}</p>
                <p className="text-xs opacity-75">{item.usuarioRol}</p>
              </div>
            </div>

            {/* Descripción */}
            <p className="text-sm mb-2">{item.descripcion}</p>

            {/* Razón del cambio */}
            {item.razon && (
              <div className="bg-white bg-opacity-50 rounded p-2 mb-2">
                <p className="text-xs font-semibold mb-1">Razón del cambio:</p>
                <p className="text-xs italic">{item.razon}</p>
              </div>
            )}

            {/* Detalles del item afectado */}
            {item.itemAfectado && (
              <div className="bg-white bg-opacity-50 rounded p-2 mb-2">
                <p className="text-xs font-semibold mb-1">Item afectado:</p>
                <div className="text-xs">
                  {item.itemAfectado.producto?.nombre && (
                    <p>
                      <strong>Producto:</strong> {item.itemAfectado.producto.nombre}
                    </p>
                  )}
                  {item.itemAfectado.cantidad && (
                    <p>
                      <strong>Cantidad:</strong> {item.itemAfectado.cantidad}
                    </p>
                  )}
                  {item.itemAfectado.precioUnitario && (
                    <p>
                      <strong>Precio:</strong> $
                      {Number(item.itemAfectado.precioUnitario).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Cambios (antes/después) */}
            {item.datosAntes && item.datosDespues && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-white bg-opacity-50 rounded p-2">
                  <p className="text-xs font-semibold mb-1">Antes:</p>
                  <p className="text-xs">
                    Cantidad: {item.datosAntes.cantidad || 'N/A'}
                  </p>
                </div>
                <div className="bg-white bg-opacity-50 rounded p-2">
                  <p className="text-xs font-semibold mb-1">Después:</p>
                  <p className="text-xs">
                    Cantidad: {item.datosDespues.cantidad || 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Impacto financiero */}
            {item.diferenciaTotal && item.diferenciaTotal !== 0 && (
              <div className="bg-white bg-opacity-50 rounded p-2">
                <p className="text-xs font-semibold">
                  Impacto financiero:{' '}
                  <span
                    className={
                      Number(item.diferenciaTotal) >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                    }
                  >
                    {Number(item.diferenciaTotal) >= 0 ? '+' : ''}$
                    {Number(item.diferenciaTotal).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

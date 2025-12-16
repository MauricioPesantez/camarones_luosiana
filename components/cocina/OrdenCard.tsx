'use client';

import { useEffect, useState } from 'react';

interface Producto {
  nombre: string;
  categoria: string;
}

interface Item {
  cantidad: number;
  producto: Producto;
  observaciones?: string;
}

interface Orden {
  id: string;
  numeroMesa: number;
  mesero: string;
  observaciones?: string;
  tiempoEstimado: number;
  modificada?: boolean;
  createdAt: string;
  items: Item[];
}

interface OrdenCardProps {
  orden: Orden;
  onMarcarLista: (id: string) => void;
}

interface EstadoTiempo {
  bgColor: string;
  borderColor: string;
  textColor: string;
  animacion: string;
  icono: string;
  label: string;
}

export default function OrdenCard({ orden, onMarcarLista }: OrdenCardProps) {
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);

  useEffect(() => {
    const calcularTiempo = () => {
      const ahora = new Date().getTime();
      const creacion = new Date(orden.createdAt).getTime();
      const minutos = Math.floor((ahora - creacion) / 60000);
      setTiempoTranscurrido(minutos);
    };

    // Calcular inmediatamente
    calcularTiempo();

    // Actualizar cada 30 segundos
    const interval = setInterval(calcularTiempo, 30000);

    return () => clearInterval(interval);
  }, [orden.createdAt]);

  const getEstadoTiempo = (transcurrido: number, estimado: number): EstadoTiempo => {
    const porcentaje = estimado > 0 ? (transcurrido / estimado) * 100 : 0;

    if (porcentaje > 100) {
      // Crítico - Más del 100%
      return {
        bgColor: 'bg-red-100',
        borderColor: 'border-red-600',
        textColor: 'text-red-700',
        animacion: 'animate-pulse-strong',
        icono: '🚨',
        label: 'RETRASADO',
      };
    } else if (porcentaje >= 90) {
      // Urgente - 90-100%
      return {
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-600',
        textColor: 'text-orange-700',
        animacion: 'animate-pulse-medium',
        icono: '🔥',
        label: 'URGENTE',
      };
    } else if (porcentaje >= 60) {
      // Advertencia - 60-90%
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-700',
        animacion: 'animate-pulse-soft',
        icono: '⚠️',
        label: 'PRONTO',
      };
    } else {
      // OK - 0-60%
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-500',
        textColor: 'text-green-700',
        animacion: '',
        icono: '⏱️',
        label: 'A TIEMPO',
      };
    }
  };

  const estado = getEstadoTiempo(tiempoTranscurrido, orden.tiempoEstimado);
  const porcentajeProgreso = orden.tiempoEstimado > 0
    ? Math.min((tiempoTranscurrido / orden.tiempoEstimado) * 100, 100)
    : 0;

  return (
    <div
      className={`${estado.bgColor} ${estado.borderColor} ${estado.animacion} border-4 rounded-lg p-6 shadow-lg transition-all relative overflow-hidden`}
    >
      {/* Barra de progreso en la parte inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200">
        <div
          className={`h-full transition-all duration-1000 ${
            porcentajeProgreso > 100
              ? 'bg-red-600'
              : porcentajeProgreso >= 90
              ? 'bg-orange-600'
              : porcentajeProgreso >= 60
              ? 'bg-yellow-500'
              : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(porcentajeProgreso, 100)}%` }}
        ></div>
      </div>

      {/* Badge de estado en la esquina superior derecha */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-2xl">{estado.icono}</span>
        <span
          className={`${estado.textColor} font-bold text-sm px-3 py-1 rounded-full border-2 ${estado.borderColor} bg-white`}
        >
          {estado.label}
        </span>
      </div>

      {/* Badge de orden modificada */}
      {orden.modificada && (
        <div className="mb-3 bg-blue-100 border-l-4 border-blue-500 p-2 rounded">
          <span className="text-blue-800 text-sm font-bold">
            🔄 Orden Modificada
          </span>
        </div>
      )}

      {/* Header con mesa y mesero */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800">
            Mesa {orden.numeroMesa}
          </h2>
        </div>
        <p className="text-gray-600 text-sm mt-1">Mesero: {orden.mesero}</p>
      </div>

      {/* Información de tiempo */}
      <div className={`${estado.textColor} font-semibold mb-4 text-lg`}>
        <div className="flex items-center gap-2">
          <span>Tiempo: {tiempoTranscurrido} / {orden.tiempoEstimado} min</span>
        </div>
        <div className="text-sm opacity-75 mt-1">
          Hace {tiempoTranscurrido} minutos
        </div>
      </div>

      {/* Items de la orden */}
      <div className="space-y-2 mb-4">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
          Productos:
        </h3>
        {orden.items.map((item, index) => (
          <div key={index} className="bg-white bg-opacity-60 rounded p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="font-semibold text-gray-800">
                  {item.cantidad}x {item.producto.nombre}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({item.producto.categoria})
                </span>
              </div>
            </div>
            {item.observaciones && (
              <p className="text-sm text-gray-600 italic mt-1">
                Nota: {item.observaciones}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Observaciones generales */}
      {orden.observaciones && (
        <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
          <p className="text-sm font-semibold text-blue-900 mb-1">
            Observaciones generales:
          </p>
          <p className="text-sm text-blue-800">{orden.observaciones}</p>
        </div>
      )}

      {/* Botón de acción */}
      <button
        onClick={() => onMarcarLista(orden.id)}
        className="w-full bg-gray-800 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors font-semibold text-lg mt-2"
      >
        Marcar como Lista
      </button>
    </div>
  );
}

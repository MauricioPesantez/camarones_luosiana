export function formatearTiempoTranscurrido(desde: Date, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - desde.getTime()) / 60_000);
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const restantes = minutos % 60;
  return `${Math.floor(minutos / 60)} h${restantes ? ` ${restantes} min` : ''}`;
}

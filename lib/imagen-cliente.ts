// Corre solo en el navegador. Una foto de celular pesa 3-8 MB; comprimida a
// 1600 px de lado mayor y JPEG 0.8 queda en unos 200 KB, que es lo que sube.
export async function comprimirImagen(
  file: File,
  maxLado = 1600,
  calidad = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo procesar la imagen');
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', calidad),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

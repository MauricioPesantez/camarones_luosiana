// Corre solo en el navegador. Una foto de celular pesa 3-8 MB; comprimida a
// 1600 px de lado mayor y JPEG 0.8 queda en unos 200 KB, que es lo que sube.
export async function comprimirImagen(
  file: File,
  maxLado = 1600,
  calidad = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  // El bitmap se cierra pase lo que pase: si `getContext` falla, salir por la
  // excepcion sin liberarlo dejaria la imagen decodificada en memoria.
  try {
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo procesar la imagen');
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', calidad),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

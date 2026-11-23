/** Acepta punto o coma; null si no es un monto entre 0.01 y 9999.99. */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  // Hasta cuatro enteros y dos decimales; al menos un dígito.
  if (!/^(?=.*\d)\d{0,4}(\.\d{0,2})?$/.test(limpio)) return null;
  const monto = Number(limpio);
  return monto > 0 ? monto : null;
}

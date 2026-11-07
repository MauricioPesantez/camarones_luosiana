export type ReturnedQuantity = { cantidad: number; devolverEnvase: boolean };

export function remainingConsumptionQuantities(quantity: number, hasContainer: boolean, returns: readonly ReturnedQuantity[]) {
  return {
    quantity: quantity - returns.reduce((sum, item) => sum + item.cantidad, 0),
    containers: hasContainer ? quantity - returns.reduce((sum, item) => sum + (item.devolverEnvase ? item.cantidad : 0), 0) : 0,
  };
}

export function hasOnlyConsumptionActionFields(action: 'entregar' | 'anular' | 'corregir', body: object) {
  const allowed = action === 'entregar' ? ['clientRequestId', 'expectedRevision'] : action === 'anular' ? ['clientRequestId', 'razon', 'reponerStock'] : ['clientRequestId', 'razon', 'items', 'nuevoEmpleadoId'];
  return Object.keys(body).every(key => allowed.includes(key));
}

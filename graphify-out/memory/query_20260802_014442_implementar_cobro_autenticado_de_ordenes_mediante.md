---
type: "query"
date: "2026-08-02T01:44:42.002944+00:00"
question: "Implementar cobro autenticado de ordenes mediante QR o URL, con impresion, delivery y cuadre de caja"
contributor: "graphify"
source_nodes: ["POST /api/ordenes (crear orden)", "PATCH /api/ordenes/[id]/cobrar", "buildOrderSnapshot()", "calcularResumenCuadre()"]
---

# Q: Implementar cobro autenticado de ordenes mediante QR o URL, con impresion, delivery y cuadre de caja

## Answer

Expanded from original query via vocab: [order, payment, cash, transfer, delivery, amount, auth, admin, print, receipt, route, transaction]. El grafo mostro que POST /api/ordenes ya calcula productos mas recipientes mas envio dentro de una transaccion, PATCH cobrar ya tenia compare-and-set por cobrada y printRevision, buildOrderSnapshot congela el payload y calcularResumenCuadre distingue efectivo y transferencia de domicilio. La solucion conserva esos invariantes, agrega sesion servidor, token opaco, registro Cobro inmutable, QR opcional y separa estado operativo de cobrada.

## Source Nodes

- POST /api/ordenes (crear orden)
- PATCH /api/ordenes/[id]/cobrar
- buildOrderSnapshot()
- calcularResumenCuadre()
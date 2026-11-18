# Espera de la moto según carga de cocina — diseño corto

## Por qué

El aviso automático "MOTO para orden…" al grupo Motos sale a 10 min fijos cuando el
pedido de WhatsApp no trae línea `Moto N`. Con mesas del local en cocina la comida
tarda más y el motorizado espera; los motorizados se quejan. Se olvida a menudo
escribir la línea `Moto N`.

## Objetivo

- Si no hay línea `Moto N`, calcular la espera con el tiempo propio de la orden y la
  carga real de cocina.
- Preferir que la comida espere 2–3 min a que el motorizado espere 15.

**No objetivos:** retrasar la impresión (sigue inmediata); domicilios manuales (siguen
con "Programar"/"Pedir moto" en pantalla); medir llegada real de la moto (opción C,
queda para después si siguen las quejas).

**Anti-objetivo:** que órdenes nunca marcadas "Lista" inflen la carga para siempre.

## Enfoques considerados

- **A — Carga por órdenes en cocina (elegido).** Sin cambio de hábito en cocina.
  Números iniciales supuestos, se calibran.
- B — Cocina pide la moto (botón / al marcar Lista). Exacto, pero "Lista" no se marca
  siempre. Descartado por ahora.
- C — A + guardar hora de Lista y llegada de moto para calibrar. Más trabajo y
  depende de otro botón. Queda como siguiente paso.

## Diseño

- **Dónde:** `avisoDeDelivery` en `lib/whatsapp-salidas.ts`. Callers: aceptación en
  `lib/whatsapp-ingreso.ts` y aprobación sin stock en `registrarAprobacionWhatsapp`.
- **Órdenes en cocina:** todas las órdenes (local, para llevar, domicilio; el consumo de
  empleado nace 'entregada' (lib/employee-consumption.ts:66), nunca cuenta, igual que en la pantalla de cocina), `anulada = false`, `estado IN ('pendiente','en_preparacion')`, excluida la
  orden nueva, y que siguen vigentes: `createdAt + tiempo + 10 min > ahora`, con
  `tiempo = max(tiempoEstimado, 15)`. Las que nadie marcó Lista dejan de contar solas al vencer.
- **Fórmula sin línea `Moto N`:**
  `espera = max(tiempoEstimado, 15) + 3 × enCocina − 5`, tope 45 min.
  Ajuste al planificar: `tiempoEstimado` solo suma "Platos Fuertes" (entradas y
  acompañamientos aportan 10 %), así que en combos es 0 y en solo-entradas 1–2. Con
  piso de 15, la moto nunca se pide antes de los 10 min de hoy sin línea `Moto N`.
- **Con línea `Moto N`:** se respeta tal cual (sin consulta de carga).
- **Confirmación al operador:** `Moto se pedirá al grupo: 14:32 (3 órdenes en cocina)`
  cuando se usó la carga; igual que hoy cuando vino `Moto N`.
- **Una sola consulta:** se calcula la espera una vez por aceptación y se pasa a
  confirmación y a la salida, para que ambas muestren la misma hora.

## Números (decisión de Claude, calibrables)

- 3 min por orden en cocina
- 5 min de llegada de la moto
- 10 min de margen de vigencia
- piso de tiempo propio 15 min; tope de espera 45 min

## Pruebas

Test de la fórmula pura: 0, 2 y 10 órdenes en cocina; `tiempoEstimado` 0 y 1
(solo entradas → 10 min); tope 45; línea `Moto N` respetada.

## Queda al implementador

Forma exacta de la consulta (count en Prisma vs. findMany + filtro por
`tiempoEstimado`), y cómo pasar la espera calculada a `salidasDeOrdenAceptada`.

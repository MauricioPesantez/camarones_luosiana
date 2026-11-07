# SRI Ecuador: XML de factura electrónica y firma XAdES-BES (estado a noviembre 2026)

Reading key. The named sources below are defined as link references at the end of this file. "Verified locally" means I ran the check myself on 2026-11-03 against the official files (xmllint against the official XSDs, a module-11 script, reading the extracted ficha text). "Open-source" marks facts inferred from third-party code, not from the SRI. The primary source is Ficha Técnica offline v2.34 (27/07/2026), the version the [SRI portal][sri-fe] lists as current.

## 1. Which factura XSD versions are valid, which to use, and where are they

### Takeaway
All four versions (1.0.0, 1.1.0, 2.0.0, 2.1.0) are still published and described in the ficha. Use **1.1.0**: it is the smallest version with 6 decimals in `cantidad` and `precioUnitario`. Move to 2.1.0 only if the restaurant ever needs rubros de terceros or factura sustitutiva de guía de remisión.

### Cited Findings
- The SRI portal lists "Esquemas XSD y XML Tipo de documento Factura – Versión 1.0.0 – 1.1.0 – 2.0.0 – 2.1.0", dated February 2022, as a [single ZIP download][xsd-zip] — [SRI portal][sri-fe].
- The ficha gives the same version split: Anexo 1 is v1.0.0; Anexo 3 is v1.1.0, which "incluyen el aumento de 2 a 6 decimales en los campos de cantidad y precio unitario" and adds retentions for fuel and newspaper resellers; Anexos 8 and 9 (rubros de terceros, sustitutiva de guía de remisión) apply to 2.0.0 and 2.1.0 — [Ficha 2.34, índice y Anexo 3][ficha].
- Ficha FAQ: "Pueden utilizar dos decimales en la versión 1.0.0 y seis decimales en la versión 1.1.0" — [Ficha 2.34, §16][ficha].
- Verified locally by diffing the official XSDs:
  - 1.0.0 → 1.1.0: `cantidad`, `precioUnitario` and `precioSinSubsidio` go from totalDigits 14/fractionDigits 2 to 18/6; adds the `<retenciones>` node.
  - 1.1.0 → 2.0.0: returns to 14/2 and drops `<retenciones>`; adds `infoSustitutivaGuiaRemision`, `otrosRubrosTerceros` and their types.
  - 2.0.0 → 2.1.0: 18/6 again and `<retenciones>` back. 2.1.0 is the superset.
  - Source: [official XSD ZIP][xsd-zip].
- The root element must be `<factura id="comprobante" version="…">`. `id` is a lowercase attribute restricted to the enumeration `comprobante`; `version` has no type restriction in the XSD — [XSD 2.1.0][xsd-zip].
- The XSDs import `xmldsig-core-schema.xsd`, which is not in the ZIP (the ZIP holds only 4 XSD and 4 XML files plus the folder). You need the W3C copy to validate locally — [official XSD ZIP][xsd-zip].
- Error 36 "Versión esquema descontinuada" and error 35 "Documento inválido" (fails schema) both fire at RECEPCIÓN — [Ficha 2.34, §11][ficha].
- The sample XML files in the ZIP are auto-generated placeholders (`version="version0"`, `razonSocial0`, `xmlns:ds` and `xsi:noNamespaceSchemaLocation` on the root). They are not realistic documents — [official XSD ZIP][xsd-zip].

### Inferences
- A POS needs 1.1.0 because menu prices include IVA. Deriving a net `precioUnitario` from a gross price needs more than 2 decimals.
- Do not copy the root namespaces from the official sample. They change the canonical form of the signed document, and the maintained Node signer rejects any `xmlns` on the input document (see section 8).

### Gaps
- No official statement says which versions the production server still accepts. All four are in the current ficha, and I found nothing that discontinues them.
- The XSD ZIP is dated February 2022 while the ficha has changed through July 2026. The schema on the SRI server may differ from the published one (a real conflict is shown in section 7).

## 2. Full XML structure (fields, formats, mandatory) and a complete sample

### Takeaway
Element order is enforced (`xsd:sequence`), so a serializer must follow the exact order below. The ficha is stricter than the XSD in several places, and the rule to follow is the ficha's.

### Cited Findings
**Conflicts between ficha and XSD.** `propina`, `pagos` and `codigoPrincipal` are "Obligatorio" in the [Ficha 2.34, Anexos 1 y 3][ficha] but `minOccurs="0"` in the [XSD][xsd-zip]. `tarifa` is mandatory in `detalle/impuesto` but optional in `totalImpuesto` — [XSD][xsd-zip].

**`infoTributaria`** (order as listed) — [XSD 2.1.0][xsd-zip] and [Ficha 2.34, Anexo 1][ficha]:

| Field | Required | Format |
|---|---|---|
| `ambiente` | Yes | `[1-2]` (1 pruebas, 2 producción) |
| `tipoEmision` | Yes | XSD `[12]`, but offline only `1` exists |
| `razonSocial` | Yes | 1–300, no newlines |
| `nombreComercial` | When applicable | 1–300 |
| `ruc` | Yes | `[0-9]{10}001` |
| `claveAcceso` | Yes | `[0-9]{49}` |
| `codDoc` | Yes | `[0-9]{2}`, `01` for factura |
| `estab` | Yes | `[0-9]{3}` |
| `ptoEmi` | Yes | `[0-9]{3}` |
| `secuencial` | Yes | `[0-9]{9}`, zero-padded |
| `dirMatriz` | Yes | 1–300 |
| `agenteRetencion` | When applicable | digits, max 8 |
| `contribuyenteRimpe` | When applicable | fixed text, see section 7 |

**`infoFactura`** (only fields relevant to a restaurant; the XSD also has export, reembolso and subsidy fields in between, all optional):

| Field | Required | Format |
|---|---|---|
| `fechaEmision` | Yes | `dd/mm/aaaa`, year `20xx` |
| `dirEstablecimiento` | When applicable | 1–300 |
| `contribuyenteEspecial` | When applicable | 3–13 alphanumeric |
| `obligadoContabilidad` | When applicable | `SI` or `NO` |
| `tipoIdentificacionComprador` | Yes | `0[4-8]` |
| `guiaRemision` | Optional | `000-000-000000000` |
| `razonSocialComprador` | Yes | 1–300 |
| `identificacionComprador` | Yes | 1–20, no check digit in XSD |
| `direccionComprador` | When applicable | 1–300 |
| `totalSinImpuestos` | Yes | decimal 14/2 |
| `totalDescuento` | Yes | decimal 14/2 |
| `totalConImpuestos/totalImpuesto` (1..n) | Yes | see below |
| `compensaciones` | Do not use | see section 3 |
| `propina` | Ficha: yes | decimal 14/2 |
| `importeTotal` | Yes | decimal 14/2 |
| `moneda` | When applicable | Ficha sample `DOLAR`, max 15 |
| `pagos/pago` (1..n) | Ficha: yes | see below |

Source: [XSD 2.1.0][xsd-zip], [Ficha 2.34, Anexo 1][ficha].

- **`totalImpuesto`** order: `codigo`, `codigoPorcentaje`, `descuentoAdicional`?, `baseImponible`, `tarifa`?, `valor`, `valorDevolucionIva`? — [XSD][xsd-zip].
- **`detalle/impuesto`** has a different order: `codigo`, `codigoPorcentaje`, `tarifa`, `baseImponible`, `valor`. A shared serializer for both breaks the schema — [XSD][xsd-zip].
- **`pago`**: `formaPago`, `total` (14/2), `plazo`? (14/2), `unidadTiempo`? (max 10, ficha sample `dias`). Plazo and unidad are "Obligatorio cuando corresponda" — [XSD][xsd-zip], [Ficha 2.34, Anexo 1][ficha].
- **`detalle`** order: `codigoPrincipal` (max 25), `codigoAuxiliar`? (max 25), `descripcion` (1–300), `unidadMedida`?, `cantidad` (18/6 in 1.1.0), `precioUnitario` (18/6), `precioSinSubsidio`?, `descuento` (required, 14/2), `precioTotalSinImpuesto` (14/2), `detallesAdicionales`? (up to 3 `detAdicional` with `nombre` and `valor` attributes), `impuestos` (1..n) — [XSD][xsd-zip].
- **Top-level order** after `detalles`: `reembolsos`?, `retenciones`?, `infoSustitutivaGuiaRemision`?, `otrosRubrosTerceros`?, `tipoNegociable`?, `maquinaFiscal`?, `infoAdicional`?, `ds:Signature`? — [XSD 2.1.0][xsd-zip].
- **`infoAdicional`**: up to 15 `campoAdicional`, value max 300, required `nombre` attribute max 300 — [XSD][xsd-zip], [Ficha 2.34, §9.11][ficha].
- Alphanumeric fields must not contain stray spaces or line breaks; this can reject the document or leave it unanswered — [Ficha 2.34, Anexo 1][ficha]. `&` must be sent as `&amp;` or the document is rejected as malformed — [Ficha 2.34, Glosario][ficha].
- **`claveAcceso`** (49 digits): fecha `ddmmaaaa`, tipo comprobante (2), RUC (13), ambiente (1), serie `estab+ptoEmi` (6), secuencial (9), código numérico (8), tipo emisión (1), dígito verificador módulo 11 with weights 2–7 from the right. A result of 11 becomes 0 and 10 becomes 1 — [Ficha 2.34, §5.2][ficha].
- If a key's components differ from the document, error 58 fires. A rejected document is resent with the same clave and secuencial — [Ficha 2.34, §5.10 y §11][ficha].
- Sample below: verified locally. It validates with `xmllint --schema` against the official 1.1.0 and 2.1.0 XSDs, and its `claveAcceso` check digit comes from a script that reproduces the ficha's published keys (2 of 3 sampled; the third, an Anexo 3 sample, does not pass, so treat ficha samples as illustrative). The RUC is a placeholder.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
<infoTributaria>
<ambiente>1</ambiente>
<tipoEmision>1</tipoEmision>
<razonSocial>PRUEBAS RESTAURANTE EJEMPLO CIA. LTDA.</razonSocial>
<nombreComercial>La Sazón de Ejemplo</nombreComercial>
<ruc>1790000000001</ruc>
<claveAcceso>0511202601179000000000110010020000001231234567810</claveAcceso>
<codDoc>01</codDoc>
<estab>001</estab>
<ptoEmi>002</ptoEmi>
<secuencial>000000123</secuencial>
<dirMatriz>Av. Amazonas N24-03 y Colón, Quito</dirMatriz>
<contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>
</infoTributaria>
<infoFactura>
<fechaEmision>05/11/2026</fechaEmision>
<dirEstablecimiento>Av. Amazonas N24-03 y Colón, Quito</dirEstablecimiento>
<obligadoContabilidad>NO</obligadoContabilidad>
<tipoIdentificacionComprador>07</tipoIdentificacionComprador>
<razonSocialComprador>CONSUMIDOR FINAL</razonSocialComprador>
<identificacionComprador>9999999999999</identificacionComprador>
<totalSinImpuestos>32.66</totalSinImpuestos>
<totalDescuento>1.74</totalDescuento>
<totalConImpuestos>
<totalImpuesto>
<codigo>2</codigo>
<codigoPorcentaje>4</codigoPorcentaje>
<baseImponible>20.66</baseImponible>
<tarifa>15.00</tarifa>
<valor>3.10</valor>
</totalImpuesto>
<totalImpuesto>
<codigo>2</codigo>
<codigoPorcentaje>0</codigoPorcentaje>
<baseImponible>12.00</baseImponible>
<tarifa>0.00</tarifa>
<valor>0.00</valor>
</totalImpuesto>
</totalConImpuestos>
<propina>2.07</propina>
<importeTotal>37.83</importeTotal>
<moneda>DOLAR</moneda>
<pagos>
<pago>
<formaPago>01</formaPago>
<total>20.00</total>
</pago>
<pago>
<formaPago>19</formaPago>
<total>17.83</total>
<plazo>0</plazo>
<unidadTiempo>dias</unidadTiempo>
</pago>
</pagos>
</infoFactura>
<detalles>
<detalle>
<codigoPrincipal>PLT-014</codigoPrincipal>
<descripcion>Seco de pollo</descripcion>
<cantidad>2.000000</cantidad>
<precioUnitario>8.700000</precioUnitario>
<descuento>1.74</descuento>
<precioTotalSinImpuesto>15.66</precioTotalSinImpuesto>
<impuestos>
<impuesto>
<codigo>2</codigo>
<codigoPorcentaje>4</codigoPorcentaje>
<tarifa>15.00</tarifa>
<baseImponible>15.66</baseImponible>
<valor>2.35</valor>
</impuesto>
</impuestos>
</detalle>
<detalle>
<codigoPrincipal>BEB-007</codigoPrincipal>
<descripcion>Jugo de naranjilla</descripcion>
<cantidad>2.000000</cantidad>
<precioUnitario>2.500000</precioUnitario>
<descuento>0.00</descuento>
<precioTotalSinImpuesto>5.00</precioTotalSinImpuesto>
<impuestos>
<impuesto>
<codigo>2</codigo>
<codigoPorcentaje>4</codigoPorcentaje>
<tarifa>15.00</tarifa>
<baseImponible>5.00</baseImponible>
<valor>0.75</valor>
</impuesto>
</impuestos>
</detalle>
<detalle>
<codigoPrincipal>LIB-001</codigoPrincipal>
<descripcion>Libro de recetas de la casa</descripcion>
<cantidad>1.000000</cantidad>
<precioUnitario>12.000000</precioUnitario>
<descuento>0.00</descuento>
<precioTotalSinImpuesto>12.00</precioTotalSinImpuesto>
<impuestos>
<impuesto>
<codigo>2</codigo>
<codigoPorcentaje>0</codigoPorcentaje>
<tarifa>0.00</tarifa>
<baseImponible>12.00</baseImponible>
<valor>0.00</valor>
</impuesto>
</impuestos>
</detalle>
</detalles>
<infoAdicional>
<campoAdicional nombre="Mesa">12</campoAdicional>
<campoAdicional nombre="Email">cliente@example.com</campoAdicional>
<campoAdicional nombre="RUC Proveedor">1790000000001</campoAdicional>
</infoAdicional>
</factura>
```

### Inferences
- The sample is schema-valid and arithmetically consistent, but it has **not** been submitted to the SRI. The 0% line, the RIMPE leyenda and the propina are there to show the fields. A real document includes only what applies.
- Treat every "cuando corresponda" field as something to emit when the emisor has the attribute. Send `obligadoContabilidad` always, since it is the safest reading of the [ficha][ficha].
- `fechaEmision` must be computed in `America/Guayaquil`. A server on UTC produces the next day from 19:00 local time.

### Gaps
- Transmission timing, covered by the SOAP research: the 2023 [SRI FAQ][sri-faq] allows up to 72 hours, while [press][mercurio-inmediata] reports immediate transmission from 1 January 2026 under the resolution of 30 June 2025. I did not read that resolution, and the article does not address contingency handling.

## 3. Catalog tables

### Takeaway
All the codes in the brief are confirmed against Ficha 2.34. The one correction is that 8% is the live value of "IVA diferenciado" (code 8), it is date-dependent, and it applies today: the most recent decree runs through 3 November 2026.

### Cited Findings
**tipoIdentificacionComprador** — [Ficha 2.34, Tabla 6][ficha]:

| Code | Meaning |
|---|---|
| 04 | RUC |
| 05 | Cédula |
| 06 | Pasaporte |
| 07 | Venta a consumidor final (identification is 13 nines: `9999999999999`) |
| 08 | Identificación del exterior (ID from the tax authority of the buyer's country of residence) |

- Consumidor final is not allowed on notas de crédito, notas de débito, retenciones or liquidaciones de compra — [Ficha 2.34, Tabla 6][ficha].
- `razonSocialComprador` for 07 is "CONSUMIDOR FINAL" in the ficha's samples — [Ficha 2.34, Anexo 8][ficha].
- Limit: above USD 50 the buyer's data is mandatory — [Ficha 2.34, §9.10][ficha]. Consumidor final applies to amounts "hasta USD. 50.00" — [SRI FAQ][sri-faq]. The limit came from [Decreto 586 of 2022][bloomberg]. Press is loose at exactly 50 ([Expreso][expreso] says "desde USD 50"); follow the SRI wording. Siigo reports USD 200 for RIMPE Negocio Popular, [unverified][siigo-cf].

**Impuesto codes** — [Ficha 2.34, Tabla 16][ficha]: IVA `2`, ICE `3`, IRBPNR `5`. The XSD pattern is `[235]` — [XSD][xsd-zip].

**codigoPorcentaje IVA** — [Ficha 2.34, Tabla 17][ficha]:

| Rate | Code | Status (Nov 2026) |
|---|---|---|
| 0% | 0 | Current |
| 12% | 2 | Historical |
| 14% | 3 | Historical |
| 15% | 4 | General rate |
| 5% | 5 | Current, reduced (construction materials, see below) |
| No objeto de impuesto | 6 | Current |
| Exento de IVA | 7 | Current |
| IVA diferenciado | 8 | 8% for tourism, on decreed days only |
| 13% | 10 | Listed; not the general rate |

- Code 8: the President may decree a differentiated 8% rate for tourism for up to 12 days a year — [Ficha 2.34, nota 3][ficha].
- 2026 decrees: [Carnaval, Decreto 304][lexis-304] (14–17 Feb), [Semana Santa, Decreto 348][lexis-ss], and [November, reportedly Decreto 526][mercurio-iva8] (31 Oct–3 Nov 2026).
- Restaurants qualify only when registered as tourism establishments; press reports require the tourism registry and LUAF, and the benefit is not automatic — [El Mercurio][mercurio-iva8], [Lexis][lexis-ss].
- General rate 15% for 2026: secondary sources only ([FirmaOK][firmaok-iva], and an ADR citing [Circular NAC-DGECCGC25-00000006][iaerp-adr]).
- 5% applies to construction materials — [Ficha 2.34, Anexo 23][ficha], [ADR][iaerp-adr].

**formaPago** — [Ficha 2.34, Tabla 24][ficha]:

| Code | Meaning |
|---|---|
| 01 | Sin utilización del sistema financiero |
| 15 | Compensación de deudas |
| 16 | Tarjeta de débito |
| 17 | Dinero electrónico |
| 18 | Tarjeta prepago |
| 19 | Tarjeta de crédito |
| 20 | Otros con utilización del sistema financiero |
| 21 | Endoso de títulos |

**Tipo comprobante (`codDoc`)** — [Ficha 2.34, Tabla 3][ficha]: 01 Factura, 03 Liquidación de compra, 04 Nota de crédito, 05 Nota de débito, 06 Guía de remisión, 07 Comprobante de retención.

**ambiente** — [Ficha 2.34, Tabla 4][ficha]: 1 Pruebas, 2 Producción.

**tipoEmision** — [Ficha 2.34, Tabla 2][ficha]: 1 Normal; the offline method has only this type. Contingency keys were removed in ficha 2.0 (2015) — [Ficha 2.34, historial][ficha].

**Compensaciones.** The `compensaciones` node is still in the XSD (`codigo` fixed to `1`) but the ficha has no catalog for it. The solidarity discount tables were eliminated in ficha 2.09 (2017), and the term no longer appears as a field in the factura format — [Ficha 2.34, historial][ficha], [XSD][xsd-zip].

**Plastic bags.** For chains with 3+ establishments or franchises delivering carrier bags, a detail line with code `ICE-FPN-01`, `ICE-FPR-02` or `ICE-FPE-03`, price 0.00, carries ICE, and the ICE enters the IVA base — [Ficha 2.34, Anexo 18][ficha].

### Inferences
- The tax rate table must be effective-dated. The rate depends on the emission date, not the product, and code 8 needs an on/off window per establishment tied to its tourism registration.
- `tarifa` for each code should be the numeric rate (`15.00`, `8.00`, `5.00`, `13.00`, `0.00`). The ficha shows `tarifa` values for 12% and 0.02 but no sample for code 8.
- Omit `compensaciones`. It is a dead node for a restaurant.

### Gaps
- I did not read the text of the 2026 decrees; the dates come from press.

## 4. Calculation and rounding rules

### Takeaway
The SRI publishes **no tolerance and no rounding algorithm**; error 52 is only "error en los cálculos". Design for exactness: every total derived from one rule, values in decimal arithmetic, and the first batch validated in ambiente de pruebas.

### Cited Findings
- Decimals: value fields use `123456.98` format with a dot and at most 2 decimals; only `precioUnitario` and `cantidad` allow up to 6, in version 1.1.0 — [Ficha 2.34, §9.17][ficha]. The XSD enforces this with fractionDigits — [XSD][xsd-zip].
- Error 52 "Error en diferencias: cuando existe error en los cálculos del comprobante", raised at AUTORIZACIÓN. The ficha also says emitters must implement this validation themselves (phase EMISOR) — [Ficha 2.34, §11][ficha].
- The SRI validates in a fixed order and stops at the first failure: XML, emisor, uniqueness, signature, additional checks, and "Validación diferencias" last. So calculation errors surface only after everything else passes — [Ficha 2.34, §11][ficha].
- Subtotals by rate sum the line totals of each rate; Subtotal sums the bases — [Ficha 2.34, Tabla 21][ficha].
- "Valor IVA %" is computed on the subtotal plus ICE: "Sumará el campo Subtotal IVA _% y el valor del campo Valor ICE, el resultado aplicará la tarifa". That is a group-level computation, not a sum of line taxes — [Ficha 2.34, Tabla 21][ficha].
- "VALOR TOTAL: sumará los campos Subtotal, ICE, IRBPNR, Valor IVA _% y Propina" — [Ficha 2.34, Tabla 21][ficha].
- ICE forms part of the IVA base — [Ficha 2.34, Anexo 18][ficha].
- Discounts: the base excludes "descuentos y bonificaciones normales concedidos a los compradores" — [LRTI Art. 58, SRI document][sri-base].
- `descuento` per line is mandatory. `descuentoAdicional` in `totalImpuesto` is "Opcional, aplica para código impuesto 2" — [Ficha 2.34, Anexo 1][ficha].
- In the official example, `descuentoAdicional` of 5.00 leaves `baseImponible` at 309750.00 but computes `valor` as 37169.40, i.e. (309750.00 − 5.00) × 12%, while the same tax in the `detalle` shows 37170.00. `totalDescuento` is 5005.00 (5000 line + 5 additional) and `totalSinImpuestos` stays 295000.00 — [Ficha 2.34, Anexo 1][ficha].
- That same ficha example is not a usable arithmetic reference: it shows `cantidad` 10, `precioUnitario` 300000, `descuento` 5000 and `precioTotalSinImpuesto` 295000, which only works if quantity is 1 — [Ficha 2.34, Anexo 1][ficha].
- Third-party guides list causes of error 52: lines not summing to totals, tax misapplied to the base, discounts inconsistent between lines and totals, rounding inconsistent across related fields, catalog rates wrong — [Deley][deley-52]. Quipuy attributes mismatches to rounding but calls them error 35, which contradicts the ficha (35 is schema only) — [Quipuy][quipuy-35].
- Two independent open-source projects report the same finding: no source cites a tolerance. One sets ROUND_HALF_UP as internal policy ([iaerp ADR 0008][iaerp-adr]) and the other keeps tolerance at 0 pending evidence ([AppSalon PR 24][appsalon-pr]).

### Inferences
- `precioTotalSinImpuesto = round2(cantidad × precioUnitario − descuento)`. This is the only coherent reading; the ficha never states it as a formula.
- Recommended algorithm:
  1. Compute in decimal, never binary float.
  2. Line: `precioTotalSinImpuesto`, as above.
  3. Group by (codigo, codigoPorcentaje): `baseImponible` = sum of the line totals.
  4. Group `valor` = round2(base × tarifa), half-up, matching the group-level rule in Tabla 21.
  5. Line `valor`: round2(line base × tarifa), then distribute any group difference across lines in cents so that the sum of line values equals the group `valor`. This keeps both readings true at once and removes reliance on any tolerance.
  6. `importeTotal` = sum of bases + sum of group `valor` + `propina`.
  7. Pagos must sum to `importeTotal`.
- Gross menu prices: back-calculate with `precioUnitario` at 6 decimals. If 6 decimals do not reconverge to the menu price, the rounding difference must be absorbed, ideally on the group as above.
- Whole-bill discounts: prorate into each line's `descuento` and do not use `descuentoAdicional`. It creates a base/value mismatch that a POS has no reason to take on, and prorating is the simplest route to consistent numbers.
- Common causes to test: line-level tax rounded and summed vs group tax; floats; `totalDescuento` not matching line discounts; discount applied after tax; `baseImponible` computed from gross; pagos not equal to total; propina left out of `importeTotal`.
- Since the validator is undocumented, run a test set in ambiente de pruebas: many lines with fractional cents, line discounts, whole-bill discounts, mixed rates, and propina.

### Gaps
- Whether the SRI compares the group `valor` to base × rate, to the sum of line values, or to both, and with what tolerance. No official source states this.
- Rounding mode (half-up vs half-even) is not published; half-up is an assumption.

## 5. How propina works, and mixed tax rates

### Takeaway
`propina` is a dedicated field in `infoFactura`, outside `totalConImpuestos`. It adds to `importeTotal` and is not an item line. It carries no IVA, but only the legal 10% of *qualified* hotels and restaurants is excluded from the base, which is a real eligibility question.

### Cited Findings
- "La propina legal, esto es el 10% del valor de servicios de hoteles y restaurantes calificados, no será parte de la base imponible" — [RLRTI Art. 145, SRI document][sri-base]. That document still refers to the 12% rate, so it predates the current law.
- Same article: if a service taxed at the general rate supplies goods also taxed at that rate, the goods' value forms part of the base of the service even if invoiced separately. If the service is 0%, taxed goods are invoiced with their tax broken out — [RLRTI Art. 145, SRI document][sri-base].
- `propina` sits in `infoFactura` after `compensaciones` and before `importeTotal`, decimal 14/2 — [XSD][xsd-zip]. The ficha marks it mandatory and shows `0.00` when none applies — [Ficha 2.34, Anexo 1][ficha].
- SRI's own tool validates that propina does not exceed 10% of the Subtotal field, and includes it in the total — [Ficha 2.34, Tabla 21][ficha].
- Legal basis as reported: since 1971, first- and second-category hotels, bars and restaurants (equated to 5 and 4 stars) add 10% on consumption, regulated by a 2007 Acuerdo Interministerial. The receipt must carry the leyenda "Incluye el 10% de servicios – propina – TIP" — [derechodeltrabajo.ec][derecho-propina].
- Mixed rates: `totalConImpuestos` is a list with one `totalImpuesto` per tax and rate, and each `detalle` has its own `impuestos` list, also with `maxOccurs="unbounded"` — [XSD][xsd-zip]. The official example has ICE, IVA and IRBPNR on a single line — [Ficha 2.34, Anexo 1][ficha].

### Inferences
- XML mapping: `propina` = amount; `importeTotal` includes it; no `impuesto` element relates to it.
- Base of the 10%: "consumo" reads as the pre-tax amount of the service. That is not an official formula, and the SRI tool's cap (10% of Subtotal) is only a ceiling. The sample uses 10% of the service lines.
- A restaurant outside the qualified category that adds a mandatory 10% is on unclear ground: the Art. 145 exclusion says "calificados". If that charge counted as part of the service, it could belong in the IVA base. This needs an accountant's answer, and the POS should make the charge a per-establishment setting.
- A voluntary tip paid by card has no clear treatment in the sources.
- For a restaurant, one rate per order is the norm: the meal is a service at the general rate, and per Art. 145 goods taxed at that rate go along with it. Mixed rates arise with goods sold apart, such as a 0% retail item. The design should still allow per-line rates; it costs nothing, and code 8 windows need it.
- Delivery fees: per Art. 145 logic an envío could be a separate taxed service. I did not research this, and it should be confirmed.

### Gaps
- Current numbering and wording of the Art. 145 rule in the regulation as amended. The SRI document is old.
- Which registry now defines "calificados" and the first/second category. I could not read the decree or the 2007 acuerdo: the [Quito Turismo][quito-decreto] PDF returned 404 and the Ministry of Tourism host did not resolve.
- Whether SRI's production validator enforces the 10% cap. The ficha describes it only for the free tool.

## 6. Identification validation (cédula/RUC check digit)

### Takeaway
Yes, the SRI checks buyer identification, but the ficha lists a failure as a **warning, not a rejection**. Validate in the POS anyway.

### Cited Findings
- Warning 59 "Identificación no existe"; warning 62 "Identificación incorrecta: … cédulas no pasan el dígito verificador" — [Ficha 2.34, §11][ficha].
- Error 69 "Identificación del receptor: cuando la identificación asociada al adquirente no existe. En general cuando el RUC del adquirente no existe…", in the list of validations emitters must implement themselves (phase EMISOR) — [Ficha 2.34, §11][ficha].
- Ficha FAQ: "RUC no existe. El RUC ingresado en la identificación del receptor no consta en la base de RUC" — [Ficha 2.34, §16][ficha]. Note the error table defines code 46 "RUC no existe" for the *emisor*.
- "Identificación del receptor del comprobante" is part of validation step 5 — [Ficha 2.34, §11][ficha].
- The XSD does no check at all: `identificacionComprador` is a free string of 1–20 characters — [XSD][xsd-zip].
- Pruebas: Razón social "PRUEBAS SERVICIO DE RENTAS INTERNAS" may be used — [Ficha 2.34, §5.6][ficha].
- Check digit algorithm, from third parties: cédula and natural-person RUC use module 10 with weights 2,1,2,1…; subtract 9 from products ≥ 10; complement to the next multiple of 10 — [hacecuentas][hace-cedula]. Sources conflict on third-digit rules for entities (9 for private and 6 for public per [LookupTax][lookup-ruc]).
- A valid check digit proves only that the number is well formed, not that it exists — [hacecuentas][hace-cedula].
- The SRI publishes a RUC catastro — [Ficha 2.34, §11][ficha].

### Inferences
- POS rule: for 05 and 04 run the local check digit before sending; for 06 and 08 only length and format. Warn the cashier and let them correct; do not block a sale on a passport.
- A warning leaves the document authorized, so the factura is legally issued with bad data. Local validation is the only protection, and the buyer may lose the deduction.

### Gaps
- Whether error 69 ever produces NAT at SRI for buyers. The ficha places it in the emitter's list, not the server table.
- No official algorithm for RUC check digits. All algorithm sources are third-party.

## 7. Leyendas and fields mandatory in 2026

### Takeaway
RIMPE, agente de retención and contribuyente especial are conditional on the emisor. **New in 2026:** Anexo 26 requires the provider's RUC in `infoAdicional`, and the provider registration rule may directly affect this project if the POS is sold to third parties.

### Cited Findings
- **`contribuyenteRimpe`**: inside `infoTributaria`, after `agenteRetencion`. Exact values: `CONTRIBUYENTE RÉGIMEN RIMPE` (27 chars) or `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` (45 chars) — [Ficha 2.34, Anexo 22][ficha].
- **Conflict verified locally**: the published XSD pattern accepts only the first value. The Negocio Popular text fails `xmllint` against the official 1.1.0 XSD — [XSD][xsd-zip]. The ficha requirement dates from v2.22 (09/2022), after the ZIP (02/2022).
- **`agenteRetencion`**: inside `infoTributaria`, numeric, max 8, the resolution number without leading zeros. The ficha still says it goes after `<regimenMicroempresas>`, a tag no longer in the XSD — [Ficha 2.34, Anexo 21][ficha], [XSD][xsd-zip].
- **`obligadoContabilidad`**: `SI` or `NO` in `infoFactura`; "Obligatorio cuando corresponda" — [Ficha 2.34, Anexo 1][ficha]. XSD `minOccurs=0` — [XSD][xsd-zip].
- **`contribuyenteEspecial`**: resolution number, alphanumeric 3–13, "Obligatorio cuando corresponda" — [Ficha 2.34, Anexo 1][ficha]. Tabla 11 says numeric 3–5 for the free tool — [Ficha 2.34, §9.5][ficha].
- **Gran Contribuyente**: leyenda and resolution number go in `infoAdicional` — [Ficha 2.34, Anexo 24][ficha].
- **RUC Proveedor (v2.34, 27/07/2026)**: issuers using third-party e-invoicing systems "deberán incluir como requisito de llenado obligatorio" the provider's RUC in `infoAdicional`: `nombre` attribute `RUC Proveedor`, value the RUC, alphanumeric max 300 — [Ficha 2.34, Anexo 26][ficha].
- The ficha writes the tag as `<CampoAdicional>`, but the XSD element is `campoAdicional` (lowercase) — [XSD][xsd-zip].
- Basis: Resolución NAC-DGERCGC26-00000027, signed 27 July 2026, RO 5.º Suplemento 335 of 28 July 2026. Art. 5 is the issuer duty; 60 calendar days give about 26 September 2026 — [Lexis][lexis-prov]. Some sources read business days — [Nerux][nerux].
- Art. 2–3: developers or license holders of e-invoicing systems **for commercial purposes** must register an exclusive establishment in the RUC (CIIU J62021002 own development, J62021003 third-party) within 30 days, about 27 August 2026. The SRI publishes the provider list monthly from October 2026 — [Lexis][lexis-prov], [Coronel y Pérez][coronel].
- Systems "exclusivamente para uso interno de su propia empresa" are outside the rule, according to a law firm, not the resolution text — [Coronel y Pérez][coronel].
- RIMPE categories were recategorized from 1 July 2026 — [Primicias][primicias-rimpe] (from a search result). The leyenda still reads as in the ficha per a [2026 guide][siigo-rimpe].

### Inferences
- **Action for this project:** if the POS is sold or licensed to other businesses, the developer is likely a covered provider, the 30-day window has passed, and every customer's factura needs the developer's RUC. If it is used only by its owner's restaurant, the rule seems not to apply. This depends on facts I do not have, so it deserves a legal check before go-live.
- Make leyendas per-emisor configuration. A Negocio Popular RUC is the case to test first in pruebas because of the XSD conflict.
- `RUC Proveedor` takes one of the 15 `campoAdicional` slots.

### Gaps
- Whether the SRI server rejects a Negocio Popular leyenda or a missing `RUC Proveedor`. [Nerux][nerux] does not say, and I found nothing official.
- I did not read the full text of the resolution.

## 8. Digital signature: XAdES-BES details

### Takeaway
XAdES-BES 1.3.2, enveloped, inside the `factura` root, RSA-SHA1 with SHA-1 digests and inclusive C14N 1.0. Three references: document, SignedProperties and KeyInfo. Do not hand-roll it: use `ec-sri-invoice-signer` (maintained, TypeScript), and treat SHA-256 as not officially supported.

### Cited Findings
**Official parameters** — [Ficha 2.34, §6 y Anexo 14][ficha]:

| Item | Value |
|---|---|
| Standard | XAdES_BES, schema 1.3.2, `http://uri.etsi.org/01903/v1.3.2#` |
| Type | ENVELOPED, `http://www.w3.org/2000/09/xmldsig#enveloped-signature` |
| Encoding | UTF-8 |
| Signature algorithm | RSA-SHA1, `http://www.w3.org/2000/09/xmldsig#rsa-sha1` |
| Digest | `http://www.w3.org/2000/09/xmldsig#sha1` |
| Canonicalization | `http://www.w3.org/TR/2001/REC-xml-c14n-20010315` (inclusive, no comments) |
| Key length | 2048 bits |
| Key file | PKCS12 `.p12` |
| SRI's validator library | MITyCLibXADES plus TSA, API, OCSP, Trust |

- The signature protects three parts: all nodes of the comprobante, the `SignedProperties`, and the certificate in `KeyInfo`. `ds:KeyInfo` must contain at least the signing certificate in base64, and it must itself be signed to prevent substitution — [Ficha 2.34, §6.4–6.5][ficha].
- Position: a child of `factura`, last element, per the XSD order — [XSD][xsd-zip]; "un nodo más a añadir en el documento" — [Ficha 2.34, §6.4][ficha].

**Structure** — [Ficha 2.34, Anexo 14][ficha]. The ficha sample prints the three references in the order below; the IDs are random numbers:

```xml
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Id="Signature620397">
 <ds:SignedInfo Id="Signature-SignedInfo814463">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
  <ds:Reference Id="SignedPropertiesID157683" Type="http://uri.etsi.org/01903#SignedProperties" URI="#Signature620397-SignedProperties24123">
   <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
   <ds:DigestValue>...</ds:DigestValue>
  </ds:Reference>
  <ds:Reference URI="#Certificate1562780">
   <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
   <ds:DigestValue>...</ds:DigestValue>
  </ds:Reference>
  <ds:Reference Id="Reference-ID-363558" URI="#comprobante">
   <ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>
   <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
   <ds:DigestValue>...</ds:DigestValue>
  </ds:Reference>
 </ds:SignedInfo>
 <ds:SignatureValue Id="SignatureValue398963">...</ds:SignatureValue>
 <ds:KeyInfo Id="Certificate1562780">
  <ds:X509Data><ds:X509Certificate>...</ds:X509Certificate></ds:X509Data>
  <ds:KeyValue><ds:RSAKeyValue><ds:Modulus>...</ds:Modulus><ds:Exponent>AQAB</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>
 </ds:KeyInfo>
 <ds:Object Id="Signature620397-Object231987">
  <etsi:QualifyingProperties Target="#Signature620397">
   <etsi:SignedProperties Id="Signature620397-SignedProperties24123">
    <etsi:SignedSignatureProperties>
     <etsi:SigningTime>2012-03-05T16:57:32-05:00</etsi:SigningTime>
     <etsi:SigningCertificate><etsi:Cert>
      <etsi:CertDigest><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>...</ds:DigestValue></etsi:CertDigest>
      <etsi:IssuerSerial><ds:X509IssuerName>CN=AC BANCO CENTRAL DEL ECUADOR,L=QUITO,OU=ENTIDAD DE CERTIFICACION DE INFORMACION-ECIBCE,O=BANCO CENTRAL DEL ECUADOR,C=EC</ds:X509IssuerName><ds:X509SerialNumber>1312833444</ds:X509SerialNumber></etsi:IssuerSerial>
     </etsi:Cert></etsi:SigningCertificate>
    </etsi:SignedSignatureProperties>
    <etsi:SignedDataObjectProperties>
     <etsi:DataObjectFormat ObjectReference="#Reference-ID-363558">
      <etsi:Description>contenido comprobante</etsi:Description>
      <etsi:MimeType>text/xml</etsi:MimeType>
     </etsi:DataObjectFormat>
    </etsi:SignedDataObjectProperties>
   </etsi:SignedProperties>
  </etsi:QualifyingProperties>
 </ds:Object>
</ds:Signature>
```

**What each digest covers (Open-source).** The ficha's comments name the targets but give no recipe; this procedure comes from code. All digests are base64 of SHA-1:

| Digest | Input | Evidence |
|---|---|---|
| Document | C14N of `factura`, no XML declaration, before inserting the signature | [ec-sri-invoice-signer][signer], [xades-bes-sri-ec][py-xades] |
| SignedProperties | C14N of the element, **with in-scope namespaces added** to its start tag | Same |
| KeyInfo | C14N of the element, same treatment | Same |
| SignedInfo signature | RSA-SHA1 over C14N of `SignedInfo`, same treatment | Same |
| CertDigest | SHA-1 over the certificate **DER** bytes, not the PEM text | Same |

- The Python port is explicitly built to match the official signer: its README credits changes "despues decompilar el JAR del firmador oficial del SRI" — [xades-bes-sri-ec][py-xades].

**Tested degrees of freedom (Open-source).** The maintained signer ships an SRI live-test harness for facturas, notas de crédito and débito, guías and retenciones, and differs from the ficha sample in all of the following — [ec-sri-invoice-signer][signer]:
- Reference order: document, SignedProperties, KeyInfo.
- Prefix `xades` instead of `etsi`, with `xmlns:xades` declared on `QualifyingProperties`, not on `ds:Signature`.
- UUID-based IDs.
- `Description` "Firma digital" plus an extra `xades:Encoding`.
- **No base64 line wrapping** in `X509Certificate`, `Modulus` or `SignatureValue`.

The Python port wraps at 76 chars and omits the `Id` on `SignatureValue` — [xades-bes-sri-ec][py-xades].

**Other quirks.**
- **X509SerialNumber** must be a full decimal integer. `open-factura` uses `parseInt(serial, 16)`, which loses precision for large serials; the maintained signer uses BigInteger — [open-factura signing.ts][openfactura], [signer][signer].
- **X509IssuerName**: the validator runs `new X500Principal(issuerName)` and fails on unknown keywords; the signer rewrites `E=` to `EMAILADDRESS=` for that reason and uses comma-joined reversed attributes (country last, as in the SRI sample) — [signer][signer], [MITyC mirror][mityc].
- **Multi-key `.p12`**: Banco Central files have several key bags; pick the one named "Signing Key". Issue #46 reported "firma inválida" with BCE files until fixed in 1.2.0 — [signer][signer]. The Python port selects the certificate with `digital_signature` KeyUsage among unexpired ones — [xades-bes-sri-ec][py-xades].
- **OpenSSL 3**: Ecuadorian `.p12` files often use 3DES or RC2, and PHP/OpenSSL 3 needs the legacy provider — [lenincrdva/xades-bes-signer][leni-php]. The Node signer uses pure-JS `node-forge`, so no OpenSSL config applies — [signer][signer].
- **Malformed `RSAKeyValue` passes recepción and fails autorización**: issue #118 showed an exponent like `ZVM=` instead of `AQAB`, fixed in PR #119 — [signer issue][signer-118]. The ficha puts 39 "Firma inválida" and 40 "Error en el certificado" at AUTORIZACIÓN, so a broken signature is first answered RECIBIDA and later NAT — [Ficha 2.34, §11][ficha].
- **Signature timing**: a signing time later than server time gives "La fecha contenida en la firma es posterior a la actual". The SRI syncs to `south-america.pool.ntp.org`; the cure is to resend — [Ficha 2.34, §16][ficha].
- **Debugging**: "Firma inválida – la firma no corresponde con el contenido" is usually strange characters in text fields; the ficha recommends XolidoSign for checking — [Ficha 2.34, §16][ficha].
- **Certificate validation**: step 4 checks "Validez firma y cadena de confianza OCSP" — [Ficha 2.34, §11][ficha].
- **Library status**: `ec-sri-invoice-signer` v1.8.2 (Sept 2026), MIT, 46 stars, pushed 2026-11-01, supports factura, NC, ND, retención, guía and liquidación — [GitHub][signer], [npm metadata][signer-npm].
- **The signer's input limits**: no `xmlns`, no DOCTYPE, no `xml:` attributes, UTF-8 — [signer README][signer].
- **SHA-256**: the ficha says RSA-SHA1 only — [Ficha 2.34, §6.8][ficha]. `lenincrdva` defaults to SHA-1 "tal como exige el SRI" and offers SHA-256 as an option — [Packagist][leni-php]. Some repositories (`firmaec.js`, `sri-signing-worker`) sign RSA-SHA256, but I found no evidence that the SRI authorizes those — [firmaec.js][firmaecjs].

**Bugs seen by reading `open-factura` main (not executed)**, all in [signing.ts][openfactura]:
- Typo in the transform URI (`xmlndsig`).
- `.replace("<ets:SignedProperties", …)` never matches, so namespaces are not added to the SignedProperties digest.
- `ObjectReference="#Reference-ID=…"` does not match the reference `Id`.
- The signature is split into lines before `btoa`, which corrupts it.
- It does no real C14N.
- It handles only Banco Central and Security Data friendly names.

Its [last npm release is 2023][openfactura-npm]. The `open-factura-ec` npm package has a placeholder repository URL (`tuusuario`).

### Inferences
- **Recommended path:** use `ec-sri-invoice-signer` server-side; do not implement XAdES in the POS. Add a first-run test with a real `.p12` from each issuer the customers use.
- **76-char wrapping is not required** by the SRI. The signer emits none, and XML Schema `base64Binary` permits whitespace. What matters is that the bytes hashed equal the bytes emitted, because `KeyInfo` is inside a digest.
- **Never reformat after signing.** No pretty-print, no re-serialize through a DOM, no CRLF conversion. Keep the signed XML as an opaque string and store it unchanged.
- **The reference order, prefix and ID format are not validated** beyond normal XMLDSig resolution. This follows from the signer's divergences, assuming its live tests pass today; I did not run them.
- **Namespace trap:** inclusive C14N inherits in-scope namespaces, so the digests depend on exactly where `xmlns` declarations sit. If `xmlns:ds` is on the root, every digest changes.
- **Issuer name with commas** (for example `S.A.` entities) would need RFC 2253 escaping for `X500Principal`. The signer does not escape, so test this with the actual issuer.
- **Signer risk:** it takes the first cert bag (`certBags[...]?.[0]`). If a `.p12` lists a CA certificate first, the wrong certificate is embedded. A safe check is that the certificate's public key matches the private key.
- **README mismatch:** the signer's README writes `Id="comprobante"` but the XSD demands lowercase `id`; use lowercase.
- SHA-1 is deliberately weak by today's standards, but here it is a compliance constraint. The system should isolate the algorithm in one module so a future ficha change is cheap.
- SigningTime: use `-05:00` local time with the server clock under NTP. The Python port stamps local time with `Z`, which is wrong on a non-UTC host.

### Gaps
- No public SRI statement on SHA-256 acceptance, and no evidence of an end-date for SHA-1.
- The `SignatureMethod` tolerance is unverified: nothing here was sent to the SRI.
- Whether MITyC compares issuer name strictly. I confirmed it parses with `X500Principal`, but not the comparison logic in the [mirror][mityc], which may also differ from SRI's deployed build.

## 9. Certificate: format, entities, types, prices, expiry, ownership

### Takeaway
A `.p12` file with the **emisor's RUC in the certificate**, from an issuer whose chain is registered at the SRI; a USB token cannot run on a server. Expect USD 20–36 per year or two. The same `.p12` used for the Facturador SRI is technically reusable.

### Cited Findings
**Format and validity.**
- `.p12`/PKCS12, 2048-bit key — [Ficha 2.34, §6.8][ficha].
- "Para facturación electrónica el contenedor compatible es Archivo PKCS#12" — [ICERT-EC, gob.ec][cj-pn]. Token keys cannot be copied — [TuFirma][tufirma]. The ficha also allows token access through APIs — [Ficha 2.34, §6.8][ficha], and Anexo 15 has a token compatibility table.
- Validity is defined by each issuer — [SRI FAQ][sri-faq].

**Entities.**
- The ARCOTEL list shows 17 accredited entities: Alpha Technologies, ANFAC, Appfirmas, ArgosData, Banco Central, Consejo de la Judicatura, Corpnewbest, Darkcam, Datilmedia, Registro Civil, Eclipsoft, Firmasegura, Lazzate, Letmi, Primecorelat, Security Data, Uanataca. Its status columns mix Aprobado, Observaciones and No entrega; the latest linked files are from 2025 — [ARCOTEL][arcotel]. firmar.ec counts 18, adding WE-GO — [firmar.ec][firmar-ec].
- **Accredited does not mean accepted by the SRI.** The SRI FAQ lists those "que han registrado en el SRI sus certificados": ANFAC, ArgosData, Banco Central, Consejo de la Judicatura, Datilmedia, Eclipsoft, Security Data, Uanataca — [SRI FAQ (June 2023)][sri-faq].
- New accreditation rules: Resolución ARCOTEL-2024-0176 and a technical norm, per a search snippet of the [FirmaEC changelog][firmaec-log] (the page timed out when fetched).

**Prices** (reference only; most are not official):

| Issuer / seller | Type | Validity | USD | Source |
|---|---|---|---|---|
| Registro Civil | Archivo or token | 2 years | 31.05 incl. IVA; renewal 20.70; token device 25.30 extra | [gob.ec, 2025/01/14][rc] |
| Consejo de la Judicatura | `.p12` | 2 years | 27.60 incl. IVA | [firmar.ec][firmar-ec], citing the official tariff, checked 16 Sep 2026 |
| Banco Central | `.p12` | 2 years | ~28 + IVA | [firmar.ec][firmar-ec]; [gob.ec][bce] gives no amount |
| Uanataca via TuFirma | `.p12` natural | 1 / 2 / 5 years | 19.13 / 29.13 / 60.00 + IVA | [TuFirma][tufirma] |
| Uanataca via TuFirma | `.p12` jurídica | 1 / 2 / 5 years | 21.74 / 31.30 / 61.74 + IVA | [TuFirma][tufirma] |
| Uanataca via TuFirma | Token | 1 / 2 years | 37 / 45 + IVA | [TuFirma][tufirma] |
| Uanataca via firmar.ec | `.p12` | 1 / 2 years | 23.60 / 35.90 incl. IVA | [firmar.ec pricing][firmar-p], reseller |
| EasyKey | `.p12` | 1 / 2 years | 19.90 / 31.60 + IVA | [EasyKey][easykey], reseller |
| Security Data | n/d | 1 / 2 years | 35 / 50 | [Quipuy][quipuy-p], not official |
| ANF | n/d | 1 / 2 years | 40 / 55 | [Quipuy][quipuy-p], not official |

Short validities of 7 and 30 days exist at TuFirma, but only for natural persons without RUC, so they are useless for invoicing — [TuFirma][tufirma].

**Types and the RUC.**
- Natural persons with RUC: the signature serves for document signing and invoicing — [Namirial][namirial]. To invoice, the RUC field must be filled on the request form; otherwise "no podrá facturar electrónicamente" — [ICERT-EC][cj-pn].
- Sociedades: "normally" the signature is the legal representative's, and "the SRI allows registering another company member authorised by the Legal Representative" — [Namirial][namirial]. Requirements include nombramiento, estatutos and RUC — [TuFirma][tufirma].
- Miembro de empresa: requires authorization from the representative — [ICERT-EC miembro][cj-me], [TuFirma][tufirma]. Public servants may use it only for their own institution's invoicing — [ICERT-EC miembro][cj-me].
- The SRI rejects with "Firma inválida – No existe el RUC en el certificado digital". The ficha sends you to the certificate's details to find "el tag que contiene el dato del RUC" — [Ficha 2.34, §16][ficha].
- Law: the signature must be "individual y estar vinculada exclusivamente a su titular" — [Ley de Comercio Electrónico Art. 15][ley].

**Reuse, renewal, expiry.**
- Facturador SRI en línea takes a `.p12` and its password, under Configuración – Perfil y firma — [Elyex][elyex]. Open-source libraries take the same file — [signer][signer].
- Error 42 "Certificado revocado: certificado que ha superado su fecha de caducidad, y no ha sido renovado" is in the EMISOR list — [Ficha 2.34, §11][ficha].
- Renewal exists: Registro Civil USD 20.70 — [gob.ec][rc]; BCE offers "Renovar Certificado Digital", and its first password recovery is free — [gob.ec BCE][bce].
- Code reads expiry from the certificate's `validity.notAfter` — [open-factura][openfactura] and `not_valid_after` — [xades-bes-sri-ec][py-xades].

### Inferences
- **Ownership rule (inferred, no official text found):** the RUC embedded in the certificate must equal the emisor's `ruc`. So a persona natural signs with their own certificate carrying their RUC, and a sociedad signs with its representative's or an authorized member's certificate issued for the company. Certificates of an accountant or POS vendor fail. There is no provider-level "signing on behalf of".
- Natural persons who hold a certificate issued **without** RUC need a new one. Confirm before onboarding.
- Reuse: nothing binds a certificate to one system, so the same `.p12` should work in the Facturador SRI and the POS. Issuer and RUC are what count.
- Reading expiry (run on a secured machine, password via a prompt not an argument):
  `openssl pkcs12 -in firma.p12 -nokeys -legacy | openssl x509 -noout -subject -issuer -enddate -serial`.
  On upload, the POS should read `notAfter`, the issuer, and the RUC field, and alert at 60/30/7 days.
- Renewal may produce a new key and serial, so the operation is a `.p12` replacement, not a config change. Authorized documents remain valid (not confirmed by any source).
- The accredited list and the SRI-registered list diverge. Issuers outside the second list (Registro Civil, Firmasegura, Appfirmas…) may fail with error 40 or 39; the FAQ is from 2023, so verify with a real test.

### Gaps
- No official text states the exact ownership rule. The ficha only shows the error message.
- I could not establish how the RUC is stored in the certificate (extension OID varies by issuer), so a generic parser needs samples from each issuer.
- Official price lists for Security Data, ANF, Uanataca and BCE were not retrievable. Prices need a final check.
- Whether a real certificate is needed for ambiente de pruebas. Practice suggests yes, but I found no official statement.
- No official source addresses using one certificate in two systems at once.

## 10. Security handling of the `.p12` and its password

### Takeaway
The `.p12` plus its password are the emisor's legal signature, and the titular carries liability for its misuse. Treat them as top-tier secrets: encrypt at rest, keep the password apart from the file, and sign in one isolated server component.

### Cited Findings
- The titular must act with diligence to keep the signature "bajo su estricto control y evitar toda utilización no autorizada", must notify when third parties may control it, must answer for unauthorized use when lacking diligence, and must ask the issuer to cancel certificates at risk — [Ley de Comercio Electrónico Art. 17][ley].
- When keys are lost, revoke and request a new certificate; revocation is online 24/7 at Uanataca/Namirial — [Namirial][namirial].
- A file `.p12` is downloadable and arrives by email, while a token's private key cannot be copied — [TuFirma][tufirma].
- Anti-patterns seen in code (Open-source):
  - `xades-bes-sri-ec` passes the password on a shell command line with `shell=True` (`openssl pkcs12 ... -passin pass:{password}`), exposing it to process listings and to shell injection — [xades.py][py-xades].
  - `open-factura` offers loading a `.p12` from a URL — [signing.ts][openfactura].
- A good pattern: `ec-sri-invoice-signer` takes a Buffer and a password in memory and writes nothing to disk — [signer][signer].

### Inferences
These are engineering recommendations, not official requirements:
- Store the `.p12` encrypted with a KMS-managed key (envelope encryption), per tenant. Keep the password as a separate secret, not in the same row in plain form.
- Never put either in the repo, `.env` committed to git, logs, error trackers, frontend, or the POS terminals. The browser must never see them after upload.
- Upload over TLS to a write-only endpoint: validate on upload, encrypt immediately, never return the file.
- Sign only in a dedicated backend module with narrow permissions, decrypting in memory per request or with a short cache. Avoid temp files.
- Audit every sign operation (who, which document, which certificate serial) and alert on signing outside business patterns.
- Allow one-click replacement and a documented revocation runbook pointing to the issuer's channel.
- For a SaaS, get written authorization from each client for custody, since Art. 17 leaves liability with the titular. Legal review recommended.
- Keep test and production `.p12` separate, and never reuse a real customer's signature in staging.

### Gaps
- I found no SRI or ARCOTEL guidance specific to storing a `.p12` on a third-party server, or on whether custody by a provider is permitted.

[ficha]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf
[xsd-zip]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/05546998-6f29-4870-be3b-62650f312a6c/XML%20y%20XSD%20Factura.zip
[sri-fe]: https://www.sri.gob.ec/en/facturacion-electronica
[sri-faq]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf
[sri-base]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/89f99ed6-9b24-4d74-90e0-4e2633c0d4dc/Base+Imponible,+hecho+generador+y+sujetos+pasivos+del+Impuesto+al+Valor+Agregado.pdf
[ley]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/43309918-66eb-4bbb-9101-a825b5dafbde/LeyComercioElectronico.doc
[signer]: https://github.com/bryancalisto/ec-sri-invoice-signer
[signer-npm]: https://www.npmjs.com/package/ec-sri-invoice-signer
[signer-118]: https://github.com/bryancalisto/ec-sri-invoice-signer/issues/118
[py-xades]: https://github.com/alfredo138923/xades-bes-sri-ec
[openfactura]: https://github.com/miguelangarano/open-factura/blob/main/src/services/signing.ts
[openfactura-npm]: https://www.npmjs.com/package/open-factura
[leni-php]: https://packagist.org/packages/lenincrdva/xades-bes-signer
[mityc]: https://github.com/gdiazs/MITyCLib/blob/master/MITyCLibXADES/src/main/java/es/mityc/firmaJava/libreria/xades/ValidarFirmaXML.java
[firmaecjs]: https://github.com/XaviMontero/firmaec.js
[iaerp-adr]: https://github.com/ceduardodch/iaerp/blob/main/docs/adrs/0008-fiscal-calculation-rounding.md
[appsalon-pr]: https://github.com/Johnsky-Games/AppSalon_PHP_MVC_JS_SASS/pull/24
[deley-52]: https://deley.ec/guias/error-52-sri
[quipuy-35]: https://quipuy.com/blog/error-35-sri-que-significa
[quipuy-p]: https://quipuy.com/blog/firma-electronica-ecuador-cuanto-cuesta
[lexis-prov]: https://www.lexis.com.ec/noticias/sri-crea-registro-obligatorio-de-proveedores-de-facturacion-electronica
[coronel]: https://coronelyperez.com/blog-coronel-perez-ecuador/derecho-tributario/registro-proveedores-facturacion-electronica-sri/
[nerux]: https://nerux.app/guia/facturacion-sri/ruc-proveedor-factura-electronica-resolucion-sri
[mercurio-inmediata]: https://elmercurio.com.ec/?p=1232837
[mercurio-iva8]: https://elmercurio.com.ec/nacional/2026/10/30/iva-8-servicios-turisticos-feriado-noviembre-2026/
[lexis-304]: https://www.lexis.com.ec/noticias/decreto-ejecutivo-304-reduccion-del-iva-para-el-sector-turistico-durante-el-feriado-de-carnaval-2026
[lexis-ss]: https://www.lexis.com.ec/noticias/gobierno-de-ecuador-reduce-iva-al-8-para-servicios-turisticos-en-semana-santa-2026
[firmaok-iva]: https://firmaok.com.ec/blog/tipos-de-iva-ecuador-2026
[bloomberg]: https://www.bloomberglinea.com/2022/11/17/en-ecuador-las-facturas-de-mas-de-us50-deberan-emitirse-con-datos-del-comprador/
[expreso]: https://www.expreso.ec/actualidad/economia/compras-50-podran-nombre-consumidor-final-141233.html
[siigo-cf]: https://www.siigo.com/ec/blog/obligaciones-fiscales/factura-consumidor-final/
[siigo-rimpe]: https://www.siigo.com/ec/blog/obligaciones-fiscales/rimpe-emprendedores/
[primicias-rimpe]: https://www.primicias.ec/economia/sri-recategorizacion-rimpe-negocios-populares-emprendedores-regimen-general-ecuador-126928/
[derecho-propina]: https://derechodeltrabajo.ec/la-propina-obligatoria-en-ecuador-a-quien-le-corresponde/
[quito-decreto]: https://www.quito-turismo.gob.ec/descargas/LOTAIP%202021/WEB%202021/NORMATIVA/RECAUDACION-DE-PROPINAS-EN-HOTELES-BARES-Y%20RESTAURANTES.pdf
[hace-cedula]: https://hacecuentas.com/ec/validar-cedula
[lookup-ruc]: https://lookuptax.com/docs/es/numero-identificacion-fiscal/guia-ruc-ecuador
[arcotel]: http://www.arcotel.gob.ec/listado-de-las-entidades-de-certificacion-de-informacion-y-servicios-relacionados-acreditados-y-terceros-vinculados-debidamente-acreditadas/
[firmar-ec]: https://firmar.ec/en/certificate-issuers-ecuador/
[firmar-p]: https://firmar.ec/en/pricing/
[firmaec-log]: https://www.firmadigital.gob.ec/registro-de-cambios-de-firmaecchangelog/
[rc]: https://www.gob.ec/dgrcic/tramites/adquisicion-certificado-firma-electronica-archivo
[bce]: https://www.gob.ec/bce/tramites/emision-renovacion-certificados-digitales-firma-electronica
[cj-pn]: https://www.gob.ec/cj/tramites/emision-certificado-firma-electronica-persona-natural-contenedor-token-archivo-pkcs12-remoto-hsm-parte-entidad-certificacion-consejo-judicatura-icert-ec
[cj-me]: https://www.gob.ec/cj/tramites/emision-certificado-firma-electronica-miembro-empresa-contenedor-token-archivo-pkcs12-remoto-hsm-parte-entidad-certificacion-consejo-judicatura-icert-ec
[tufirma]: https://www.tufirma.com.ec/precios-y-requisitos
[easykey]: https://easykeyec.com/blog/precio-de-la-firma-electronica-2026/
[namirial]: https://servicedesk-spain-latam.namirial.com/hc/en-gb/articles/48077398202513-Management-and-Use-of-the-Electronic-Signature
[elyex]: https://elyex.com/guia-de-uso-facturador-sri/

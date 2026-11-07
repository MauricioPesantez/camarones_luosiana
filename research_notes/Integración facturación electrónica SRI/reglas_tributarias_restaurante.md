# Reglas tributarias del contenido de la factura y del RIDE para un restaurante en Ecuador (noviembre 2026)

Reading notes. Research date: 2026-11-03.

- **Source versions actually read (full text, PDF extracted):** [Reglamento de Comprobantes de Venta (RCV), consolidated to 29-XII-2023](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf); [Reglamento LRTI (RLRTI), consolidated to 24-XI-2023](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf); [Ficha técnica offline v2.32, Oct 2025](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf); [Resolución NAC-DGERCGC25-00000014](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf); [Resolución NAC-DGERCGC25-00000017](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf); [Decreto Ejecutivo 526](https://www.teleamazonas.com/uploads/files/2026/10/29/Decreto_Ejecutivo_No._526_20260929200634_20260929200648.pdf); [Resolución NAC-DGERCGC26-00000009](https://www.primicias.ec/uploads/files/2026/02/27/NAC-DGERCGC26-00000009.pdf).
- **Staleness warning:** both consolidated regulations pre-date the 15% rate, so they may have later reforms not seen here. RLRTI art. 145 and similar still say "12%". The LRTI consolidated text was not obtained; LRTI articles below come from SRI extracts or from recitals in the decree. A third party reports ficha [v2.34 (Jul 2026)](https://packagist.org/packages/julioserpone/sri-comprobantes-php) exists, and [Deley](https://deley.ec/guias/tipos-de-emision-comprobantes-electronicos-sri) calls v2.34 the current one; v2.34 was not found on sri.gob.ec.
- **Tag used below:** **[CONTADOR]** marks an interpretive point the taxpayer's accountant must confirm before it is coded as a rule.

## IVA rate on restaurant services (including the 8% holiday rate)

### Takeaway
The general rate is 15%, with no food or restaurant rate of its own. 5% is for construction materials only. A restaurant applies 8% only on decree-listed dates, and only if it holds Registro de Turismo and LUAF and appears in the tourism catastro. In 2026 this happened eight times, the latest on 31 Oct to 3 Nov.

### Cited Findings
- General rate is 15% since 1 Apr 2024 (Decreto 198); 5% applies to construction materials from the same date — [SRI, IVA page](https://www.sri.gob.ec/en/impuesto-al-valor-agregado-iva).
- Decreto 470 kept 15% for 2025. SRI Circular NAC-DGECCGC25-00000006 (26 Dec 2025) states 15% continues until a decree changes it, so there is no automatic return to 13% — [NMS](https://nmslaw.com.ec/blog/2025/12/29/sri-ecuador-vigencia-iva/); [Expreso](https://www.expreso.ec/actualidad/economia/sri-ante-la-ausencia-de-un-nuevo-decreto-seguira-rigiendo-el-15-de-iva-269423.html) (secondary; the circular itself was not read).
- LRTI art. 65 lets the President modify the general rate, never below 13% nor above 15% save legal exceptions (quoted in recitals) — [Decreto 526](https://www.teleamazonas.com/uploads/files/2026/10/29/Decreto_Ejecutivo_No._526_20260929200634_20260929200648.pdf).
- The unnumbered article after LRTI art. 65 allows reduction to 8% for tourism services during national or local holidays and the adjacent Saturdays and Sundays. It applies to services "cuyo hecho generador ocurra en las fechas" in the decree. "Alimentos, bebidas y entretenimiento" is a listed tourism activity, and providers must hold Registro de Turismo and LUAF — [Decreto 526 recitals](https://www.teleamazonas.com/uploads/files/2026/10/29/Decreto_Ejecutivo_No._526_20260929200634_20260929200648.pdf).
- Decreto 526 sets 8% for Sat 31 Oct, Sun 1, Mon 2 and Tue 3 Nov 2026, and art. 3 orders establishments to issue comprobantes at 8% in that period — [Decreto 526](https://www.teleamazonas.com/uploads/files/2026/10/29/Decreto_Ejecutivo_No._526_20260929200634_20260929200648.pdf).
- Other 2026 periods reported: 1–4 Jan (D.271), 14–17 Feb, 3–5 Apr, 30 Apr–3 May (D.368) — [Factuplan](https://factuplan.com.ec/blog/iva-8-feriados-ecuador-2026); 23–25 May — [Extra](https://www.extra.ec/noticia/economia/iva-baja-8-feriado-24-mayo-servicios-turisticos-ecuador-154259.html); 8–10 Aug (D.465) — [Lexis](https://www.lexis.com.ec/noticias/ecuador-reduce-el-iva-al-8-para-turismo-del-8-al-10-de-agosto); 9–11 Oct (D.513) — [Lexis](https://www.lexis.com.ec/noticias/presidente-noboa-decreta-iva-del-8-para-turismo-en-feriado-de-octubre).
- Only establishments in the national catastro with Registro de Turismo and LUAF may apply 8%. Misuse means paying the shortfall plus interest and fines, and a fine of up to USD 1,500 is reported — [El Universo (2024)](https://www.eluniverso.com/noticias/economia/iva-feriado-ecuador-catastro-establecimientos-turismo-nota); [El Comercio](https://www.elcomercio.com/actualidad/negocios/conozca-establecimientos-pueden-ofrecer-iva-8-durante-feriado-carnaval-2025/).
- XML rate codes (`codigoPorcentaje`, Tabla 17): 0=0%, 2=12%, 3=14%, 4=15%, 5=5%, 6=No objeto, 7=Exento, 8=IVA diferenciado (8% tourism), 10=13% — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- Prepared food in a restaurant is reported at 15% while unprocessed fresh food is 0% — [Naranjilla (vendor blog)](https://naranjilla.app/blog/como-facturar-restaurante-negocio-comida-ecuador). RLRTI art. 145 says goods supplied with a service taxed at the same rate form part of that service's base even if invoiced separately — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf).

### Inferences
- The "up to 12 days a year" limit should not be coded. Ficha v2.32 footnote 3 and [Factuplan](https://factuplan.com.ec/blog/iva-8-feriados-ecuador-2026) still cite it, but the article as quoted in Decreto 526 has no such cap, and the periods listed above add up to 28 days in 2026. The cap was probably removed by a 2024 tourism-law reform, which was not verified.
- The POS needs a rate driven by a dated table plus an "establecimiento habilitado para turismo" flag, not a fixed rate or a date rule. Dates are known only days ahead (D.526 was signed two days before the period started).
- Because 8% follows the hecho generador, and LRTI art. 61 lets the taxpayer take either service date or payment date, a table opened at 23:50 on the last 8% day and paid after midnight needs a consistent policy. **[CONTADOR]**
- Whether take-away and delivery qualify for 8% is unclear. The decree covers "prestación de los servicios"; a take-away may be a sale of goods. **[CONTADOR]**

### Gaps
- No 8% decree for December 2026 was found. A national work suspension on 20 Nov comes from [Decreto 507](https://www.elcomercio.com/actualidad/ecuador/ecuador-dia-descanso-feriados-2026/), but no linked IVA cut was found.
- The current SRI implementing rule for 8% (earlier versions are Res. NAC-DGERCGC22-00000010 and -11) was not read. The exact XML treatment of code 8 was not confirmed beyond Tabla 17.
- LRTI arts. 55–56 (0% lists) were not read, so 0%-rate items sold in a restaurant, and services by certified artisans, remain unverified.

## Regimes: RIMPE Emprendedor, Negocio Popular, Régimen General

### Takeaway
Legends are fixed by the ficha, in `<contribuyenteRimpe>`: "CONTRIBUYENTE RÉGIMEN RIMPE" or "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE". Régimen General has no regime legend. Only Negocio Popular may use notas de venta; if it issues e-invoices, its supplies are 0% IVA according to the SRI circular as reported by EY.

### Cited Findings
- Tag `<contribuyenteRimpe>` goes between `<agenteRetencion>` and `</infoTributaria>`. Values: `CONTRIBUYENTE RÉGIMEN RIMPE` (27 chars) or `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` (45 chars). Anexo 22 shows both on the RIDE — [Ficha v2.32, Anexo 22](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- RCV art. 18 no. 11 requires "Contribuyente Régimen RIMPE"; no. 13 requires "Contribuyente Negocio Popular - Régimen RIMPE" and says no. 11 does not then apply to those holding existing stock — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Conflict: the [SRI RIMPE page](https://www.sri.gob.ec/en/rimpe) gives "Negocio Popular – Régimen RIMPE" for notas de venta and the electronic field per ficha; [Tu Facturero](https://tufacturero.ec/como-funcionan-las-retenciones-en-el-regimen-rimpe/) was summarized as saying one legend exists for both regimes. The ficha and RCV agree with each other and outrank both.
- Other legends: "Obligado a Llevar Contabilidad" (RCV art. 18 no. 12), "Contribuyente Especial" with resolution number (no. 10), "Agente de Retención" with resolution number (no. 14) — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Notas de venta: exclusive to negocios populares (RCV art. 12). RLRTI art. 223 lets them choose notas de venta or electronic invoices and documents, and loses that option when they leave the category — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf). Tabla 3 of the ficha has no electronic nota de venta document type — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- A nota de venta shows prices including taxes and a total including the legal propina (RCV art. 21), with buyer ID at any amount when needed to support costs — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Income caps: Negocio Popular up to USD 20,000 (natural persons only); Emprendedor up to USD 300,000 (natural and legal persons). Emprendedores must issue electronic invoices — [SRI RIMPE](https://www.sri.gob.ec/en/rimpe).
- Negocio Popular does not file IVA because the fixed income-tax amount covers it — [SRI RIMPE](https://www.sri.gob.ec/en/rimpe). LRTI states negocios populares' goods and services are 0% IVA, per Circular NAC-DGECCGC23-00000004 of 19 Jul 2023 — [EY Tax Alert](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-tax-alert-jul4-circular-retenciones-rimpe.pdf); [Primicias](https://primicias.ec/noticias/economia/contribuyentes-rimpe-retenciones-fuente).
- Emprendedor files IVA semiannually and cumulatively (monthly also allowed) — [SRI RIMPE](https://www.sri.gob.ec/en/rimpe). It charges IVA, since [EY](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-tax-alert-jul4-circular-retenciones-rimpe.pdf) reports buyers withhold IVA from it.
- Regime changes 2023–2026: reform in force 20 Jun 2023 changed negocio popular amounts — [Primicias](https://primicias.ec/noticias/economia/contribuyentes-rimpe-retenciones-fuente); RLRTI RIMPE articles replaced by D.E. 876 (21 Sep 2023) — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf); around 14,000 taxpayers moved from Negocio Popular to Emprendedor in Jan 2026 — [Vistazo](https://www.vistazo.com/amp/actualidad/nacional/2026-01-07-sri-actualiza-rimpe-traslada-miles-contribuyentes-otros-regimenes-asi-verificar-si-afecta-OF10629025).

### Inferences
- Regime must be a per-issuer setting read from the RUC and re-checked each January, since SRI recategorizes automatically. A change alters the legend, the IVA rate, and whether notas de venta are allowed.
- A Negocio Popular restaurant issuing e-invoices would use `codigoPorcentaje` 0 with the Negocio Popular legend, and 15%/8% would not apply. Income from activities excluded from RIMPE is treated differently. **[CONTADOR]**
- Notas de venta are physical pre-printed documents outside the e-invoicing flow, so a POS serving Negocio Popular needs either e-invoice mode or a non-tax ticket. **[CONTADOR]**

### Gaps
- The LRTI article making negocio popular supplies 0% was not read directly. No SRI document was found describing a negocio popular e-invoice line by line.
- [Tu Facturero](https://tufacturero.ec/como-funcionan-las-retenciones-en-el-regimen-rimpe/) says only that they do not break out IVA, which differs in wording from the 0% rate.
- Whether any 2025–2026 law further altered RIMPE was not confirmed; none was found. Res. NAC-DGERCGC24-00000027, listed on the SRI page, was not read.

## 10% service charge (propina legal)

### Takeaway
The legal 10% applies to qualified hotels, bars and restaurants under Decreto Supremo 1269 of 1971, is outside the IVA base, and goes in the XML `<propina>` field. It is not universal. A "10% servicio" charged by a non-qualified restaurant is likely IVA-taxable.

### Cited Findings
- RCV art. 19 no. 7: invoices of "debidamente calificados" hotels, bars and restaurants show the propina set by Decreto Supremo 1269 (R.O. 295, 25-VIII-1971), and it is not part of the IVA base. RCV art. 21 no. 3 says the same for notas de venta — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- RLRTI art. 145: the service base includes the total value charged; the legal propina of 10% of "hoteles y restaurantes calificados" is not part of the base — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf).
- XML: `<propina>` is mandatory in `infoFactura` (0.00 when none). In SRI's free Facturador it may not exceed 10% of Sub total. Total adds Sub total, ICE, IRBPNR, IVA and Propina — [Ficha v2.32, 9.16](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- Scope: mandatory for hotels, bars and restaurants of the first two categories (5 and 4 stars). A 2007 Acuerdo Interministerial of the Trabajo and Turismo ministries regulates it; receipts must carry "Incluye el 10% de servicios – propina – TIP" — [Legal 500 (secondary, about 2019)](https://www.legal500.com/intelligence/ecuador/media-telecoms-it-entertainment/la-propina-obligatoria-en-ecuador-%C2%BFa-qui%C3%A9n-le-corresponde).
- Search excerpts of a Ministry of Tourism document describe distribution by hours worked, a settlement to each worker, a duty to pay workers if the establishment stops collecting, and a printed "10% propina - TIP" breakdown — [Turismo (site unreachable, not read in full)](https://www.turismo.gob.ec/wp-content/uploads/2016/04/REGULA-LOS-BENEFICIARIOS-DE-PROPINAS-EN-BARES.pdf).
- The current classification is restaurants of one to five tenedores (Acuerdo 2018-053, last reform R.O. 50, 26-IV-2022) — [Reglamento Turístico de Alimentos y Bebidas](https://www.quito-turismo.gob.ec/wp-content/uploads/2023/02/REGLAMENTO-TURISTICO-DE-ALIMENTOS-Y-BEBIDAS.pdf). No 10% rule was located in it.

### Inferences
- "10% servicio" must be a per-establishment switch tied to its category, not a default.
- For a restaurant not "calificado", RLRTI art. 145's first sentence points to any "service" charge being part of the taxed value. It should then be a taxed line and not `<propina>`. **[CONTADOR]**
- Voluntary tips the customer adds are not the Decreto 1269 propina. Using `<propina>` for them is not supported by the text found. **[CONTADOR]**
- The 10% is computed on the Sub total, so after discounts is the natural reading. **[CONTADOR]**
- For delivery and take-away there is no rule. The propina rewards table service in the wording of the sources, but they do not exclude other channels; the only signal is one restaurant reporting that it [sets 10% aside on delivery sales](https://dplnews.com/el-confinamiento-impulsa-otra-vez-al-delivery-en-ecuador/). **[CONTADOR]**

### Gaps
- No Código del Trabajo article on the 10% was found. The sources found rest on the 1971 decree and the 2007 acuerdo.
- The number and text of the 2007 Acuerdo could not be retrieved (turismo.gob.ec did not resolve).
- How the old "first two categories" map to one–five tenedores today is unconfirmed.

## Delivery fees

### Takeaway
No SRI rule on restaurant delivery was found, so this is the largest open issue. A fee the restaurant keeps is part of its taxed price. A fee belonging to an external rider is not the restaurant's transaction, but no clean invoicing path exists for it. The accountant must pick one model before the integration is built.

### Cited Findings
- LRTI art. 58: the IVA base is the total value of the goods or services, including taxes, service fees and other charges legally attributable to the price; only normal discounts shown on the invoice, returns and sale-on-term interest and insurance are deductible — [SRI extract](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/89f99ed6-9b24-4d74-90e0-4e2633c0d4dc/Base+Imponible,+hecho+generador+y+sujetos+pasivos+del+Impuesto+al+Valor+Agregado.pdf).
- RCV art. 8: comprobantes are issued "únicamente por transacciones propias del sujeto pasivo" — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Reembolso (RLRTI art. 36): the third party's comprobante must be issued in the intermediary's name; it is neither income nor expense for the intermediary; the intermediary issues a reimbursement invoice detailing those comprobantes (RUC, number, net, IVA) — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf).
- RLRTI art. 144: when a taxpayer bills services and seeks reimbursement, it issues one invoice for its services and another for the reimbursement — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf). The XML is Anexo 5, `codDocReembolso` 41 — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- The ficha also has a "factura con rubros de terceros" (Anexo 8), with `<otrosRubrosTerceros><rubro><concepto/><total/>`, tied to Res. NAC-DGERCGC15-00003184 (R.O. 661, 4-I-2016) — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf). The resolution's scope was not read.
- Liquidación de compra applies to services from individuals who lack or have suspended RUC and cannot issue comprobantes by reason of cultural level or rusticity (RCV art. 13 c) — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Withholding on income: 1% on private and public cargo transport services (Art. 2 no. 2 a) — [Res. NAC-DGERCGC26-00000009](https://www.primicias.ec/uploads/files/2026/02/27/NAC-DGERCGC26-00000009.pdf).
- Platforms: payment aggregators and online marketplaces act as withholding agents toward affiliated merchants and on their own income at 2% (Art. 2 no. 4 k) — [Res. NAC-DGERCGC26-00000009](https://www.primicias.ec/uploads/files/2026/02/27/NAC-DGERCGC26-00000009.pdf). Delivery apps charged 15–35% commission per order in 2021, computed on the gross amount including tax — [DPL News](https://dplnews.com/el-confinamiento-impulsa-otra-vez-al-delivery-en-ecuador/).
- One vendor advises checking whether the platform issues the customer invoice on the restaurant's behalf — [Naranjilla](https://naranjilla.app/blog/como-facturar-restaurante-negocio-comida-ecuador).

### Inferences
This project's case (internal rule): external riders who are not employees keep the `costoEnvio`. In cash they collect `total` and pay the restaurant `total − costoEnvio`. In transfer the restaurant receives `total` and hands the fee to the rider. Models to take to the accountant **[CONTADOR]**:
- **Model A, restaurant sells delivered food as one price.** Fee is a taxed line on the restaurant invoice; the rider bills the restaurant (or liquidación de compra where legally possible). Simplest for the customer and SRI, but envío becomes restaurant income, which contradicts the rule that envío never counts as a sale.
- **Model B, the rider is a separate supplier to the customer.** The invoice shows only food, so `importeTotal = total − costoEnvio`. It matches current bookkeeping and RCV art. 8, but the transfer case is weak because the restaurant visibly receives the fee. A rider without RUC is also a compliance gap for the rider.
- **Model C, reembolso.** Technically available, but it requires a comprobante in the restaurant's name per delivery and a separate invoice, which is unrealistic at per-order scale for USD 2 fees.
- **Model D, rubros de terceros.** Conceptually closest to a pass-through, but its scope (Res. 3184) is unconfirmed and it may be sector-specific. Do not build on it until confirmed.

Other points:
- If the fee is taxed under Model A, it should carry the same rate as the meal, by analogy with RLRTI art. 145. **[CONTADOR]**
- Under any model, the USD 50 consumidor final test and `pagos` totals depend on whether envío is inside the invoice.
- A rider who is an employee makes the fee the restaurant's own.
- For platforms, the restaurant likely still invoices the food sale, receives a commission invoice, and books withholdings. Whether the customer is the platform or the diner depends on the contract. **[CONTADOR]**

### Gaps
- No SRI ruling, consulta or circular on restaurant delivery fees was found, and none on PedidosYa or Uber Eats invoicing. All platform statements above are secondary and partly old.
- The scope of Res. NAC-DGERCGC15-00003184 is unconfirmed.

## Mixed payment on an invoice

### Takeaway
The XML supports several forms of payment in `<pagos>`, so efectivo + transferencia is two `<pago>` entries using codes 01 and 20. This is a reporting detail with no tax effect on the invoice's base or IVA.

### Cited Findings
- `<pagos>` is mandatory, with `<pago>` holding `<formaPago>`, `<total>`, and `<plazo>`/`<unidadTiempo>` when applicable — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- Tabla 24 codes: 01 sin utilización del sistema financiero; 15 compensación de deudas; 16 tarjeta de débito; 17 dinero electrónico; 18 tarjeta prepago; 19 tarjeta de crédito; 20 otros con utilización del sistema financiero; 21 endoso de títulos — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- The RIDE template shows a "Forma de pago / Valor" block — [Ficha v2.32, Anexo 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- Establishments paid by credit card must break out IVA on the comprobante (LRTI art. 63 extract) — [SRI extract](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/89f99ed6-9b24-4d74-90e0-4e2633c0d4dc/Base+Imponible,+hecho+generador+y+sujetos+pasivos+del+Impuesto+al+Valor+Agregado.pdf).

### Inferences
- Bank transfer maps to 20. Card maps to 16/19.
- The `<pago>` lines should sum to `importeTotal`. This was read from the structure, not from an explicit rule.
- In this project a "mixed" delivery payment is the rider splitting his debt to the restaurant, while the customer paid him in cash. `formaPago` describes how the buyer paid, so that case is arguably one 01 entry, not 01 + 20. **[CONTADOR]**
- Under Model B (see Delivery), the `pagos` total excludes envío, so it cannot be fed directly from `Cobro.monto`, which includes envío.

### Gaps
- Any SRI validation requiring `pagos` to equal `importeTotal` was not confirmed.
- The current LRTI art. 103 bancarización threshold was not verified.

## Courtesies, discounts and promotions

### Takeaway
A comprobante is required even for free items. A 100% discount is treated as a free transfer: the invoice shows base at sale price and the IVA, which the restaurant bears unless the buyer pays it. Normal partial discounts reduce the base if shown on the invoice. **The circular is written for goods and rights, so applying it to a served plate needs the accountant's confirmation.**

### Cited Findings
- RCV art. 8: the duty to issue arises on transfer of goods even when free or autoconsumo, and on services of any nature, even at 0% — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- [Circular NAC-DGERCGC15-00000015 as published in Correo Legal, 31 Dec 2015](https://www.pudeleco.com/clegal/tributario/2015/ilt15074.pdf): issuers of free transfers must issue facturas or notas de venta stating base (commercialization or sale price) and IVA; 100% discounts count as free transfers; one with remaining obligations between the parties is not.
- The same circular: in one transaction, an item discounted 100% is treated as transferred free. The case study "buy 2 pay 1" appears in the discount section, and its worked invoice shows base at sale price, zero discount, and IVA.
- The same circular on allocation: a discount goes to specific items only with objective information, otherwise proportionally across all items; e-invoices may register discounts per item, on the total, or both; allocation must reflect economic substance.
- IVA on a free transfer is borne by the grantor or the recipient. If the grantor bears it there is no withholding, and it is a deductible expense for the grantor — [ATE summary](http://www.ate.ec/docs/Boletines%20Ene%202016%20-%20Autoconsumo%20y%20transferencias%20gratuitas%20gravadas%20con%20IVA.pdf).
- Autoconsumo: inventory shortfalls without proof are deemed withdrawn, except loss or destruction; goods for own use are taxed at sale price; the person withdrawing bears the IVA, without credit — [ATE summary](http://www.ate.ec/docs/Boletines%20Ene%202016%20-%20Autoconsumo%20y%20transferencias%20gratuitas%20gravadas%20con%20IVA.pdf).
- LRTI art. 60: for own-use withdrawals and donations, the base is market value — [SRI extract](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/89f99ed6-9b24-4d74-90e0-4e2633c0d4dc/Base+Imponible,+hecho+generador+y+sujetos+pasivos+del+Impuesto+al+Valor+Agregado.pdf). LRTI art. 58 no. 1 allows normal discounts that appear on the invoice.

### Inferences
- The POS should not model a courtesy as a plain 100% line discount, since that yields base 0 and IVA 0. To follow the circular, the line must keep its base at menu price and IVA must be computed, with the restaurant absorbing the IVA. The XML mechanics for "total payable is 0 but IVA exists" are not defined in the sources. **[CONTADOR]**
- A cheaper design is to avoid 100%-off lines: split the promo value proportionally across items, as the circular allows absent objective allocation. A "2x1" as 50% on both items is a partial discount rather than a free item, but the allocation must reflect substance. **[CONTADOR]**
- A plate served at a restaurant may be a service rather than a goods transfer, in which case free service IVA treatment may differ. **[CONTADOR]**
- Staff meals are not addressed here; they could be autoconsumo or a benefit. **[CONTADOR]**
- Waste and spoilage need documentation, or they risk being treated as deemed autoconsumo.

### Gaps
- The circular dates from 2015 and may have been updated. No restaurant-specific ruling on courtesies was found. The circular's number is as printed in Correo Legal; the SRI original was not read.

## ICE on alcohol and sugary beverages

### Takeaway
A restaurant reselling drinks is not an ICE taxpayer and shows no ICE line. ICE is embedded in its purchase cost. Its menu price is the IVA base in full. The exception is a restaurant that manufactures or imports ICE-taxed goods.

### Cited Findings
- ICE obligations (monthly return, ANEXO ICE, ANEXO PVP) attach to the producer or manufacturer of a taxed good or provider of a taxed service — [SRI ICE FAQ (2017)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/8be598b6-9808-4cbb-97af-c30312cb98e4/Preguntas+frecuentes.pdf). Importers and manufacturers bear it once — [Tributos.org (secondary)](https://tributos.org/es/guias/es-ice-ecuador-y-quienes-lo-pagan-guia-completa-2026).
- RCV art. 19 no. 9 requires ICE to be shown separately in sales by national producers of ICE-taxed goods — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- For issuers that do charge ICE, IVA is computed on subtotal plus ICE — [Ficha v2.32, 9.16](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf). LRTI art. 58 includes taxes in the base.
- There are no ICE exemptions for certified artisans; craft-beer and spirit producers are ICE taxpayers — [SRI ICE FAQ](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/8be598b6-9808-4cbb-97af-c30312cb98e4/Preguntas+frecuentes.pdf).
- Free transfers and own consumption by an ICE agente de percepción also cause ICE (RLRTI art. 209). For plastic bags, "establecimientos de comercio" are sociedades or individuals keeping accounts with three or more open establishments, plus franchisors and franchisees (art. 212.1) — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf).

### Inferences
- For a reseller, drinks carry only IVA, at the same rate as the rest of the check. The POS needs no ICE tax lines by default.
- A brewpub or a house-made bottled spirit would be ICE-taxed manufacturing and is outside the default design. **[CONTADOR]**
- A chain of 3+ locations or a franchise that gives plastic bags should check the bag ICE. **[CONTADOR]**

### Gaps
- No SRI text explicitly addressed restaurants as resellers; the conclusion rests on who the taxpayer is. Whether house-made sugary drinks count as ICE-taxed goods was not established.

## Consumidor final and buyer identification

### Takeaway
"CONSUMIDOR FINAL" is allowed only if the transaction does not exceed USD 50 and the buyer does not need to support costs or tax credit. Above that, ID is mandatory. Since 1 Jan 2026 these invoices cannot be annulled or corrected by credit note, which makes this the most consequential POS rule.

### Cited Findings
- RCV art. 19 no. 1 (reformed by D.E. 586, R.O. 186-3S, 10-XI-2022): buyer name and RUC, cédula or passport are required when the buyer needs to support costs or IVA credit; otherwise, if the transaction "no supera los US $50,00", the legend may be used and items 4–7 need not be detailed — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Ficha: above USD 50 buyer data are mandatory. Code 07 uses `9999999999999`. Other ID codes: 04 RUC, 05 cédula, 06 pasaporte, 08 identificación del exterior. Credit notes and debit notes must identify the receiver, so 07 is not available there — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- Conflict on the boundary: [Ciro](https://ciro.com.ec/blog/sri-resolucion-anulacion-facturas-2026/) says "igual o superior a $50" requires ID, but the regulation's text allows exactly USD 50. Blogs agree the amount [includes IVA](https://factuplan.com.ec/blog/monto-factura-consumidor-final-ecuador-2026).
- Issuing is mandatory even if the buyer does not ask (RCV art. 8). Issuers without buyer ID must be able to issue identified comprobantes on request (RCV art. 17, last paragraph) — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- RCV art. 11: IVA is broken out when the buyer has tax credit or uses the invoice for personal expenses; not broken out with final consumers — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Res. NAC-DGERCGC25-00000014 art. 3, last paragraph: e-invoices with the "consumidor final" legend cannot be annulled once issued and transmitted, and no credit note is allowed. It took effect 1 Jan 2026 per Res. 17 art. 1 f) — [Res. 14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf); [Res. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- SRI fedatarios may annul "consumidor final" comprobantes ex officio in the control transactions they carry out (Res. 14, Disposición General Quinta, added by Res. 17) — [Res. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- Claim not supported by primary text: a blog says RIMPE Negocio Popular has a USD 200 consumidor final limit — [Factuplan](https://factuplan.com.ec/blog/monto-factura-consumidor-final-ecuador-2026). RCV art. 19 has one limit, with no such carve-out.

### Inferences
- The POS should block `07` when `importeTotal` > 50.00, allow exactly 50.00, and ask for ID before issuing. Whether the legal propina counts towards the USD 50 is unstated; using `importeTotal` is the conservative choice. **[CONTADOR]**
- A customer with RUC has no restriction; any buyer who gives data must be invoiced with them. Corporate customers need RUC plus razón social and benefit from IVA detail.
- Splitting one check to stay under USD 50 is not addressed in the sources and is risky if it hides one transaction. **[CONTADOR]**
- Asking "¿factura con datos?" must happen before issuing, because a consumidor final invoice cannot be fixed afterward.

### Gaps
- The sources do not say whether "transacción" means one comprobante or one table's consumption when split.

## Timing of issue

### Takeaway
A restaurant invoice is issued when the service happens or at payment, and is transmitted at that moment since 1 Jan 2026. Issuing the next day or backdating has no support in the sources. Monthly consolidation is only defensible under a continuing contract.

### Cited Findings
- RCV art. 17 a): comprobantes are issued and delivered at the moment of the act or contract — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- RCV art. 17 b): for goods sold via electronic means or phone with card, account deposit or cash on delivery, the comprobante goes with the goods or by data message — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- RCV art. 17 e): for phased contracts and tracto sucesivo, issue when each period or stage's conditions are met — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- LRTI art. 61: for services, at actual provision or at total or partial payment, at the taxpayer's choice; for goods, at delivery or payment, whichever is first; for tracto sucesivo, each period — [SRI extract](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/89f99ed6-9b24-4d74-90e0-4e2633c0d4dc/Base+Imponible,+hecho+generador+y+sujetos+pasivos+del+Impuesto+al+Valor+Agregado.pdf). Circular NAC-DGECCGC24-00000002 repeats this — [EY](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-tax-alert-1abr1_3-flash-criterios-aplicacion-iva15.pdf).
- Res. 14, Disposición Reformatoria Primera no. 2, deletes from Res. 233 art. 7 the phrase allowing up to four business days after generation, effective 1 Jan 2026 — [Res. 14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf); [Res. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf). A law firm reads this as transmission at generation, with fines from 1 RBU (negocios populares) to 30 RBU for not transmitting sales comprobantes under Res. NAC-DGERCGC24-00000022 — [AVL](https://avl.com.ec/recordatorio-sobre-nuevo-proceso-para-anulacion-de-comprobantes-electronicos-y-sanciones-por-incumplimientos/).
- Ficha error 65 "Fecha de emisión extemporánea" is raised when a comprobante is not sent within its issuance type's time — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).

### Inferences
- For dine-in, issue when the check closes. For WhatsApp delivery with cash on delivery, 17 b) allows delivery with the goods or by data message, but a consumidor final invoice issued before delivery cannot be undone if the order fails. Issuing on delivery confirmation or payment confirmation is safer. **[CONTADOR]**
- Customer asking next day: if a consumidor final invoice already exists, it cannot be annulled or replaced with an NC, so no compliant fix is apparent. If none was issued, the restaurant was already late; the date should be the real issue date. No source supports backdating. **[CONTADOR]**
- Whole-month invoice for meals: acceptable only as a real continuing agreement under art. 17 e) and LRTI art. 61 no. 6. Prepayment is taxable when paid if the taxpayer elects that moment, so the invoice then carries the rate at that date. **[CONTADOR]**
- An offline mode that queues invoices for hours now conflicts with the rule above.

### Gaps
- Res. 233 art. 7's current full text was not read, so the exact wording after the deletion is inferred. The SRI's tolerance window in practice for error 65 was not found. No rule on gift cards or consumption vouchers was found.

## Credit notes, cancelled orders and refunds

### Takeaway
Before the invoice exists, cancellation has no tax effect. After it, online annulment is available until day 7 of the next month, and later only by NC, except consumidor final, where neither is possible. The former 12-month NC limit was removed.

### Cited Findings
- Annulment scope: comprobantes issued with errors, or whose operation did not occur (Res. 14 art. 1). Sale comprobantes are annulled online or by NC (art. 2) — [Res. 14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- Deadline: until day 7 of the following month, moving to the next working day when it falls on a rest day or holiday; after that only by NC (art. 3 as amended). Applies to comprobantes issued from 1 Aug 2025 — [Res. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- Art. 5 now says NCs are issued only in the cases in the RCV, and SRI may verify proper use; the 12-month limit in the original art. 5 is gone — [Res. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf); [Elipsys](https://www.elipsys.ec/blog/noticias-3/resolucion-sri-nac-dgercgc25-00000017-5).
- RCV art. 15: NCs annul operations, accept returns, and grant discounts or bonuses, citing the document modified. Art. 25 lists NC content, including reason, value, IVA, and buyer ID — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- Retentions, NCs and NDs need receiver acceptance to be annulled, within 5 working days, or the request lapses (art. 4). Receptors must be told of any status change (added to Res. 233 art. 5). Comprobantes supporting tax refunds cannot be annulled — [Res. 14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- Invoices do not need receiver confirmation, though consent should be obtained first; annulment cannot be reversed — [SRI FAQ (2023)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf). This FAQ's 90-day annulment window is superseded by Res. 14 and 17.
- An NC uses the IVA rate of the original comprobante — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf); [EY](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-tax-alert-1abr1_3-flash-criterios-aplicacion-iva15.pdf).

### Inferences
- Decision table for the POS:

| Situation | Identified buyer | Consumidor final |
|---|---|---|
| Order cancelled before invoice | Nothing to do | Nothing to do |
| Operation did not occur, up to day 7 of next month | Annul online or NC | Not allowed |
| Same, after day 7 | NC only | Not allowed |
| Partial refund or item returned | NC for that value | Not allowed |
| Wrong data on the invoice | Annul and re-issue, or NC | Not allowed |

- Online annulment happens through the SRI portal, per Res. 14 art. 2, so the POS would record the status and guide staff. It may not be able to perform it. An NC can be issued by the POS.
- An NC for an invoice at 8% must stay at 8% even when issued later at 15%.
- For a consumidor final refund, the restaurant can only give the money back with no tax document, so it stays with the IVA reported. Refunds need an internal record. **[CONTADOR]**
- This pushes toward closing the invoice as late as possible, and capturing ID in any order at risk of change.

### Gaps
- No SRI guidance was found on how to handle a genuine refund on a consumidor final invoice.

## Tax declarations and withholdings received

### Takeaway
Electronic sales do not go in the ATS ventas module, but the ATS obligation itself remains for those subject to it. The POS's main duties are correct data for Form 104 and recording the retentions company customers issue. Applicable percentages need accountant confirmation.

### Cited Findings
- Monthly IVA filing for taxed transactions, by the following month on days 10–28 by RUC ninth digit. Semiannual for RIMPE Emprendedor, and for 0% or fully withheld transactions — [SRI IVA](https://www.sri.gob.ec/en/impuesto-al-valor-agregado-iva). [Form 104](https://expertax.ec/como-declarar-iva-ecuador-tarifa-2025-plazos/) is the IVA return.
- From January 2016, information in electronic comprobantes is not reported in the ATS ventas module (Res. NAC-DGERCGC16-00000092) — [Boletín Contable](https://boletincontable.com/2016/07/27/las-facturas-electronicas-ya-no-se-registran-en-el-anexo-transaccional-simplificado-ats/); [Siigo](https://contifico.portaldeclientes.siigo.ec/basedeconocimiento/descargar-reporte-ats-anexo-transaccional-simplificado/).
- ATS is filed under Res. NAC-DGERCGC16-00000278 — [gob.ec](https://www.gob.ec/sri/tramites/anexo-transaccional-simplificado-ats). Retention XML "ATS 2.0" does not replace the formal ATS obligation — [Tu Facturero (2026)](https://tufacturero.ec/retenciones-ats-2-reemplazan-ats/). Semiannual ATS exists for RIMPE; the 2026 first-semester one fell due in August — [Siigo](https://www.siigo.com/ec/blog/contabilidad-y-finanzas/vencimiento-ats-rimpe-primer-semestre/).
- Free transfers go to the ATS ventas module consolidated per client (Circular, 2015) — [ATE](http://www.ate.ec/docs/Boletines%20Ene%202016%20-%20Autoconsumo%20y%20transferencias%20gratuitas%20gravadas%20con%20IVA.pdf). Its interaction with the 2016 electronic exclusion is unclear.
- Retention timing: the agent issues the comprobante at payment or credit, whichever is first, available within five business days of receiving the comprobante de venta — [RCV art. 8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf); RLRTI art. 148 — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf).
- Income-tax withholding from 1 Mar 2026: 1% for RIMPE Emprendedor (Art. 2 no. 2 c); 2% for all movable goods (no. 4 i) and in card-issuer payments to affiliates (no. 4 b); 3% for services where labor prevails, by natural persons (no. 5 a); 3% as residual (Art. 3). Negocios populares: none for regime activities if a pre-printed comprobante was issued (no. 1 c) — [Res. NAC-DGERCGC26-00000009](https://www.primicias.ec/uploads/files/2026/02/27/NAC-DGERCGC26-00000009.pdf).
- IVA withholding as of Res. NAC-DGERCGC20-00000061: 30% on goods, 70% on services, also via card issuers; 10%/20% between special taxpayers; 100% in other listed cases — [Andersen (2020)](https://ec.andersen.com/wp-content/uploads/2020/10/TIPS-55-2020-Porcentajes-de-retención-del-impuesto-al-valor-agregado.pdf).
- Emprendedores: no IR or IVA withholding when paid with cards, collection agreements or other electronic means; other payments use SRI's percentages. Negocios populares: no IR or IVA withholding — [EY on Circular NAC-DGECCGC23-00000004](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-ec/technical/tax/documents/ey-tax-alert-jul4-circular-retenciones-rimpe.pdf).
- IVA withheld is reported as tax credit (RLRTI art. 155) — [RLRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/aa569bb7-b871-458c-a8c7-6bcf49841843/Reglamento_LRTI_24Nov2023.pdf). New withholding agents were designated by [Res. NAC-DGERCGC26-00000010](https://www.primicias.ec/economia/sri-nuevos-porcentajes-retencion-fuente-impuesto-renta-agentes-iva-ecuador-116991/).

### Inferences
- The POS can report sales by rate (15%, 8%, 0%) for Form 104 by period, including 8% days separately, and need not export an ATS ventas file for e-invoices. It still needs one if it emits physical notas de venta. **[CONTADOR]**
- A company customer's retention arrives after the invoice, so a "retención recibida" record against the invoice would help the cuadre: a bill may be paid net. Annulling a retention requires the receiver's acceptance.
- Restaurant meal as service gives 70% IVA withholding and 3% IR; as goods it gives 30% and 2%. Which one applies to dine-in versus take-away needs the accountant. **[CONTADOR]**
- Res. 26-00000009's "pre-printed" condition suggests a Negocio Popular issuing e-invoices may not automatically get the no-withholding rule, which sits oddly with the 2023 circular. **[CONTADOR]**

### Gaps
- Exact ATS-obligated taxpayers for a small restaurant and any 2024–2026 ATS reform were not confirmed. A secondary statement that electronic retentions left the ATS compras module in 2018 could not be traced to a primary source.
- Current IVA withholding percentages were not verified as unchanged since 2020; no restaurant-specific percentage was found. Whether the propina is excluded from the IR withholding base was not found.

## RIDE

### Takeaway
The RIDE has legal validity and must match the XML. A barcode is optional, there is no QR requirement, and no paper size is mandated. It must be handed over when the customer has no email or is unidentified, or on request. A thermal 80 mm RIDE seems allowed if all fields are present, but SRI does not say so. Nothing called a "simplified RIDE" exists in the sources.

### Cited Findings
- Printed RIDEs have tax and legal validity (Res. 233 of 2018). Models in the annex show field positions. Additional data may be printed (9.19) — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf).
- The issuer "podrá" add a barcode with the access key or another optional code (9.20). Technical placement advice refers to GS1-128 (9.21). Anexo 2 repeats that the barcode is optional, that issuer RIDEs need not show authorization date and time, and that the access key is the authorization number — [Ficha v2.32](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf). The ficha never mentions QR. Conflict: [Naranjilla](https://naranjilla.app/blog/como-imprimir-factura-electronica-correctamente-sri) lists a Code 128 barcode as something every RIDE must show, which the ficha contradicts; [TechSynergy](https://www.techsynergy.ec/guias/que-es-el-ride) correctly calls it optional.
- Fields shown in the Anexo 2 factura model (updated in v2.27): RUC; FACTURA No.; número de autorización; fecha y hora de autorización; ambiente; emisión; clave de acceso; logo; razón social; dirección matriz and sucursal; Contribuyente Especial Nro; Obligado a llevar contabilidad; Agente de Retención Resolución No.; buyer name and ID; fecha de emisión; dirección; placa/matrícula; guía de remisión; item lines (cod. principal, cod. auxiliar, cantidad, descripción, detalle adicional, precio unitario, subsidio, precio sin subsidio, descuento, precio total); información adicional; forma de pago and valor; subtotals by rate (tarifa especial, 5%, 15%, 0%, no objeto, exento); subtotal sin impuestos; total descuento; ICE; IVA by rate; total devolución IVA; IRBPNR; valor total — [Ficha v2.32, p. 60](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf). Anexo 22 shows the RIMPE legend on the RIDE.
- SRI FAQ: the RIDE must meet the RCV and ficha, and its field content must equal the XML. No authorization number means no tax validity. It is delivered when email delivery is impossible, the buyer is not identified, the buyer requests it, or for liquidaciones. Without an email the issuer must print it. The XML, not the RIDE, is archived, for seven years. Issuing and delivering has no cost to the customer — [SRI FAQ (2023)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- With an email, the issuer sends XML plus RIDE to the address the buyer gave — [SRI FAQ](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- If RIDE and XML differ, the XML prevails — [Facturia (secondary)](https://facturia.ec/guias/ride-y-xml/).
- Thermal paper is allowed if all mandatory data stays legible, with at least 80 mm suggested as good practice — [Naranjilla (vendor blog, not SRI)](https://naranjilla.app/blog/como-imprimir-factura-electronica-correctamente-sri).
- RCV art. 42 on printing covers physical comprobantes (graphic establishments, computerized systems) and does not set paper size — [RCV](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).

### Inferences
- A RIDE on 80 mm thermal paper is likely fine if it carries all fields and the access key in text, since no format size is set and FAQ only demands equality with the XML. The model is a "formato" with positions, so vertical re-flow is the interpretive part. **[CONTADOR]**
- Dropping fields to save paper is what would be risky. Lines that are always zero (subsidio, IRBPNR) could arguably go, but no source allows it. **[CONTADOR]**
- At a table with no email, printing is mandatory after authorization, so the printer step should wait for the authorized response. A pre-bill must not look like a RIDE.
- A Code 128 barcode is acceptable as an optional extra. Since 49 digits make a long code, it is hard to scan on 80 mm paper; the text access key is what carries validity. QR is free but not required.
- The model has no propina line, but RCV art. 19 no. 7 requires it and 9.19 allows extra data, so a restaurant RIDE should add one. Also "Valor total" includes it. **[CONTADOR]** The Anexo 2 model's "Subtotal tarifa especial" line is the likely place for the 8% base, unconfirmed.

### Gaps
- No SRI statement about thermal paper, 80 mm width or any reduced RIDE was found. The only source on thermal paper is one vendor blog, which is wrong on the barcode, so it carries little weight.
- Res. NAC-DGERCGC18-00000233's own text on delivery and on RIDE was not obtained; the delivery rules above come from the SRI FAQ of June 2023.
- Anexo 2 of ficha v2.34 was not reviewed; any change after Oct 2025 is unknown.

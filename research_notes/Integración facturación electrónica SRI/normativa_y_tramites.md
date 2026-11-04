# Normativa y trámites SRI para emitir comprobantes electrónicos desde software propio (Ecuador, estado a noviembre de 2026)

Convenciones: **[P]** = leído en texto primario (resolución, reglamento, ficha o guía del SRI). **[S]** = solo fuente secundaria. **[I]** = inferencia propia. Investigación del 3-nov-2026. Los PDF del SRI se extrajeron a texto y se leyeron directamente; las citas de artículos vienen de esa lectura.

## 1. ¿Qué normas están vigentes a noviembre de 2026 y qué fue derogado o cambió?

### Takeaway
El núcleo vigente es la Res. NAC-DGERCGC18-00000233 (reformada, sobre todo por 22-24, 22-43, 22-64, 24-35 y 25-14), el Reglamento de Comprobantes (D.E. 430, última reforma encontrada dic-2023), la Res. 25-14/25-17 de anulación, la Res. 24-22 de multas, la Res. 26-27 de proveedores (jul-2026) y la Ficha Técnica offline v2.34. Los cambios que más afectan a un software nuevo son: transmisión inmediata desde el 1-ene-2026, anulación solo hasta el día 7 del mes siguiente y prohibición de anular facturas a consumidor final.

### Cited Findings
**Jerarquía vigente**
- **Ley de Comercio Electrónico, Firmas y Mensajes de Datos** (Ley 67, Suplemento R.O. 557, 17-abr-2002): última reforma 7-feb-2023 en la copia Lexis; art. 8 regula la conservación y la Disposición General Novena define factura electrónica. [P, copia de terceros] — [LCE consolidada Lexis 2026](https://lotaip.bomberosquito.gob.ec/transparencia/2026/archivos/lcefmd26.pdf). El SRI lista la ley y su reglamento (R.O. 735) como base legal — [SRI Facturación electrónica](https://www.sri.gob.ec/facturacion-electronica).
- **LRTI**: arts. 64 y 103 (obligación de emitir) y artículo agregado a continuación del 103 (multa), introducido por la Ley de Eficiencia Económica y Generación de Empleo, Suplemento R.O. 461, 20-dic-2023. [P, vía considerandos] — [Res. NAC-DGERCGC24-00000022](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Reglamento de Comprobantes de Venta, Retención y Documentos Complementarios** (D.E. 430, R.O. 247, 30-jul-2010). La versión consolidada del SRI declara última modificación en 2S R.O. 467, 29-dic-2023 (D.E. 99). Su Disposición General Sexta habilita la emisión electrónica. [P] — [Reglamento consolidado SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Res. NAC-DGERCGC18-00000233** (2S R.O. 255, 5-jun-2018): norma madre de emisión, entrega y transmisión. Derogó la NAC-DGERCGC14-00790. [P] — [Res. 18-233](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Reformas a la 18-233**:
  - NAC-DGERCGC19-00000023 (solo Disp. Quinta, liquidaciones de compra) — [lista SRI](https://www.sri.gob.ec/facturacion-electronica).
  - **NAC-DGERCGC22-00000024** (2S R.O. 80, 9-jun-2022): masificación; sustituye art. 8 (excepción física con tope 1%) y Disp. Gral. Segunda (herramienta gratuita "podrá" mantenerse). [P] — [Res. 22-24](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
  - **NAC-DGERCGC22-00000043** (firmada 23-sep-2022; R.O. 157 según lista SRI): actualiza art. 3 y agrega autorización de oficio. [P] — [Res. 22-43](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=3f59b863-ac52-4049-9476-780597aec41a&nombre=NAC-DGERCGC22-00000043.pdf).
  - **NAC-DGERCGC22-00000064** (firmada 29-dic-2022): art. 7 a 72 horas y **eliminó el 2.º inciso del art. 7** (envío agrupado por masivos en 24 h). [P] — [Res. 22-64](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=a85eee51-d15f-4af8-8599-649517bd5170&nombre=NAC-DGERCGC22-00000064.pdf).
  - **NAC-DGERCGC24-00000035** (30-oct-2024): art. 7 a cuatro días hábiles y disposición transitoria de 5% físico mientras dure la emergencia eléctrica. [P] — [Res. 24-35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=cc5462d4-45df-494e-97f4-00aa3eda851b&nombre=NAC-DGERCGC24-00000035.pdf).
  - **NAC-DGERCGC25-00000014** (3S R.O. 70, 30-jun-2025): elimina los cuatro días hábiles y agrega al art. 5 el deber de informar cambios de estado al receptor. [P] — [Res. 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Anulación**: Res. 25-14 reformada por **NAC-DGERCGC25-00000017** (firmada 29-jul-2025). [P] — [Res. 25-17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Multas**: NAC-DGERCGC24-00000022 (firmada 6-jun-2024). [P] — [Res. 24-22](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Proveedores**: **NAC-DGERCGC26-00000027** (firmada 27-jul-2026; vigor desde publicación). [P, PDF con membrete SRI alojado por tercero] — [Res. 26-27](https://productos.tribuexcel.com/wp-content/uploads/2026/07/NAC-DGERCGC26-00000027.pdf). Publicada en Quinto Suplemento R.O. 335, 28-jul-2026 — [Lexis](https://www.lexis.com.ec/noticias/sri-crea-registro-obligatorio-de-proveedores-de-facturacion-electronica).
- **Ficha Técnica offline v2.34** (cambio fechado 27-jul-2026, agrega Anexo 26): vinculante según art. 4 de la 18-233. [P] — [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf); [Res. 18-233](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).

**Derogado o superado (no aplicar)**
- **72 horas / 4 días hábiles para transmitir**: superado desde 1-ene-2026 (ver pregunta 4). [P] — [Res. 25-17, literal f](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **90 días para anular** (art. 7 de NAC-DGERCGC16-00000092): derogado por la 25-14. [P] — [Res. 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Límite de 12 meses para notas de crédito** de la versión original del art. 5 de la 25-14: sustituido por la 25-17 antes de aplicarse. [P] — [Res. 25-17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Regla USD 200 consumidor final**: reemplazada por USD 50 (D.E. 586, 2022). [P] — [Reglamento art. 19.1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Claves de contingencia**: eliminadas en Ficha v2.0 (2015). [P] — [Ficha 2.34, control de cambios](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Documentos oficiales todavía publicados pero desactualizados**: las [Preguntas frecuentes](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf) (creadas jun-2023) aún dicen 72 horas (P36-37) y 90 días (P29); la [Guía de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/c97242e6-c271-4eb8-8f6a-f687313118ba/Guia%20para%20contribuyentes%20de%20anulaci%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos.pdf) (mar-2025) aún dice 90 días. No usarlas para plazos.
- **Facturador Electrónico Gratuito off-line** (programa de escritorio): descargable hasta el 31-dic-2026; el SRI remite al Facturador SRI en línea como reemplazo. [P] — [SRI herramienta](https://www.sri.gob.ec/herramienta-de-comprobantes-electronicos).

### Inferences
- [I] El texto vigente del art. 7, 1.er inciso, resulta de suprimir la frase de la 24-35: transmisión "en el momento mismo" de generar el comprobante, sin ventana numérica.
- [I] Búsquedas orientadas no mostraron decreto 2024-2026 que reforme el Reglamento, pero la ausencia de hallazgo no prueba que no exista.

### Gaps
- No verifiqué en el Registro Oficial el número de R.O. de 22-64, 24-22, 24-35 y 25-17; la lista del SRI no los da. Un resumen de búsqueda atribuyó la 25-17 al R.O. 92 de 31-jul-2025, sin fuente identificable; el boletín del SRI la fecha el 30-jul-2025.
- La página de normativa del SRI consultada llega a 2025 y no lista la 26-27; no encontré esa resolución en sri.gob.ec, aunque la Ficha 2.34 oficial la incorpora.
- No confirmé si el Reglamento del SRI tiene versión consolidada posterior a dic-2023.
- Reformas de 2023 a la Ley de Comercio Electrónico: confirmada la fecha, no el contenido artículo por artículo.

## 2. ¿Se necesita autorización o registro nuevo para emitir desde software propio? ¿Qué hay que hacer en SRI en Línea?

### Takeaway
No existe certificación ni aprobación del software, ni hace falta un proveedor tercero. La autorización del SRI es del contribuyente, no del sistema, y es indefinida. Un emisor ya autorizado en producción (requisito del Facturador) debería solo: activar el ambiente de pruebas, validar su sistema contra la Ficha y pasar a producir con su firma.

### Cited Findings
- **El SRI no autoriza ni califica sistemas de facturación**; cada comprobante se valida al recibirlo por web service. [P] — [FAQ P35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf). (La pregunta trata de taxistas, pero la frase es general.)
- **Software propio o contratado está expresamente permitido**. [P] — [Res. 22-24, Disp. Reformatoria Primera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf); [Guía de autorización](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/522a42ed-89c4-4ecd-978f-88c1afcd926c/Gu%c3%ada%20para%20solicitar%20autorizaci%c3%b3n%20de%20emisi%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos%2025042020%5b3052%5d%20(1)-1.pdf); [FAQ P3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Responsabilidad**: el emisor debe garantizar que el sistema cumple el Reglamento y resoluciones. [P] — [Ficha 2.34, 4.3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf); [Res. 18-233, Disp. Tercera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Autorización de oficio**: desde 2022 el SRI puede autorizar de oficio en pruebas y producción a los obligados. [P] — [Res. 22-43](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=3f59b863-ac52-4049-9476-780597aec41a&nombre=NAC-DGERCGC22-00000043.pdf). La guía dice que ya no es necesario solicitarla y que se concede varias veces al día. [P] — [Guía de autorización](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/522a42ed-89c4-4ecd-978f-88c1afcd926c/Gu%c3%ada%20para%20solicitar%20autorizaci%c3%b3n%20de%20emisi%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos%2025042020%5b3052%5d%20(1)-1.pdf).
- **Cómo verificar**: SRI en Línea > Facturación Electrónica > Consulta de emisores autorizados. [P] — [Guía de autorización](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/522a42ed-89c4-4ecd-978f-88c1afcd926c/Gu%c3%ada%20para%20solicitar%20autorizaci%c3%b3n%20de%20emisi%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos%2025042020%5b3052%5d%20(1)-1.pdf). También catastro y buzón. [P] — [FAQ P6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Solicitud manual**: Facturación Electrónica > Pruebas (o Producción) > Autorización > Solicitud de emisión > Siguiente; se genera PDF de aprobación o rechazo con el motivo. [P] — [Guía de autorización](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/522a42ed-89c4-4ecd-978f-88c1afcd926c/Gu%c3%ada%20para%20solicitar%20autorizaci%c3%b3n%20de%20emisi%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos%2025042020%5b3052%5d%20(1)-1.pdf). Sin costo y en línea 24 h. [P] — [gob.ec](https://www.gob.ec/sri/tramites/autorizacion-ambientes-pruebas-comprobantes-electronicos).
- **Art. 3 de la 18-233**: pruebas "por única vez"; aprobada, se ajustan los sistemas a la Ficha; luego producción con vigencia indefinida. [P] — [Res. 18-233](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Pruebas**: sin validez tributaria, sin límite de tiempo. El Facturador SRI no tiene ambiente de pruebas: todo lo que emite vale. [P] — [FAQ P4, P7](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Ficha 4.3**: la solicitud se hace una sola vez por ambiente; el solicitante debe estar activo, al día y con **convenio de débito** registrado (NAC-DGERCGC18-00000108); la solicitud en pruebas es "obligatoria para todos los solicitantes"; no hacer pruebas de estrés. [P] — [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Ficha 4.4 y 4.9**: en la solicitud se escoge el tipo de comprobante y luego se pueden agregar otros. [P] — [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Producción previa**: la FAQ pide haber pasado primero por pruebas. [P] — [FAQ P8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Facturador**: exige autorización en producción, así que quien ya lo usa debería tenerla. [P] — [SRI Facturador](https://www.sri.gob.ec/facturador-sri).
- **Requisitos del emisor**: firma electrónica obtenida con RUC, clave SRI en Línea, Internet y software. [P] — [Guía de autorización](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/522a42ed-89c4-4ecd-978f-88c1afcd926c/Gu%c3%ada%20para%20solicitar%20autorizaci%c3%b3n%20de%20emisi%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos%2025042020%5b3052%5d%20(1)-1.pdf). Lista de entidades de certificación — [SRI](https://www.sri.gob.ec/facturacion-electronica).
- **Firma**: cada comprobante debe ir firmado solo por el emisor, quien responde de mantener vigente el certificado. [P] — [Res. 18-233, art. 4](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Registro de proveedores (Res. 26-27)**: aplica a quien desarrolla o posee el código fuente de sistemas **con finalidad de comercializarlos**, o licencias y código de terceros con igual fin; deben registrar un establecimiento exclusivo en el RUC con CIIU J62021002 o J62021003. [P] — [Res. 26-27, arts. 2-3](https://productos.tribuexcel.com/wp-content/uploads/2026/07/NAC-DGERCGC26-00000027.pdf).
- **RUC del proveedor en el XML**: el art. 5 exige a "los emisores" incluirlo en información adicional conforme a la Ficha; plazo 60 días calendario desde publicación. [P] — [Res. 26-27](https://productos.tribuexcel.com/wp-content/uploads/2026/07/NAC-DGERCGC26-00000027.pdf). La Ficha lo limita a quienes usen **sistemas de terceros**: `<campoAdicional nombre="RUC Proveedor">`, máximo 300 caracteres. [P] — [Ficha 2.34, Anexo 26](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Desarrollo interno**: secundarias indican que uso solo interno no convierte en proveedor [S] — [Boletín Contable](https://boletincontable.com/2026/07/29/proveedores-facturacion-electronica-registro-sri/); otras advierten que queda sin definir qué RUC poner [S] — [Nerux](https://nerux.app/guia/facturacion-sri/ruc-proveedor-factura-electronica-resolucion-sri).
- **Pago por débito**: la falta de débito automático para emisores electrónicos aparece como falta reglamentaria. [P] — [Anexo de sanciones, código 78](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f809e92d-3497-4398-bedd-3e07f3db1f59/ANEXO%20AL%20INSTRUCTIVO%20PARA%20LA%20APLICACI%C3%93N%20DE%20SANCIONES%20PECUNIARIAS.pdf).

### Inferences
- [I] **Pasos concretos para este caso**: (1) confirmar en Consulta de emisores autorizados la fecha en producción y si ya hay autorización en pruebas; (2) si no la hay, solicitarla; (3) verificar convenio de débito y estado al día; (4) tener certificado .p12 vigente con RUC; (5) elegir punto de emisión (pregunta 3); (6) probar en pruebas contra la Ficha; (7) cambiar a producción. No debería requerirse una segunda autorización de producción, porque esta es del contribuyente y de vigencia indefinida.
- [I] **Firma**: nada de lo leído obliga a un certificado distinto para el software propio.
- [I] **Campo "RUC Proveedor"**: con software realmente propio y no comercializado, la lectura de la Ficha exime de incluirlo. El art. 5 es más amplio que el Anexo 26, así que incluir el propio RUC sería una opción conservadora, no un mandato; conviene confirmarlo con el SRI.
- [I] **Riesgo de clasificación**: si el desarrollador y el emisor son RUC distintos (p. ej. el POS se licencia a un restaurante), el desarrollador pasa a ser proveedor y el restaurante debe consignar su RUC. Lo mismo si se usa un tercero para firmar o transmitir. Si el POS se vende a otros, aplica el registro de 30 días.

### Gaps
- No hay texto primario para "contribuyente ya en producción por el Facturador que migra a software propio"; los pasos son inferencia.
- No verifiqué en vivo las pantallas de SRI en Línea; requieren sesión.
- Sin aclaración oficial sobre el campo "RUC Proveedor" para desarrollos propios.
- No confirmé si el listado de proveedores ya se publicó (previsto desde octubre de 2026).

## 3. ¿Se puede usar Facturador SRI y software propio a la vez? ¿Cómo se manejan secuencial, establecimiento y punto de emisión?

### Takeaway
Ninguna norma leída prohíbe el uso simultáneo, y el manual oficial prevé que un punto de emisión venga de "otro sistema de facturación". El SRI no coordina numeración: es responsabilidad del emisor. La vía segura es dar al software un punto de emisión propio con secuencial en 1, sin compartirlo con el Facturador.

### Cited Findings
- **Puntos de emisión**: en cada establecimiento se pueden ubicar uno o más según necesidades operativas, numerados desde 001. [P] — [Reglamento art. 26](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Exclusividad por modalidad**: los emisores electrónicos deben asignar puntos de emisión exclusivos para esta modalidad. [P] — [Res. 18-233, art. 3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf). Rige frente a físicos, no entre sistemas electrónicos, en su texto.
- **Facturador, creación de punto**: Configuración > Puntos de emisión > Crear/Editar; se elige un establecimiento activo en el RUC; número de 1 a 999, distinto al usado en físicos. [P] — [Manual Facturador SRI, 4.3.1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf).
- **Secuencial inicial en el Facturador**: 0 para punto nuevo (primer comprobante = 1); si el punto ya se usó en otro sistema, poner el último secuencial emitido. [P] — [Manual, 4.3.1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf). Se configura **por tipo de comprobante**; el aplicativo emite el siguiente al valor guardado. [P] — [Manual](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf).
- **Responsabilidad**: el emisor responde por la configuración, la secuencialidad y por evitar duplicados, que el manual trata como infracción sancionable. [P] — [Manual](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf).
- **Precarga**: el Facturador muestra puntos de los últimos 6 meses antes de sep-2023; después, el emisor debe parametrizarlos. [P] — [Manual, nota 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf).
- **Activar/inactivar**: un punto puede inactivarse y reactivarse en el Facturador. [P] — [Manual, 4.3.2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/016ec0eb-6c25-445c-b929-6ca971cf1df1/Manual%20de%20usuario%20-%20facturador_SRI.pdf).
- **Control en el sistema**: el contribuyente debe implementar controles para emitir en orden cronológico y secuencial, sin duplicidad en secuencia ni claves de acceso, y sin reenvíos innecesarios. [P] — [Ficha 2.34, 9.18](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **SRI rechaza duplicados**: error 45 "Secuencial registrado". [P] — [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Formato**: secuencial de nueve dígitos con ceros a la izquierda. [P] — [Res. 18-233, Disp. Gral. Primera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf). Código de punto de emisión numérico de 3 dígitos. [P] — [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Rechazados**: se reenvían con la misma clave de acceso y secuencial. [P] — [Ficha 5.10](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf); [Res. 18-233, art. 9](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).

### Inferences
- [I] **Establecimiento compartido**: el código de establecimiento es del RUC, así que Facturador y software comparten el mismo 001 si operan en el mismo local.
- [I] **Punto de emisión no se tramita ante el SRI**: el manual lo crea por configuración y el software solo lo informa en el XML; no hallé trámite de registro para electrónicos. Es diferente del establecimiento, que sí debe estar activo en el RUC.
- [I] **Recomendación**: Facturador sigue en su punto (p. ej. 001-001) y software en 001-002 con secuencial desde 000000001. Mantener el Facturador como respaldo en su serie. Si se quisiera reusar 001-001, habría que partir del último secuencial por tipo de documento e inactivar el punto en el Facturador.
- [I] El Facturador solo conoce sus puntos configurados y el software no consulta el secuencial del Facturador, de modo que compartir punto y usar ambos a la vez genera colisiones (error 45) y desorden cronológico.

### Gaps
- No encontré pronunciamiento del SRI que autorice o prohíba expresamente el uso simultáneo; es ausencia de prohibición más la previsión del manual.
- El manual no indica fecha de edición visible; no confirmé una versión más reciente.

## 4. ¿En qué plazo debe enviarse el comprobante al SRI y al comprador?

### Takeaway
Desde el 1-ene-2026 la transmisión es en el momento mismo de generar el comprobante, sin ventana de horas. La entrega al cliente también es en el momento de la transacción. Si el SRI rechaza o devuelve, hay 24 horas para corregir y retransmitir.

### Cited Findings
- **Evolución del art. 7**: 18-233 original "momento mismo de realizarse la transacción" → 22-64: hasta 72 h → 24-35: hasta 4 días hábiles → 25-14: elimina la frase. [P] — [Res. 22-64](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=a85eee51-d15f-4af8-8599-649517bd5170&nombre=NAC-DGERCGC22-00000064.pdf); [Res. 24-35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=cc5462d4-45df-494e-97f4-00aa3eda851b&nombre=NAC-DGERCGC24-00000035.pdf); [Res. 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Fecha efectiva**: la 25-17 difirió el numeral 2 de la Disposición Reformatoria Primera al 1-ene-2026. [P] — [Res. 25-17, literal f](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf). Confirmado por el SRI — [Boletín NAC-COM-25-072, 30-dic-2025](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/871db08d-cefa-467e-b418-4e4b24427334/BOLET%C3%8DN%20072%20-%20SRI%20FORTALECE%20LA%20MODERNIZACI%C3%93N%20TRIBUTARIA%20CON%20LA%20TRANSMISI%C3%93N%20OBLIGATORIA%20DE%20COMPROBANTES%20DE%20VENTA.pdf). Esto resuelve el conflicto con fuentes que decían 1-ago-2025.
- **Medio**: web services de la Ficha. [P] — [Res. 24-35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=cc5462d4-45df-494e-97f4-00aa3eda851b&nombre=NAC-DGERCGC24-00000035.pdf).
- **Sin agrupación por masivos**: el 2.º inciso fue eliminado. [P] — [Res. 22-64](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=a85eee51-d15f-4af8-8599-649517bd5170&nombre=NAC-DGERCGC22-00000064.pdf).
- **Rechazado/devuelto**: rectificar, retransmitir en 24 horas y notificar al receptor. [P] — [Res. 18-233, art. 9](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Validez y transmisión**: se entiende que el comprobante de un autorizado en producción cuenta con autorización, sin perjuicio de su posterior transmisión. [P] — [Res. 18-233, art. 4](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf). En offline la clave de acceso de 49 dígitos es el número de autorización. [P] — [Ficha 5.9](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Entrega**: en general al momento del acto o contrato. [P] — [Reglamento art. 17.a](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf). En ventas pactadas por medios electrónicos con pago por tarjeta, abono o contra entrega: junto con el bien o por mensaje de datos. [P] — [Reglamento art. 17.b](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Orden en Ficha**: una vez autorizado, entregar al receptor. [P] — [Ficha 4.8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf). La FAQ dice que no es necesario transmitir antes de entregar, pero esa respuesta se apoya en las 72 h. [P, desactualizada] — [FAQ P37](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Falla del sistema**: por fuerza mayor o caso fortuito se puede emitir preimpreso, hasta 1% anual. [P] — [Res. 22-24](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
- **Infracciones independientes**: no entregar y no transmitir son dos obligaciones e infracciones distintas. [P] — [Res. 18-233, art. 7](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Condición de "sí transmitió"**: dentro del plazo, pasando validaciones y con los mismos valores de la transacción. [P] — [Res. 24-22, art. 1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Retención**: el comprobante de retención tiene otro plazo. [P] — [Reglamento art. 8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf). Fuera de alcance aquí.

### Inferences
- [I] **Para POS**: el envío a `recepcion` debe dispararse al cerrar el comprobante, no en lote al final del día. Un reintento automático con cola es defendible como operación, pero no hay norma que defina tolerancia.
- [I] **"Mismo día" no es la regla**: la norma no dice mismo día ni 24 h. Blogs que hablan de "mismo día" simplifican. Las 24 h del art. 9 solo aplican a rechazados o devueltos.
- [I] **Si cae el SRI o Internet**: ya no hay clave de contingencia ni ventana. Lo prudente es emitir offline, encolar, registrar evidencia de la caída y transmitir apenas vuelva el servicio. No está regulado de forma expresa si esto cuenta como fuerza mayor.

### Gaps
- No existe en lo leído definición numérica de "momento mismo", ni trato expreso para caídas del servicio del SRI. Es el mayor vacío operativo; conviene consulta al SRI.
- No verifiqué el umbral del error 65 "Fecha de emisión extemporánea" de la Ficha.
- No confirmé si existe boletín del SRI sobre tolerancias.

## 5. ¿Cómo se cumple la entrega del comprobante y RIDE? ¿Qué pasa si el cliente no tiene correo?

### Takeaway
La entrega se cumple enviando XML y RIDE al correo del cliente; si no hay correo, no hay identificación o el cliente lo pide, se imprime y entrega el RIDE. Enviar solo uno de los dos archivos equivale a no entregar.

### Cited Findings
- **Alternativa 1**: enviar exitosamente XML + RIDE al correo proporcionado; además se puede ofrecer portal web. [P] — [Res. 18-233, art. 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Alternativa 2**: imprimir y entregar RIDE solo si (a) no se puede cumplir lo anterior, (b) no se identifica al adquirente, (c) el adquirente lo requiere, o (d) liquidaciones de compra. [P] — [Res. 18-233, art. 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Validez**: el RIDE impreso tiene igual validez tributaria. [P] — [Res. 18-233, art. 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Sin correo**: entregar RIDE. [P] — [FAQ P16, P21](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Falta de entrega**: omisión del envío, indisponibilidad o tener solo XML o solo RIDE constituye falta de entrega, aun si se transmitió al SRI. [P] — [Res. 18-233, art. 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Obligación pese a que el cliente no lo pida**. [P] — [Res. 18-233, art. 5](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf); [Reglamento art. 8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Consentimiento**: hay que contar con el del consumidor antes de emitir y entregar, e instruirlo sobre cómo acceder. [P] — [Res. 18-233, art. 5](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Cambios de estado**: se debe informar al receptor toda modificación del estado del comprobante. [P] — [Res. 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Sin cobro** por emitir o entregar. [P] — [FAQ P22](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Contenido del RIDE**: Reglamento + Ficha; sin clave de acceso no tiene validez; debe coincidir con el XML. [P] — [FAQ P14, P20](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf). Se pueden imprimir datos adicionales. [P] — [Ficha 9.19](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Otros medios**: portal, SMS, etc. son adicionales al correo. [P] — [Ficha 4.7](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **Cliente que exige factura preimpresa**: informar que es electrónica y dar RIDE si lo pide. [P] — [FAQ P17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).

### Inferences
- [I] **Para POS**: guardar por factura estado y evidencia de envío de correo; ante rebote, activar RIDE impreso. "Enviado exitosamente" hace que un rebote sin alternativa sea un riesgo.
- [I] **WhatsApp**: no reemplaza por sí solo la alternativa 1; solo sería adicional.

### Gaps
- No hay detalle normativo sobre qué prueba "envío exitoso", ni forma del consentimiento (verbal o escrito).
- Formato mínimo del RIDE en tirilla térmica: no verificado aquí.

## 6. ¿Cuánto tiempo, en qué formato y quién debe conservar los XML?

### Takeaway
Siete años, tanto emisor como receptor. Lo que se conserva es el XML, no el RIDE, incluidos los anulados, y debe estar disponible ante requerimiento del SRI.

### Cited Findings
- **Plazo**: 7 años para emisor y receptor, sin perjuicio del registro del SRI. [P] — [Res. 18-233, art. 11](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Reglamento**: mínimo 7 años (reformado por D.E. 99, 2023). Los autorizados por medios electrónicos deben mantener archivo magnético en la forma que determine el SRI, disponible ante requerimiento. [P] — [Reglamento art. 41](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Anulados**: comprobantes con errores y anulados también siete años, ordenados cronológicamente. [P] — [Reglamento art. 50](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **XML, no RIDE**: no es obligatorio archivar el RIDE; se debe archivar el XML. [P] — [FAQ P18-19](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Condiciones de conservación**: accesible, en el formato generado o uno demostrablemente exacto, con datos de origen, destino y fecha/hora, e integridad garantizada. Puede usarse un tercero si cumple. [P, copia] — [LCE art. 8](https://lotaip.bomberosquito.gob.ec/transparencia/2026/archivos/lcefmd26.pdf).
- **Recuperación**: el portal permite consultar y recuperar autorizados. [P] — [FAQ P24](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).

### Inferences
- [I] Guardar el XML firmado byte a byte, más el XML/respuesta de autorización, con hash y backups. No regenerar desde base de datos, porque rompería la firma.
- [I] La consulta en el portal no sustituye el archivo propio: el art. 11 pone la obligación en el sujeto pasivo.

### Gaps
- No encontré resolución que fije formato o medio específico de archivo más allá del XML; el art. 41 remite a lo que determine el SRI.
- No leí el art. 9 del Reglamento a la LCE (concordancia del art. 8).

## 7. ¿Cómo se anula una factura electrónica? Plazos, aceptación y cuándo es obligatoria la nota de crédito

### Takeaway
Factura identificada: anulación en línea hasta el día 7 del mes siguiente, sin aceptación formal del receptor; después, nota de crédito. Factura a "consumidor final": desde el 1-ene-2026 no se anula ni admite nota de crédito. El software debe prevenir ese error antes de enviar.

### Cited Findings
- **Causales**: errores o que la operación no se haya producido. [P] — [Res. 25-14, art. 1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Medios**: comprobantes de venta, en línea o con nota de crédito; retenciones y documentos complementarios, solo en línea. [P] — [Res. 25-14, art. 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Canal**: portal web institucional, o Facturador SRI **cuando se emitió en ese aplicativo**. [P] — [Res. 25-14, art. 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Plazo**: hasta el **día 7** del mes siguiente al de emisión; si cae en descanso o feriado, siguiente día hábil. Inicialmente era día 10. [P] — [Res. 25-14, art. 3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf); [Res. 25-17, art. 1.a](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf). Aplica a comprobantes emitidos desde 1-ago-2025. [P] — [Res. 25-17, literal e](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Después del plazo**: solo nota de crédito. [P] — [Res. 25-14, art. 3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Consumidor final**: no se anula una vez emitida y transmitida, ni procede nota de crédito; rige desde 1-ene-2026. [P] — [Res. 25-14, art. 3](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf); [Res. 25-17, literal f](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Excepción oficial**: en controles con fedatarios fiscales, el SRI puede anular de oficio esas facturas. [P] — [Res. 25-17, literal d](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Aceptación del receptor**: exigida para retenciones, notas de crédito y de débito; 5 días hábiles; sin respuesta, la solicitud queda sin efecto y el comprobante sigue válido. [P] — [Res. 25-14, art. 4](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf). Excepciones: receptor del exterior o fallecido. [P] — [Res. 25-17, literal b](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf).
- **Factura**: se anula al aceptar en el sistema, sin proceso posterior. [P] — [Guía de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/c97242e6-c271-4eb8-8f6a-f687313118ba/Guia%20para%20contribuyentes%20de%20anulaci%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos.pdf); [FAQ P28](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf). Aun así la FAQ pide contar antes con el consentimiento del receptor. [P] — [FAQ P28](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Irreversible**: no se puede revertir una anulación; se emite nuevo comprobante. [P] — [FAQ P27](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Estados**: "Pendiente de anular" conserva validez; "Anulado" no. [P] — [Guía de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/c97242e6-c271-4eb8-8f6a-f687313118ba/Guia%20para%20contribuyentes%20de%20anulaci%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos.pdf).
- **Pasos**: SRI en Línea > Anulación > Solicitud; tipo, fecha de autorización, clave de acceso, autorización, identificación y correo del receptor. [P] — [Guía de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/c97242e6-c271-4eb8-8f6a-f687313118ba/Guia%20para%20contribuyentes%20de%20anulaci%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos.pdf). Identificación tal como consta en el XML. [P] — [Guía de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/c97242e6-c271-4eb8-8f6a-f687313118ba/Guia%20para%20contribuyentes%20de%20anulaci%c3%b3n%20de%20comprobantes%20electr%c3%b3nicos.pdf).
- **Notas de crédito**: "únicamente" en casos del Reglamento (anular operaciones, devoluciones, descuentos o bonificaciones); el SRI puede verificar el uso. Sin plazo de 12 meses. [P] — [Res. 25-17, literal c](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf); [Reglamento art. 15](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Identificación en NC**: obligatorio identificar al receptor; no cabe consumidor final. [P] — [Ficha 2.34, nota a la Tabla 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf). Requisitos: [Reglamento art. 25](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **No anulables**: factura comercial negociable negociada; comprobantes que sustentan devolución de impuestos. [P] — [Res. 25-14, Disp. Segunda y Tercera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Masivo**: trámite si superan 1.000 en el mes, dentro de los plazos. [P] — [Res. 25-14, Disp. Cuarta](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).
- **Corroboración**: resumen de abogados coincide. [S] — [NMS Law](https://nmslaw.com.ec/?p=15928).

### Inferences
- [I] **Facturas del software**: se anulan en el portal SRI en Línea, no en el Facturador. En la Ficha 2.34 no encontré web service general de anulación; los códigos 6000+ son del servicio de devolución de IVA. La anulación sería manual o quedaría como flujo guiado desde el POS.
- [I] **Control preventivo**: antes de autorizar una factura con 9999999999999, pedir confirmación de datos. Un error de monto o forma de pago en consumidor final no tiene corrección.
- [I] **Datos errados en factura identificada**: anular hasta el día 7 y reemitir con otro secuencial; después, nota de crédito y nueva factura si corresponde.
- [I] **Conteo**: una factura del 3-nov-2026 se puede anular hasta el 7-dic-2026.

### Gaps
- No hay guía del SRI actualizada al día 7. La de mar-2025 mantiene 90 días.
- No está claro qué pasa con un cliente que al momento pide identificarse después de facturar como consumidor final: una secundaria sugiere nota de crédito [S] — [Siigo](https://www.siigo.com/ec/blog/obligaciones-fiscales/factura-consumidor-final/), lo que contradice el texto primario; no aplicarlo sin confirmar.
- Tratamiento de devoluciones reales de consumidor final (no error): no resuelto en lo leído.

## 8. ¿Qué multas, contravenciones y clausura aplican?

### Takeaway
Por no entregar o no transmitir, multa por infracción de 1 a 30 RBU según tipo de contribuyente (USD 482 en 2026), además de clausura de 7 días por no entregar y 10 en reincidencia. La transmisión tardía, o la que no cuadra con la transacción real, se sanciona como no transmisión.

### Cited Findings
- **Base legal**: artículo agregado a continuación del 103 LRTI, multa de 1 a 30 RBU; en flagrancia basta el acta del funcionario. [P, vía considerandos] — [Res. 24-22](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **"No entregar" incluye**: físicos caducados, electrónicos sin estar autorizado, autorización de otro contribuyente, o no autorizados. [P] — [Res. 24-22, art. 1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Tabla por infracción** [P] — [Res. 24-22, art. 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf). Valor USD calculado [I] con RBU 2026 de USD 482 ([NMS Law, AM MDT-2025-195](https://nmslaw.com.ec/blog/2025/12/22/ecuador-salario-basico-unificado-2026/)):

| Contribuyente | No entregar | No transmitir |
|---|---|---|
| Gran contribuyente / grandes patrimonios | 20 RBU (USD 9.640) | 30 RBU (USD 14.460) |
| Contribuyente especial | 10 RBU (USD 4.820) | 15 RBU (USD 7.230) |
| Sociedades con fin de lucro, sucesiones y PN obligadas a contabilidad | 7 RBU (USD 3.374) | 10 RBU (USD 4.820) |
| Sociedades sin fines de lucro | 4 RBU (USD 1.928) | 5 RBU (USD 2.410) |
| Sucesiones y PN no obligadas a contabilidad | 4 RBU (USD 1.928) | 5 RBU (USD 2.410) |
| Negocios populares RIMPE | 1 RBU (USD 482) | 1 RBU (USD 482) |
| No inscritos en RUC | 1 RBU (USD 482) | 1 RBU (USD 482) |

- **Categoría**: se determina a la fecha de la infracción. [P] — [Res. 24-22, art. 2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Clausura**: 7 días por no entregar o entregar sin requisitos; reincidencia, 10 días y hasta pagar lo adeudado. Sellos en físicos o bloqueo en establecimientos electrónicos. Base: Disposición General Séptima, Ley para la Reforma de las Finanzas Públicas. [P, vía considerandos] — [Res. 24-22](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=02272baf-02db-4b03-bf07-67b85a46629b&nombre=NAC-DGERCGC24-00000022.pdf).
- **Código 106**: el anexo lista "No entregar comprobantes" como clausura / pecuniaria, sanción especial hasta 30 RBU. [P] — [Anexo de sanciones](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f809e92d-3497-4398-bedd-3e07f3db1f59/ANEXO%20AL%20INSTRUCTIVO%20PARA%20LA%20APLICACI%C3%93N%20DE%20SANCIONES%20PECUNIARIAS.pdf).
- **Otras en el anexo**: código 39 no emitir; 105 emisión tardía o falta de oportunidad; 45 errores de llenado (identificación, IVA, 10% de servicio, fecha, etc.). [P] — [Anexo de sanciones](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f809e92d-3497-4398-bedd-3e07f3db1f59/ANEXO%20AL%20INSTRUCTIVO%20PARA%20LA%20APLICACI%C3%93N%20DE%20SANCIONES%20PECUNIARIAS.pdf).
- **Física >1%**: excederla es infracción sancionable. [P] — [Circular 22-00000003](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=43dfea76-a457-4e1a-83d6-26a054412975&nombre=NAC-DGECCGC22-00000003.pdf).
- **Sustento del comprador**: un comprobante no transmitido a tiempo se denuncia, sin perjuicio de que afecte su validez. [P] — [Res. 18-233, art. 10](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Control posterior** por veracidad y no transmisión. [P] — [Res. 18-233, art. 12](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Secundaria en conflicto**: prensa menciona clausura "hasta tres meses". [S] — [Extra](https://www.extra.ec/noticia/servicios-y-tramites/negocios-niegan-dar-factura-denunciarlos-multa-reciben-154089.html). No concuerda con la 24-22, que debe prevalecer.

### Inferences
- [I] Multa "por cada acción u omisión": en teoría cada comprobante podría ser una infracción. Un fallo masivo de cola sería costoso.
- [I] Transmitir valores distintos a los cobrados, por ejemplo en diferencias de redondeo o cierre, entra en el literal c) del art. 1.2 de la 24-22. El POS debe transmitir exactamente lo facturado.

### Gaps
- No leí el texto consolidado del artículo agregado al 103 LRTI (la copia del SRI llega a 2019) ni la Disposición Séptima directamente; ambos vienen por considerandos oficiales.
- No verifiqué montos de las categorías A/B/C del instructivo, ni los rangos del art. 349 del Código Tributario.
- No hay aclaración de si multa y clausura son acumulables en cada caso.

## 9. ¿Qué reglas aplican a consumidor final y límites sin identificación?

### Takeaway
Hasta USD 50 se puede usar la leyenda "CONSUMIDOR FINAL" si el comprador no necesita sustentar costos o crédito tributario. Sobre ese valor hay que identificar al adquirente. El cambio de 2026 no fue el monto sino la imposibilidad de anular esas facturas.

### Cited Findings
- **Regla**: identificación obligatoria si requiere sustentar costos, gastos o crédito tributario; en caso contrario y si no supera USD 50, puede usarse la leyenda y omitir datos de los números 4 a 7. Reformado por D.E. 586, 3S R.O. 186, 10-nov-2022. [P] — [Reglamento art. 19.1](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Ficha**: tipo 07, identificación 9999999999999; mayor a USD 50 exige datos del adquirente. [P] — [Ficha 2.34, Tabla 6 y 9.10](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf). Actualización del monto en v2.23 (2023). [P] — [Ficha, control de cambios](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf).
- **SRI FAQ**: hasta USD 50. [P] — [FAQ P34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf).
- **Sin identificación, RIDE impreso**. [P] — [Res. 18-233, art. 6](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **A petición**: si el cliente pide identificarse, debe poder emitirse con sus datos. [P] — [Reglamento art. 17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Desglose**: facturas a consumidor final sin desglose salvo gastos personales. [P] — [Reglamento art. 11](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Monto mínimo**: PN no obligadas a contabilidad facturan sobre USD 4, con factura resumen diaria del resto; sociedades y obligadas a contabilidad, siempre. [P] — [FAQ P33](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf); [Reglamento art. 8](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **Restaurantes**: la propina del 10% se consigna en establecimientos calificados y no integra la base del IVA. [P] — [Reglamento art. 19.7](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/9fb49475-f058-49a1-b08a-f31bf4deb074/Reglamento_Comprobantes_Venta_RetencionYDC_29122023.pdf).
- **RIMPE negocio popular**: blogs citan USD 200. [S] — [FacturaSoft](https://facturasoft.com/multa-por-facturar-como-consumidor-final). No hallado en el texto primario.

### Inferences
- [I] "No supera USD 50": es decir, USD 50,00 exactos todavía es admisible. Blogs afirman que incluye IVA; el texto dice "la transacción", por lo que se debe validar contra el importe total.
- [I] Restaurante: validar en el POS el total ≥ 50,01 con bloqueo de consumidor final, y facilitar captura de cédula antes de cerrar.

### Gaps
- No confirmé un límite distinto para negocios populares en texto primario.
- No encontré cambio del monto en 2025-2026; no pude descartar un decreto no indexado.

## 10. ¿Siguen siendo válidos los comprobantes físicos o preimpresos y las notas de venta?

### Takeaway
Para un emisor electrónico lo físico es solo una excepción por fuerza mayor o caso fortuito, con tope de 1% anual. Las notas de venta quedan en esencia para negocios populares RIMPE.

### Cited Findings
- **Regla**: desde 1-may-2019 los obligados emiten únicamente electrónicos en toda transacción, incluso consumidor final. [P] — [Res. 18-233, Disp. Cuarta](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf).
- **Excepción**: fuerza mayor o caso fortuito, preimpreso según Reglamento, máximo 1% del total del ejercicio anterior. [P] — [Res. 22-24, Disp. Reformatoria Primera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
- **Autorización**: solo quienes estén en producción pueden obtener preimpresos excepcionales. [P] — [Res. 22-24, Disp. Tercera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf); [Circular 22-00000003](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=43dfea76-a457-4e1a-83d6-26a054412975&nombre=NAC-DGECCGC22-00000003.pdf).
- **Antiguos**: preimpresos autorizados hasta el 29-nov-2022 no cuentan para el 1% y valen hasta caducar, si hay autorización electrónica. [P] — [Res. 22-64](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=a85eee51-d15f-4af8-8599-649517bd5170&nombre=NAC-DGERCGC22-00000064.pdf).
- **Emergencia eléctrica**: 5% temporal mientras dure la emergencia del Acuerdo MEM-MEM-2024-0027-AM. [P] — [Res. 24-35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=cc5462d4-45df-494e-97f4-00aa3eda851b&nombre=NAC-DGERCGC24-00000035.pdf).
- **Notas de venta**: negocios populares mantienen preimpresas; electrónico obligatorio para sus transacciones sin nota de venta. [P] — [FAQ P31](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf); [Res. 22-24, Disp. Primera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
- **Máquinas registradoras**: desde 30-nov-2022 solo para quienes emiten notas de venta. [P] — [Res. 22-24, Disp. Segunda](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
- **Plazos de anulación y consumidor final** también aplican a físicos. [P] — [Res. 25-14, Disp. Primera](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf).

### Inferences
- [I] Con vigencias de hasta un año, los preimpresos autorizados en 2022 ya deberían estar caducados.
- [I] Antes de depender de preimpresos como plan de contingencia, verificar que estén vigentes y autorizados.

### Gaps
- No confirmé si sigue vigente la emergencia eléctrica de 2024, y por tanto si rige el 5%; asumir 1%.

## 11. ¿Es obligatoria la facturación electrónica para todos y desde cuándo?

### Takeaway
Sí: desde el 29/30-nov-2022 para todos los obligados a facturar, con excepción parcial de los negocios populares RIMPE. Quien ya usa el Facturador ya está dentro del esquema; el software propio no cambia la obligación.

### Cited Findings
- **Ley**: Disposición Transitoria Cuarta, Ley de Desarrollo Económico y Sostenibilidad Fiscal tras la Pandemia, 3S R.O. 587, 29-nov-2021. [P, vía considerandos] — [Res. 24-35](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=cc5462d4-45df-494e-97f4-00aa3eda851b&nombre=NAC-DGERCGC24-00000035.pdf).
- **Resolución**: sujetos del IR obligados a facturar y no sujetos obligados a facturar, hasta el 29-nov-2022. [P] — [Res. 22-24, arts. 1-2](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=c508d69a-4ea4-4940-8777-fbe89fef2fac&nombre=NAC-DGERCGC22-00000024.pdf).
- **SRI**: todos obligados salvo negocios populares. [P] — [FAQ P30](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/cef82829-f261-4374-a45c-96adb2c3ace8/Preguntas+frecuentes+facturaci%F3n+electr%F3nica.pdf). Cronograma histórico — [SRI obligados](https://www.sri.gob.ec/web/intersri/contribuyentes-obligados-a-emitir-comprobantes-electronicos).
- **Sobre quién puede usar el Facturador**: todos salvo grandes contribuyentes. [P] — [SRI Facturador](https://www.sri.gob.ec/facturador-sri).
- **Resoluciones previas de cronograma**: 13-00236, 14-00157, 14-00366, 17-00000430, 18-00000191, etc. [P] — [lista SRI](https://www.sri.gob.ec/facturacion-electronica).

### Inferences
- [I] No hay "fecha pendiente" de obligatoriedad a noviembre de 2026; las fechas nuevas fueron la transmisión inmediata (1-ene-2026) y el RUC proveedor (26-sep-2026, 60 días calendario desde el 28-jul-2026).

### Gaps
- Sin hallazgo de cambios a la excepción RIMPE en 2025-2026; no se revisó la normativa RIMPE a fondo.

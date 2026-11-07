# Implementación práctica de facturación electrónica SRI en Node/TypeScript/Next.js: build vs buy (estado a 3 de noviembre de 2026)

> **Etiquetas de confianza.** `[VERIFICADO]` = lo comprobé yo: código leído estáticamente, metadatos de GitHub/npm, prueba de red propia, o documento oficial. `[PROVEEDOR]` = dicho por un vendedor sobre sí mismo o sobre un competidor. `[ANÉCDOTA]` = comunidad, comentario de código o blog sin fuente primaria. Los repos se clonaron a un directorio aislado, sin instalarse ni ejecutarse.
>
> **Datos desactualizados.** La ficha técnica que leí es la **v2.32 (octubre 2025)**, [PDF oficial](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf). El [README de ecuador-tax](https://github.com/esteban-dcp/ecuador-tax) cita una v2.34, que no conseguí. Las páginas gob.ec de trámites son de 2022.

## Librerías open source Node/TypeScript y primitivas de firma

### Takeaway
Ninguna librería gana claramente en todo. **`ec-sri-invoice-signer`** es la opción más probada para firmar (6.623 descargas/mes, 3 años de historia, MIT, sigue corrigiendo fallos reales). Para el XML y el SOAP hay poco que justifique una dependencia inmadura, porque son pocas líneas: `fetch` sin más funciona, lo comprobé. `xadesjs` está archivado: evítalo.

### Cited Findings

**Tabla comparativa** (metadatos `[VERIFICADO]` vía API de GitHub y registro npm, 3 nov 2026)

| Repo / paquete | Alcance | Último commit | Licencia | Estrellas | Descargas npm/mes | Versión factura | Primitivas | Madurez y problemas |
|---|---|---|---|---|---|---|---|---|
| [bryancalisto/ec-sri-invoice-signer](https://github.com/bryancalisto/ec-sri-invoice-signer) (npm 1.8.2, 2 sep 2026) | **Solo firma**, 6 documentos | 21 oct 2026 | MIT | 46 | **6.623** | Agnóstica: firma el XML que recibe | node-forge, xml-crypto, @xmldom, fast-xml-parser | La más usada. Pero: [#118](https://github.com/bryancalisto/ec-sri-invoice-signer/issues/118) "firma inválida" (jul 2026), arreglado en [#119](https://github.com/bryancalisto/ec-sri-invoice-signer/pull/119); [#46](https://github.com/bryancalisto/ec-sri-invoice-signer/issues/46) p12 del Banco Central; [#64](https://github.com/bryancalisto/ec-sri-invoice-signer/pull/64) módulo/exponente invertidos (oct 2025) |
| [JonathanTeran/teran-sri-ec-node](https://github.com/JonathanTeran/teran-sri-ec-node) (npm `sri-ec` 0.3.0, 6 ago 2026) | XML, firma, SOAP, RIDE (pdfkit), NestJS opcional | 6 ago 2026 | MIT | 3 | 445 | **2.1.0 fijo** en `factura.serializer.ts` | node-forge, c14n propio, fast-xml-parser, zod | Creado ago 2026. Reivindica paridad byte a byte con el PHP `amephia/sri-ec` (afirmación del autor, no comprobada). [Fork activo](https://github.com/fabricioNavarrete95/teran-sri-ec-node) hasta 28 oct 2026 |
| [esteban-dcp/ecuador-tax](https://github.com/esteban-dcp/ecuador-tax) (`@ecuador-tax/*` 0.1.1, 10 oct 2026) | Validación RUC, clave, XML, firma, SOAP | 10 oct 2026 | MIT | 1 | ~650 por paquete | 1.1.0 por defecto; 2.0.0 y 2.1.0 opcionales | node-forge, xml-crypto, @xmldom | Honesta: su README dice que **no hay evidencia de una autorización real de punta a punta**. Experimental. Solo ESM |
| [JoseGusnay/osodreamer-sri-xml-signer](https://github.com/JoseGusnay/osodreamer-sri-xml-signer) (npm 0.3.0, 8 sep 2026) | XML factura, firma, SOAP | 11 ago 2026 | MIT en npm; **sin licencia en GitHub** | 20 | 599 | 1.1.0 | node-forge, soap, xml2js | Estrategias por emisor de certificado (Uanataca, Security Data, Banco Central, ANF) |
| [AngeloBarzolaVillamar/open-api-facturacion-sri](https://github.com/AngeloBarzolaVillamar/open-api-facturacion-sri) | **Servicio completo** NestJS + Postgres + Redis/BullMQ + Docker. No es librería | 22 ago 2026 | MIT | 151 | n/a | 1.1.0 (`FACTURA_VERSION`) | **xadesjs** (archivado), node-forge, soap, xmldom | El de más estrellas. Multi-tenant. Sirve como VPS sidecar o como referencia; no cabe en serverless. Depende del paquete antiguo `xmldom` 0.6, no de `@xmldom/xmldom` |
| [miguelangarano/open-factura](https://github.com/miguelangarano/open-factura) (npm 0.1.1, **nov 2023**) | XML, firma, SOAP | **26 feb 2024** | MIT | 88 | 921 | **1.0.0** | xadesjs + node-forge | **Abandonada.** [#14 FIRMA INVALIDA](https://github.com/miguelangarano/open-factura/issues/14), [#5 ERR_REQUIRE_ESM](https://github.com/miguelangarano/open-factura/issues/5) abiertos. Un participante de #14 dijo haber combinado este código con ec-sri-invoice-signer |
| [cbuenanop/open-factura-ec](https://github.com/cbuenanop/open-factura-ec) (npm 1.0.0) | XML, firma, envío | 24 jul 2025 | MIT | 7 | 812 | No revisada | No revisado | Un solo commit de publicación, sin actividad |
| [XaviMontero/firmaec.js](https://github.com/XaviMontero/firmaec.js) (npm 5.2.0) | Firma PAdES y XAdES-BES | 14 oct 2026 | **AGPL-3.0** | 4 | 85 | Agnóstica | node-forge, xml-crypto, pdf-lib | Port de FirmaEC (MINTEL). AGPL es un problema para SaaS cerrado. Creado oct 2026 |
| [Dantell12/factura-electronica-ec-ride-SRI](https://github.com/Dantell12/factura-electronica-ec-ride-SRI) | XML a RIDE | 31 ago 2026 | MIT | 1 | n/a | n/a | n/a | Solo RIDE, muy nuevo |
| [imdotrino/dotrino-facturero](https://github.com/imdotrino/dotrino-facturero) | Facturador en navegador | oct 2026 | Sin licencia detectada | 0 | n/a | 1.1.0 | node-forge + WebCrypto | Interesante como referencia: firma en el cliente, sin servidor |

**Primitivas**
- **xadesjs: archivado** `[VERIFICADO]`. [PeculiarVentures/xadesjs](https://github.com/PeculiarVentures/xadesjs) `archived: true`, último push 12 ago 2025, 42 issues abiertos. La [issue #100](https://github.com/PeculiarVentures/xadesjs/issues/100), sobre ajustar la firma al SRI, sigue abierta desde 2020 y los mantenedores dijeron en 2021 que no se había hecho nada.
- **xml-crypto: activo** `[VERIFICADO]`. [node-saml/xml-crypto](https://github.com/node-saml/xml-crypto), último commit 14 oct 2026. Lo usan para canonicalizar ec-sri-invoice-signer, ecuador-tax y firmaec.js.
- **node-forge: activo** `[VERIFICADO]`. [digitalbazaar/forge](https://github.com/digitalbazaar/forge). Es el denominador común de casi todas las librerías para leer el `.p12`. El código de teran indica que maneja certificados legacy RC2/3DES en JS puro, sin dependencias nativas.
- **Especificación oficial** `[VERIFICADO]`: XAdES-BES esquema 1.3.2, firma ENVELOPED, UTF-8, RSA-SHA1, clave de 2048 bits, `KeyInfo` con el certificado en base64 (ficha v2.32 §6).
- **Un fallo de firma solo aparece en autorización** `[VERIFICADO]`: la ficha clasifica el error 39 "Firma inválida" como validación de AUTORIZACIÓN, no de recepción. Encaja con [#118](https://github.com/bryancalisto/ec-sri-invoice-signer/issues/118): el SRI recibe y luego rechaza. Un `RECIBIDA` no prueba que la firma sea válida.
- **Restricciones del XML para firmar** `[VERIFICADO]`: ec-sri-invoice-signer pide nodo raíz con id `comprobante`, sin namespaces y sin DOCTYPE ([README](https://github.com/bryancalisto/ec-sri-invoice-signer)).
- **Sobre versiones de factura** `[VERIFICADO]`: la ficha permite hasta 6 decimales en precio unitario y cantidad para la versión 1.1.0 (§9.17), y dedica sus anexos de 2.0.0 y 2.1.0 a rubros de terceros y factura sustitutiva de guía de remisión. Leí esos títulos de anexo, no el detalle completo de cada versión.

**¿Helper Java o PHP?**
- Hay ecosistemas equivalentes en otros lenguajes: [veronica-soap (Java)](https://github.com/veronica-platform/veronica-soap), [amephia/sri-ec (PHP)](https://packagist.org/packages/amephia/sri-ec), [xades-bes-sri-ec (Python)](https://github.com/alfredo138923/xades-bes-sri-ec), [go_ec_sri_invoice_signer](https://github.com/nelsonmarro/go_ec_sri_invoice_signer).
- El lema de firmaec.js, "Adiós Java: sin JDK, sin Maven, sin java -jar" ([README](https://github.com/XaviMontero/firmaec.js)), sugiere que el helper Java fue el patrón habitual `[ANÉCDOTA]`.

### Inferences
- La firma ya no exige Java en Node, y un JRE sería incómodo en una función serverless.
- Opción de menor riesgo: `ec-sri-invoice-signer` para firmar, más un constructor XML propio mínimo para el subconjunto de un restaurante, más `fetch`. Esto da unas pocas dependencias con historial, en vez de un SDK de 0.x.
- Aun así, el historial de #46, #64 y #118 indica que hay que fijar la versión y probar la firma contra celcer con el certificado real, porque hubo bugs de firma hasta julio de 2026.
- Ojo con la señal de descargas: incluye CI y bots. Sirve para comparar, no como recuento de usuarios.

### Gaps
- No pude confirmar qué librerías tienen producción real con volumen. Ningún repo publica casos verificables.
- No medí el coste de CPU de parsear el `.p12` con node-forge en un arranque en frío.
- No verifiqué si Node 20+ con xml-crypto necesita una opción explícita para permitir SHA1.

## Proveedores SaaS/API en Ecuador

### Takeaway
A ~1000 documentos/mes, las APIs verificadas salen en torno a **$22 a $34/mes + IVA** (Factuplan y Dátil). El volumen no es el problema: el precio es bajo. Casi todos custodian tu `.p12`, y eso, junto con la dependencia, es el coste real. No encontré ningún proveedor que publique precio por documento.

### Cited Findings

**Precios leídos en la página del propio proveedor** `[VERIFICADO]` en cuanto a lo publicado, antes de IVA del 15 %

| Proveedor | Plan para ~1000/mes | Precio | ¿API? | Quién firma | Notas |
|---|---|---|---|---|---|
| [Factuplan](https://factuplan.com.ec/precios) | Business Start, 1.000 docs/mes | $22/mes o $264/año | Sí, REST y webhooks | No confirmado | Cuota compartida entre facturas, NC, ND y guías. **Justo en el límite**; no leí el coste de excedente. Equivale a ~$0,022/doc (cálculo propio) |
| [Dátil](https://datil.com/precios) | Pro, 1.200 docs/mes | $34/mes | Sí, en todos los planes | Dátil, con tu certificado | Anual "12 meses por el precio de 10", pero la página no aclara si $34 ya lo refleja. Un tercero lo da como [$340/año](https://factuplan.com.ec/blog/los-10-mejores-facturadores-electronicos-ecuador) |
| [Cobra (Motivando)](https://facturacobra.com/) | Sucursal, ventas ilimitadas | $12/mes o $120/año | Hay [API /v1 y MCP](https://github.com/Motivandollc/cobra-mcp), pero la página no dice en qué plan | Cobra, con tu firma cargada | Es un **POS completo**, competidor directo. Indica estar registrado ante el SRI como proveedor (RUC 0201734746001) |
| [TuFacturero](https://tufacturero.ec/precios/) | Corporativo: 700 docs al **año** | $44,64/año | No mencionada | n/a | No alcanza el volumen |

**Precios indicados por un competidor** `[PROVEEDOR]`, sin confirmar: Siigo Contífico FE Ilimitado $91,43/año y Facturación con POS $292,80/año; Quipuy Empresarial $35/mes ilimitados; [comparativa de Quipuy, ago 2026](https://quipuy.com/blog/quipuy-vs-siigo-contifico-precios-ecuador-2026). `siigo.com/ec/precios` devolvió 404, así que no los pude contrastar. La misma fuente no menciona API. Contífico ya es [Siigo Contífico](https://quipuy.com/blog/contifico-vs-quipuy-cual-elegir).

**Detalles técnicos de API**
- **Dátil** `[VERIFICADO en docs]`, [datil.dev](https://datil.dev/): `POST /invoices/issue` (JSON) y `POST /invoices/issue/xml` (XML propio). Autenticación con `X-Key`, y **la contraseña del certificado va en `X-Password` en cada emisión**. Soporta `Idempotency-key` de 16 a 48 caracteres. Flujo asíncrono, ~3 a 5 s en condiciones normales, estados `AUTORIZADO`, `NO AUTORIZADO`, `ENVIADO`, `DEVUELTO`, `RECIBIDO`, `ERROR`. También envía el email. Vende certificados: $20 (1 año), $35 (2), $45 (3).
- **Invoka** `[VERIFICADO en SDK]`, [invoka/sdk](https://packagist.org/packages/invoka/sdk), v1.0.0 del 3 oct 2026: 1 crédito por comprobante autorizado, pruebas gratis ilimitadas, emisión asíncrona, webhooks y email incluidos. **Muy nuevo.** La emisión en producción exige datos "Proveedor SRI" aprobados, o devuelve `ProveedorSriNoAprobado`. No encontré el precio del crédito.
- **Comprobify** `[VERIFICADO en docs]`, [docs](https://comprobify-docs.pages.dev/): API REST, firma él, webhooks HMAC-SHA256, avisos de vencimiento de certificado, email al comprador. Precios no publicados en esa página. El repo enlazado (`novaej/comprobify`) devuelve 404 público.
- **Siigo Contífico:** su API existe, pero la documentación es poco visible. Un [paquete npm no oficial](https://app.unpkg.com/contifico@0.0.1/files/README.md) dice que las credenciales se piden a soporte. No confirmado.
- **Gosocket, "Facturama-like":** no encontré información pública útil para Ecuador. Las búsquedas tampoco trajeron datos sobre un producto llamado "Facturero" salvo [Dotrino Facturero](https://github.com/imdotrino/dotrino-facturero) (gratuito, en navegador, sin API).

**Regulación nueva que afecta a build vs buy**: Resolución **NAC-DGERCGC26-00000027** (R.O. 28 jul 2026)
- Los desarrolladores y dueños de código de sistemas de facturación **con fines de comercialización** deben registrar actividad exclusiva en el RUC (CIIU J62021002 o J62021003). Fuentes: [El Mercurio](https://elmercurio.com.ec/nacional/2026/07/28/sri-registro-ruc-proveedores-facturacion-electronica-ecuador/), [Lexis](https://www.lexis.com.ec/noticias/sri-crea-registro-obligatorio-de-proveedores-de-facturacion-electronica).
- Los emisores que usen sistemas **de terceros** deben incluir el RUC del proveedor en información adicional de cada comprobante; el SRI publica lista mensual ([Tu Facturero](https://tufacturero.ec/regulacion-proveedores-facturacion-electronica-ecuador/)).
- **Desarrollo propio:** un [bufete](https://coronelyperez.com/blog-coronel-perez-ecuador/derecho-tributario/registro-proveedores-facturacion-electronica-sri/) afirma que las empresas que desarrollan solo para uso interno no están cubiertas. Es la lectura de un despacho, no el texto de la norma.
- **Conflicto de plazos:** días hábiles según [Carrión y Bustos vía KCH](https://kchcomunicacion.com/2026/08/24/la-facturacion-electronica-ya-transmite-el-94-de-las-transacciones-en-tiempo-real/) (~9 sep y ~22 oct) frente a días calendario según Tu Facturero y Coronel & Pérez. Ambos ya vencieron.

### Inferences
- Si el POS se vende a otros restaurantes, **el dueño pasa a ser proveedor regulado** y debe registrarse. Cambia la conversación: uso interno y producto comercial no son el mismo proyecto.
- Comprueba que el proveedor elegido figura en la lista mensual del SRI antes de contratar: si no está, no puedes cumplir la obligación de consignar su RUC.
- Cualquier opción "buy" implica entregar el `.p12` a un tercero. Es un poder de firma real. Dátil pide la contraseña por petición; eso sugiere que no la guarda, aunque sus docs no lo afirman.
- `POST /invoices/issue/xml` de Dátil abre una vía intermedia: generas tú el XML y dejas firma, envío y reintentos al proveedor.

### Gaps
- **Propiedad y portabilidad de datos:** no leí los términos de servicio de ningún proveedor, y no puedo afirmar nada sobre exportación de XML ni retención tras cancelar.
- Excedentes por encima de cuota; precio del crédito de Invoka; precios de Comprobify; API de Cobra por plan; dónde custodia Dátil el `.p12`.
- SLA o uptime: ningún proveedor publica uno en lo que revisé.

## Costes: integración directa vs proveedor a ~1000 facturas/mes

### Takeaway
En efectivo, directo cuesta casi nada; proveedor cuesta **~$300 a $470/año con IVA**. Todo se decide por las horas de desarrollo: a cualquier tarifa razonable, el coste inicial de construir supera varios años de suscripción, a menos que esas horas se traten como inversión en el producto o el POS se vaya a vender.

### Cited Findings
| Concepto | Directo | Proveedor |
|---|---|---|
| Firma `.p12` | [$20/año](https://datil.com/precios) | Igual: [también hace falta](https://facturacobra.com/) |
| Plataforma | $0 si ya existe. Si el cron es necesario, [Hobby solo permite 1 al día y Pro 1 por minuto](https://vercel.com/docs/cron-jobs/usage-and-pricing) | $0 extra |
| Email | [Resend gratis: 3.000/mes, tope 100/día](https://resend.com/pricing) | Incluido en Dátil, Invoka, Comprobify |
| Suscripción (sin IVA) | $0 | [Factuplan $264/año](https://factuplan.com.ec/precios), [Dátil hasta $408/año](https://datil.com/precios) |
| Con IVA 15 % | n/a | ~$304 a $469/año (cálculo propio) |

### Inferences
Estimación propia, sin datos de referencia:
- **Construcción:** ~40 a 80 horas para factura + nota de crédito + outbox + reintentos + RIDE + email + pruebas en celcer. Se suma que el XML debe mantener tablas (IVA, formas de pago) y atender cambios del SRI, ~1 a 2 horas/mes en régimen.
- **Punto de equilibrio:** `horas × tarifa ÷ ($300 a $470/año)`. A 60 h y $20/h son $1.200, unos 2,5 a 4 años de suscripción, antes de mantenimiento. A $0/h (el fundador lo hace de todas formas) gana directo.
- **Lo que el dinero no captura:** directo = sin tercero con tu firma, sin riesgo de que el proveedor cierre o suba precios, y control de la UX. Buy = alguien más vigila los cambios del SRI, y hay soporte cuando falla el viernes por la noche.
- **Híbrido razonable:** empezar con API de proveedor tras una interfaz `emitirComprobante()` propia y guardar siempre XML autorizado y clave en tu base. Así cambiar a directo después no reescribe el POS.

### Gaps
- No hay datos públicos de horas reales de implementación. Las horas de arriba son juicio propio.
- La frecuencia real de excedente sobre la cuota de 1.000 de Factuplan depende de cuántas NC se emitan.

## Problemas reales: disponibilidad, geobloqueo, TLS, errores y diseño de reintentos

### Takeaway
**El SRI no bloquea IPs extranjeras** en mis pruebas, y **no hace falta desactivar TLS**: esos dos consejos que circulan no se sostienen hoy. El peligro real es otro: la regla de transmisión inmediata desde enero 2026, la ausencia de contingencia oficial, reintentos que crean duplicados, y las fechas en UTC. Además, **dos blogs de proveedores contradicen la ficha oficial** en códigos de error y contingencia: no te fíes de ellos.

### Cited Findings

**Geobloqueo** `[VERIFICADO: prueba propia, 3 nov 2026]`, con [check-host.net](https://check-host.net) y desde Ecuador
- TCP 443 desde nodos extranjeros: **27 de 28 conectaron** (EE. UU., Alemania, Francia, Japón, Singapur, India, Israel, etc.). El único fallo, Bucarest hacia `cel`, tuvo éxito hacia `celcer` en la misma prueba.
- HTTP GET al WSDL de **producción** desde 12 nodos: **8 con HTTP 200** (Nueva York 0,44 s; Frankfurt 0,66 s; Tokio 2,6 s; Singapur 2,2 s), 1 *connection reset* (Sofía), 1 timeout (Shiraz), 2 sin resultado (Moscú, Isfahán).
- Sin contraejemplo documentado: [la ficha](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/29562323-2e76-42f5-abb6-cb7ac542c3c6/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.32.pdf) no menciona restricción geográfica. El único indicio fue un [hilo en AWS re:Post](https://www.repost.aws/questions/QUbLFjvvXSSN2hqvczK-VtMg/soapclient-error-in-php-on-ec2-aws-server) (leído solo en extracto; la página devolvió 403) donde alguien sospechaba de un firewall, sin confirmación.
- **IPv6:** `celcer` y `cel` no tienen registro AAAA desde mi resolvedor. Los servicios son solo IPv4.
- **Doble red:** los nodos extranjeros resuelven también a una segunda IP (`181.188.238.9` celcer, `.10` cel), además de `190.152.216.11` y `.10`. Probé ambas con Node: TLS válido y hostname correcto.

**TLS** `[VERIFICADO: prueba propia con Node 20.10, sin flags]`
- Ambos hosts entregan hoja + intermedio DigiCert G2. Node valida sin nada especial (`authorized: true`), y `fetch` funciona.
- Certificados actuales: `celcer` del 28 sep 2026 al 10 feb 2027; `cel` del 15 feb 2026 al 14 ene 2027. **Caducan pronto**; la ficha §7.1.4 advierte que pueden cambiar sin aviso y pide no fijarlos en el código.
- Contradice comentarios en repos: [casaMilks](https://github.com/Broscar-Xd/casaMilks) y [Backend-Factory](https://github.com/nicolaslaracaicedo/Backend-Factory) usan `rejectUnauthorized: false` alegando cadena incompleta; [Facturacion_Could](https://github.com/Willian845Alex/Facturacion_Could) relaja el hostname. `[ANÉCDOTA]`, posiblemente de una configuración anterior. Hoy es innecesario y reduce seguridad.
- casaMilks también afirma que el SRI cierra conexiones reutilizadas (ECONNRESET). Tres POST seguidos no me fallaron, pero la muestra es mínima.

**CORS** `[VERIFICADO]`
- El GET devuelve `Access-Control-Allow-Origin: *`, pero un `OPTIONS` devuelve 200 sin cabeceras CORS. Dotrino lo describe como que [el cortafuegos rechaza la petición previa](https://github.com/imdotrino/dotrino-facturero), y lo esquiva con `text/plain`, sin garantía.
- Irrelevante desde el servidor. Solo importa si firmas en navegador.

**Disponibilidad y latencia**
- `[VERIFICADO]` Autorización asíncrona: tras `RECIBIDA` hay que esperar un tiempo parametrizable y consultar; **máximo oficial, 24 horas** (ficha §5 y §7).
- `[VERIFICADO]` Mantenimiento programado del [6 al 7 de marzo de 2026](https://www.lexis.com.ec/noticias/suspension-temporal-de-servicios-digitales-del-sri-por-mantenimiento-programado) incluyó Comprobantes Electrónicos.
- `[PROVEEDOR]` [Siigo Contífico](https://contifico.portaldeclientes.siigo.ec/basedeconocimiento/actuar-ante-intermitencia-en-el-servidor-del-servicio-rentas-internas-sri/) tiene una guía de intermitencia con comentarios hasta el 26 oct 2026: el documento queda "Procesando", no debe tocarse, y se reenvía solo.
- `[PROVEEDOR]` [Factuplan](https://factuplan.com.ec/blog/autorizacion-sri-paso-a-paso) (may 2026): 2 a 5 s normal, 30 s a 2 min en cierre de mes, 2 a 10 min en picos de declaración. Sin datos de respaldo. Dátil: [3 a 5 s](https://datil.dev/).
- `[ANÉCDOTA]` [data-metrics](https://data-metrics.pro/blog/sri-real-time-test-odoo-ecuador/): timeouts de más de 30 s entre 9:00 y 11:00, 8 % en un caso. Sin fuente.
- Medí 66 a 148 ms en una consulta inválida sobre celcer desde Ecuador: mide la red, no la autorización.

**Regla de tiempo real** `[VERIFICADO en prensa, no en el texto de la norma]`
- Desde el 1 ene 2026 la transmisión debe ser [inmediata](https://www.primicias.ec/economia/transmision-facturas-electronicas-sri-obligatoria-enero2026-112780/), eliminando los 4 días hábiles (Res. NAC-DGERCGC25-00000017). Cumplimiento: [90 a 94 %](https://kchcomunicacion.com/2026/08/24/la-facturacion-electronica-ya-transmite-el-94-de-las-transacciones-en-tiempo-real/) según la directora del SRI.
- [Siigo](https://www.siigo.com/ec/blog/obligaciones-fiscales/transmision-inmediata-comprobantes-electronicos/) recomienda bitácora de contingencia y enviar lo pendiente cuanto antes, sin plazo. Físicas: solo fuerza mayor, tope del [1 % de las facturas del año anterior](https://kchcomunicacion.com/2026/08/24/la-facturacion-electronica-ya-transmite-el-94-de-las-transacciones-en-tiempo-real/).

**Errores: la ficha manda.** Tabla `[VERIFICADO]`, ficha v2.32 §11

| Código | Significado oficial | Fase | Acción |
|---|---|---|---|
| 35 | XML no pasa esquema | Recepción | Corregir, reenviar |
| 39 | Firma inválida | **Autorización** | Revisar firmador/certificado |
| 40 | Error en certificado | Autorización | Revisar `.p12` |
| **43** | Clave de acceso **ya registrada** | Recepción | **No es error fatal:** consultar autorización |
| **45** | Secuencial ya registrado | Recepción | Mismo secuencial con otra clave: bug tuyo, reconciliar |
| 52 | Error en cálculos | Autorización | Corregir totales |
| 58 | Clave no coincide con el comprobante | Autorización | Corregir |
| 65 | Fecha extemporánea | Emisor/Recepción | Ver fechas |
| **70** | **En procesamiento** | Recepción | **No reenviar ni regenerar** hasta respuesta, máx. 24 h |
| 80 | Estructura de clave inválida | Autorización | Lo vi en mi prueba con clave de ceros |

- **Secuenciales tras rechazo** `[VERIFICADO]`: ficha §5.10 y nota 1 del §11: rechazado por inconsistencia se reenvía corregido **con la misma clave y secuencial**. [Factuplan](https://factuplan.com.ec/blog/autorizacion-sri-paso-a-paso) dice lo contrario: pide un secuencial nuevo.
- **Códigos de Factuplan: incorrectos.** Da 35 como firma inválida, 43 como formato de clave, 45 como datos del emisor, 50 como secuencial duplicado y 70 como XSD. La ficha dice otra cosa en los cinco.
- **Contingencia: no existe en la ficha** `[VERIFICADO]`. La tabla 2 solo tiene `tipoEmision=1`, y el historial de versiones indica que la v2.0 de 2015 eliminó las claves de contingencia. Factuplan y data-metrics recomiendan `tipoEmision=2`: **contradice la ficha**, y no lo implementes.
- `estado.sri.gob.ec`, citado por data-metrics, no resolvió en mi prueba.
- **Secuencia** `[VERIFICADO]`: §9.18 exige orden cronológico y secuencial, sin duplicar secuencia ni clave, y evitar reenvíos innecesarios. Es responsabilidad del emisor (§16). No encontré regla oficial sobre huecos.
- **Celcer y producción:** el comprobante de pruebas lleva advertencia 60 y no tiene validez (§4.3, §11).

**Fecha UTC** `[VERIFICADO en docs de librerías]`
- ecuador-tax exige [`TZ=America/Guayaquil`](https://github.com/esteban-dcp/ecuador-tax), e Invoka advierte que el SRI [solo acepta la fecha del día](https://packagist.org/packages/invoka/sdk).

**Serverless** `[VERIFICADO]`, [Vercel](https://vercel.com/docs/functions/limitations)
- Duración máx.: Hobby 300 s; Pro 800 s. Región por defecto `iad1`. Esperar I/O no consume CPU activa. Hay [Workflows](https://vercel.com/docs/workflows) y [Queues](https://vercel.com/docs/queues/pricing), y [IP estática](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address) opcional.
- Timeouts de referencia: ecuador-tax 30 s; open-api 30 s recepción y 60 s autorización, 5 reintentos. Dátil y Siigo: siempre asíncrono.

### Inferences
**Diseño recomendado (máquina de estados con outbox en Postgres, sin Redis):**

```
BORRADOR → FIRMADO → ENVIANDO → RECIBIDA → AUTORIZADO
                         ↓          ↓
                     AMBIGUO   NO_AUTORIZADO / DEVUELTA → (corregir, misma clave)
```

1. En una sola transacción, reserva el secuencial (contador por `estab+ptoEmi+tipo` con bloqueo de fila), genera la clave de 49 dígitos y **guárdala antes de hablar con la red**. Índice único en clave y en `(estab, ptoEmi, tipo, secuencial)`.
2. **La clave es la llave de idempotencia:** nunca se regenera en un reintento. El código numérico de 8 dígitos se fija una vez. Así, un reintento produce 43/70, inofensivos, y no 45.
3. Timeout de red en recepción = **AMBIGUO, no fallo**: primero consulta autorización, y solo reenvía si el SRI no lo conoce. Así lo hace [`ecuador-tax`](https://github.com/esteban-dcp/ecuador-tax), buen modelo a copiar.
4. `RECIBIDA` no es éxito. No imprimas el RIDE como definitivo hasta `AUTORIZADO`.
5. La venta en caja no debe depender del SRI: responde al cajero enseguida, intenta en la petición con timeout ~15 s y deja el resto a un barrido.
6. **Fuerza `America/Guayaquil` en cálculo de fecha de emisión.** El restaurante cierra de noche: desde las 19:00 locales, UTC ya es mañana, justo en horario pico. Es el bug más probable y más silencioso de un despliegue serverless.
7. Barrido por cron cada minuto con backoff y tope de 24 h para EN PROCESO. Exige Vercel Pro o programador externo.
8. Una factura mal emitida a consumidor final **no se puede anular** desde 2026, y la NC exige identificar al receptor (sección de envío al cliente). Valida antes de emitir.
9. No uses `rejectUnauthorized: false`. Si un cambio de certificado rompiera la cadena, añade el intermedio con `NODE_EXTRA_CA_CERTS`.
10. Haz un smoke test desde tu región real: mis pruebas no salieron de IPs de Vercel/AWS.

### Gaps
- **No hay cifras oficiales de uptime** ni histórico público. Mi conclusión es que las caídas ocurren, sin poder dar frecuencia.
- No probé desde IPs de Vercel/AWS. Las sondas fueron de proveedores tipo VPS; lo comprobado es ausencia de bloqueo por país, no por ASN de nube.
- No conseguí el texto oficial de NAC-DGERCGC25-00000017: qué hacer ante caída del SRI sigue sin aclararse.
- No hay regla oficial encontrada sobre huecos de secuencia.

## Cliente SOAP desde Node: librería soap vs fetch; Base64

### Takeaway
**Un `fetch` crudo funciona** y es la opción correcta en serverless: dos plantillas de cadena y un parser. Lo comprobé contra celcer. La librería `soap` no aporta nada para dos operaciones, y añade una descarga de WSDL en cada arranque en frío.

### Cited Findings
- `[VERIFICADO: prueba propia]` POST con `fetch` nativo a `AutorizacionComprobantesOffline` de celcer, cabeceras `Content-Type: text/xml; charset=utf-8` y `SOAPAction: ""`: HTTP 200 y respuesta SOAP, 3 de 3. Con clave de ceros devolvió `RECHAZADA`, código 80, tal como indica la ficha.
- `[VERIFICADO en código]` Usan fetch: [ecuador-tax](https://github.com/esteban-dcp/ecuador-tax) y [sri-ec](https://github.com/JonathanTeran/teran-sri-ec-node), con el mismo encabezado. Usan la librería `soap`: open-api, open-factura y osodreamer.
- `[VERIFICADO en código]` open-api llama a `soap.createClientAsync(wsdlUrl)` y cachea el cliente **en memoria**.
- `[VERIFICADO en código]` Base64: `Buffer.from(signedXml, 'utf-8').toString('base64')` dentro de `<xml>` ([soap-envelope.ts de sri-ec](https://github.com/JonathanTeran/teran-sri-ec-node)). Namespaces: `http://ec.gob.sri.ws.recepcion` y `http://ec.gob.sri.ws.autorizacion`.
- `[VERIFICADO]` Autorización devuelve el XML dentro de CDATA (ficha, ejemplos de anexos). URLs oficiales `celcer`/`cel`, `.../comprobantes-electronicos-ws/RecepcionComprobantesOffline` y `AutorizacionComprobantesOffline`.
- `[VERIFICADO en código]` sri-ec valida que la clave sean 49 dígitos antes de interpolarla, para evitar inyección en el envelope. ecuador-tax usa `redirect: 'error'`.

### Inferences
- En serverless, la caché en memoria del WSDL se pierde al reciclar instancias: cada arranque en frío añade un GET al SRI y un punto de fallo.
- Los fallos de Base64 suelen ser doble codificación, o firmar y luego reformatear el XML. Regla: la cadena firmada se convierte a Buffer tal cual, sin pasar por ningún serializador.
- Guarda el XML **exacto** firmado y el autorizado. Nunca los reconstruyas.
- Valida el formato de la clave antes de cualquier interpolación, como sri-ec.
- Parsea con un parser XML real (fast-xml-parser), no regex.

### Gaps
- No probé `validarComprobante` real porque requiere RUC y certificado autorizados.
- Límite exacto de tamaño por comprobante individual: no extraído.

## RIDE en Node e impresora térmica; códigos de barras

### Takeaway
**El código de barras es opcional** según la ficha, cosa que muchos dan por obligatoria. Eso simplifica mucho el ticket térmico. Para PDF, usa `pdfkit` o `pdf-lib`, sin Chromium.

### Cited Findings
- `[VERIFICADO]` Ficha §9.19: el RIDE tiene validez tributaria y jurídica; los anexos dan modelos con posiciones; se pueden imprimir datos adicionales. §9.20: el emisor "podrá" incorporar código de barras, y Anexo 2 repite que es opcional. §9.21 recomienda GS1-128. La clave de acceso es el número de autorización.
- `[VERIFICADO en código]` [`sri-ec/ride`](https://github.com/JonathanTeran/teran-sri-ec-node): RIDE conforme al Anexo 2 con pdfkit, y Code 128 manual sin dependencias extra; QR opcional. pdfkit y qrcode son peerDependencies opcionales.
- `[VERIFICADO en código]` open-api declara pdf-lib, qrcode y plantillas, y no declara Puppeteer ni Playwright en `package.json`. Dotrino usa HTML + diálogo de impresión + [`code128.js`](https://github.com/imdotrino/dotrino-facturero).
- `[VERIFICADO]` [Vercel](https://vercel.com/docs/functions/limitations): función de 250 MB sin comprimir, respuesta de 4,5 MB.

### Inferences
- **pdfkit** para el A4 del email: cálculo de layout manual, sin navegador. **Puppeteer** queda descartado en Vercel por tamaño y arranque, salvo necesidad clara.
- Ticket de 80 mm: reutiliza la impresión del POS, sin PDF, e imprime clave de 49 dígitos en texto.
- Si quieres barcode en térmica: Code128 subset C, 49 dígitos ≈ 28 símbolos ≈ 320 módulos más zonas de silencio (~340). En 203 dpi y ~576 puntos útiles queda **1 punto por módulo (0,125 mm)**, en el límite de lectura. **QR o saltarlo** es más fiable; recomiendo omitirlo porque es opcional. Cálculo propio, sin probar en hardware.
- Code 128 y GS1-128 no son lo mismo; la ficha solo recomienda revisar GS1-128 (§9.21), no lo exige.

### Gaps
- **No encontré norma sobre ancho de papel del RIDE**, ni si un ticket de 80 mm con todos los datos del Anexo 2 cumple formalmente. Conviene consultarlo al SRI o a un contador.
- La Resolución 233 de 2018, citada por la ficha §9.19, no se revisó.

## Envío de XML + RIDE al cliente

### Takeaway
Enviar por email es **obligación del emisor** según la ficha, no una cortesía. Con un email transaccional en plan gratuito basta para este volumen, y la mayoría de ventas de restaurante serán a consumidor final sin correo.

### Cited Findings
- `[VERIFICADO]` Ficha §4.7: el emisor tiene obligación de enviar los comprobantes al receptor por correo electrónico, y además puede usar portal web o SMS. §4.8: entregar y notificar tras autorización.
- `[VERIFICADO]` Práctica: [Dátil](https://datil.dev/), [Comprobify](https://comprobify-docs.pages.dev/) e [Invoka](https://packagist.org/packages/invoka/sdk) adjuntan RIDE y XML **solo tras autorizar**.
- `[VERIFICADO]` [Resend](https://resend.com/pricing): gratis 3.000/mes, tope 100/día; Pro $20/mes 50.000.
- `[VERIFICADO en prensa]` Facturas sobre [$50](https://www.bloomberglinea.com/2022/11/17/en-ecuador-las-facturas-de-mas-de-us50-deberan-emitirse-con-datos-del-comprador/) deben identificar al comprador. Identificación CF: `9999999999999`, tipo 07 (ficha tabla 6).
- `[VERIFICADO en prensa]` Desde 1 ene 2026, comprobantes a consumidor final [no se pueden anular](https://www.vistazo.com/actualidad/2025-09-18-sri-facturacion-electronica-nuevos-ajustes-ecuador-BD10134948), y la anulación general vence el día 7 del mes siguiente.
- `[VERIFICADO]` Las notas de crédito deben identificar obligatoriamente al receptor (ficha tabla 6, notas): no sirve `9999999999999`.

### Inferences
- Encola el email tras `AUTORIZADO`, separado del flujo fiscal, para que un fallo de correo jamás bloquee ni reintente la emisión.
- Guarda dirección y resultado de entrega como evidencia. Si no hay email, el RIDE impreso cumple en la práctica para consumidor final, aunque no encontré norma explícita.
- 1.000 facturas/mes son ~33/día, debajo del tope de 100/día; pero un sábado con muchos RUC puede superarlo. Dominio propio con SPF/DKIM es imprescindible en entrega.
- Los errores del tipo "cobré mal a consumidor final" pasan a no tener arreglo por anulación: la pantalla de cobro debe confirmar datos antes de emitir.

### Gaps
- **Conservación por 7 años:** no lo encontré en ficha ni en resultados. Falta confirmarlo en el Reglamento o el Código Tributario.
- Cómo corregir en la práctica una factura a consumidor final tras el cambio de 2026, dada la exigencia de identificar en la NC. Merece consulta a un contador.

## Procedimiento en ambiente de pruebas antes de producción

### Takeaway
**No hay un número obligatorio de comprobantes de prueba** que yo haya encontrado. El SRI pide dos solicitudes gratuitas en línea; la responsabilidad es tuya. Antes hay requisitos que pueden bloquear: RUC activo, al día, y convenio de débito.

### Cited Findings
- `[VERIFICADO]` Ficha §4.3: la solicitud se hace por portal SRI, una sola vez por ambiente; hay que estar activo, al día, y con **convenio de débito** registrado. El ambiente de pruebas es **obligatorio para todos**.
- `[VERIFICADO]` Ficha §4.3: celcer sirve para validar XSD, firma y conexión. **No se deben hacer pruebas de estrés o masividad** ahí. Se recomienda cubrir escenarios del giro del negocio.
- `[VERIFICADO]` §4.4: en la solicitud se escoge el tipo de comprobante a emitir. §5.6: en pruebas, razón social del receptor "PRUEBAS SERVICIO DE RENTAS INTERNAS". §5.5: el ambiente va en la clave (1 pruebas, 2 producción).
- `[VERIFICADO]` Gratis, requisitos RUC y clave de SRI en línea: [pruebas](https://www.gob.ec/sri/tramites/autorizacion-ambientes-pruebas-comprobantes-electronicos), [producción](https://www.gob.ec/sri/tramites/autorizacion-ambientes-produccion-comprobantes-electronicos). Ninguna exige N documentos. Última actualización: 2022.
- `[ANÉCDOTA]` [data-metrics](https://data-metrics.pro/blog/sri-real-time-test-odoo-ecuador/) propone emitir 3 facturas seguidas, certificado con 30+ días, y un "RUC de prueba"; este último no aparece en la ficha, y su autor recomienda también la contingencia que la ficha eliminó, así que trátalo con cautela.

### Inferences
**Checklist propuesto** (elaboración propia a partir de la ficha):
1. Convenio de débito y estado al día, antes que nada.
2. Solicitud de pruebas con los tipos: factura y nota de crédito.
3. Factura a consumidor final; con cédula; con RUC.
4. IVA 15 %, 0 %, descuento, propina si aplica; varios pagos; más de un ítem; caracteres `ñ`, `&`, tildes.
5. Totales con redondeo (error 52).
6. Certificado real: un `AUTORIZADO`, no solo `RECIBIDA`.
7. Reenvío deliberado: confirmar 43 y 70. Secuencial repetido con otra clave: confirmar 45.
8. Corte de red en mitad de recepción: el estado AMBIGUO se resuelve sin duplicar.
9. Forzar `DEVUELTA` y reenviar corregido con la misma clave.
10. Emitir tras las 19:00 locales y comprobar la fecha.
11. Probar desde la región desplegada, no desde tu portátil.
12. Antes de pasar a producción: secuenciales de producción inicializados, sin arrastrar los de prueba.

### Gaps
- Tiempo de aprobación real de cada solicitud: no publicado.
- Si la secuencia de pruebas puede reutilizarse en producción: no lo verifiqué.

## Almacenamiento de certificados en serverless

### Takeaway
Para un solo emisor, basta con el `.p12` en base64 y su contraseña como dos variables Secret separadas. Multiemisor exige cifrado en base de datos. No se puede usar un KMS para firmar con un `.p12` tal como viene, así que protege la clave en reposo y limita su exposición en memoria.

### Cited Findings
- `[VERIFICADO]` [Vercel env](https://vercel.com/docs/environment-variables): 64 KB en total por despliegue en Node; 5 KB por variable en `edge`. Valores cifrados en reposo; tipo **Secret** solo escritura. Un cambio exige redesplegar.
- `[VERIFICADO en código]` open-api guarda la contraseña cifrada en base de datos con un `EncryptionService` y cachea el certificado cargado.
- `[VERIFICADO en README]` [ecuador-tax](https://github.com/esteban-dcp/ecuador-tax): credenciales no serializables (`JSON.stringify` e `util.inspect` devuelven marcador), errores sin secretos. [Dotrino](https://github.com/imdotrino/dotrino-facturero): importa la clave a WebCrypto como **no extraíble**.
- `[VERIFICADO en código]` Certificados multi-clave o con varias bolsas: [sri-ec](https://github.com/JonathanTeran/teran-sri-ec-node) selecciona por `keyUsage`/`friendlyName`. Hubo fallos específicos con [Banco Central](https://github.com/bryancalisto/ec-sri-invoice-signer/issues/46) y estrategias por emisor en [osodreamer](https://github.com/JoseGusnay/osodreamer-sri-xml-signer).
- `[VERIFICADO]` [Comprobify](https://comprobify-docs.pages.dev/) avisa del vencimiento del certificado. Un certificado vencido detiene toda la facturación.

### Inferences
- **Un emisor:** `SRI_P12_BASE64` y `SRI_P12_PASSWORD` como Secret, nunca en git. Con un `.p12` típico de pocos KB cabe holgado en 64 KB. Rotación anual o por certificado: redespliegue, ajustado a la frecuencia.
- **Varios emisores:** `.p12` y contraseña cifrados con AES-256-GCM en Postgres, con la clave maestra en env (o KMS para el cifrado de sobre). El env no escala por tenant y además exige redesplegar.
- Solo en runtime Node, nunca en `edge` ni en cliente.
- Memoiza la clave parseada a nivel de módulo para no repetir parseo; no la escribas en `/tmp`.
- Alerta a 30, 15 y 5 días del vencimiento, porque el coste de olvidarlo es parar la caja.
- Pruebas: usa un `.p12` de pruebas separado, si tu emisor lo permite; el SRI valida con certificado real.

### Gaps
- No hay fuente sobre firma en HSM o nube compatible con SRI desde Node. Algunas CA ofrecen productos en nube, pero no lo investigué.
- Riesgo real de exposición de secretos en runtimes serverless compartidos: sin datos.

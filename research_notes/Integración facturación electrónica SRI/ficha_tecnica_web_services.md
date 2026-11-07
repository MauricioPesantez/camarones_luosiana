# SRI Ecuador: Ficha Técnica offline, end-to-end web service protocol

Research date: 2026-11-03. Unless marked otherwise, every "F2.34" citation is the official PDF, **Ficha Técnica de Comprobantes Electrónicos Esquema Offline, Versión 2.34**, read in full text (142 pages, SHA-256 `7333aebf...fc13c9`). The section and page follow each citation. "Live test" means a request I sent on 2026-11-03 to the listed endpoint. WSDL facts come from the WSDLs downloaded that day.

Reliability order used when sources conflict: live test and WSDL (what the server does now), then F2.34 (what SRI says), then open-source clients (what others observed; several mislabel codes), then vendor blogs.

[F2.34]: https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf
[SRI-FE]: https://www.sri.gob.ec/facturacion-electronica
[W-REC-T]: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
[W-AUT-T]: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
[W-REC-P]: https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
[W-AUT-P]: https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
[W-CON-T]: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/ConsultaComprobante?wsdl
[W-CON-P]: https://cel.sri.gob.ec/comprobantes-electronicos-ws/ConsultaComprobante?wsdl
[W-FAC-T]: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/ConsultaFactura?wsdl
[LIVE]: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
[key49-ops]: https://github.com/grisbi-ia/key49/blob/main/docs/OPERATIONS.md
[key49-arch]: https://github.com/grisbi-ia/key49/blob/main/docs/ARCHITECTURE.md
[librejv]: https://github.com/jvinueza/librejv/blob/main/l10n_ec_sri_ece/models/sri.py
[factutienda]: https://github.com/Deavyd/factutienda-ec/blob/main/backend/app/services/sri_service.py
[intuit]: https://github.com/Intuit-EC/arg-electronic-invoice/blob/main/INTEGRACION_SRI.md
[datil]: https://github.com/datil/sri-clj/blob/master/doc/intro.md
[deley]: https://deley.ec/guias/tipos-de-emision-comprobantes-electronicos-sri
[hlb]: https://www.hlbecuador.com/sri-actualizacion-en-la-normativa-de-comprobantes-electronicos-resolucion-nac-dgercgc25-00000017/
[primicias]: https://www.primicias.ec/economia/transmision-facturas-electronicas-sri-obligatoria-enero2026-112780/
[siigo]: https://www.siigo.com/ec/blog/obligaciones-fiscales/transmision-inmediata-comprobantes-electronicos/
[nms]: https://nmslaw.com.ec/?p=14518
[sovos22]: https://sovos.com/es/cambios-regulatorios/iva/ecuador-cambios-del-plazo-de-envio-de-comprobantes-electronicos/
[lexis]: https://www.lexis.com.ec/noticias/sri-reforma-plazos-para-anulacion-de-comprobantes-electronicos-1

## 1. Latest ficha version, what changed, and whether offline is the only scheme

### Takeaway
The latest version is **2.34, dated 27/07/2026**. The SRI site lists it under "Esquema actual", and offline is the only scheme with live web services. Versions 2.33 and 2.34 changed only XML filling rules; the protocol has not changed in the change log since the consultation services were added in 2.31 (March 2025).

### Cited Findings
- The cover reads "ACTUALIZADO JULIO 2026, Versión 2.34"; the change log dates 2.34 as 27/07/2026 — [F2.34 cover p.1, log p.6][F2.34]. SRI's page lists "Ficha Técnica de Comprobantes Electrónicos Esquema Off-line - Versión 2.34", updated July 2026, under "Esquema actual" — [SRI facturación electrónica][SRI-FE].
- Official URL: see the [F2.34 PDF link][F2.34]. The URL contains a document UUID and will change with each version, so take the current link from [the SRI page][SRI-FE].
- Protocol-relevant change log — [F2.34 pp.5-6][F2.34]:

| Version | Date | Change |
|---|---|---|
| 2.0 | 05/08/2015 | New WS for pruebas; **claves de uso complementario (contingencia) removed** |
| 2.01 | 10/11/2015 | New WS for producción |
| 2.27 | 28/03/2024 | RIDE format update (Anexo 2), construction-materials annex (Anexo 23) |
| 2.29 | 25/10/2024 | Update to the DIG web services (IVA refund for older adults) |
| 2.31 | 27/03/2025 | **New consultation WS**: ConsultaComprobante and ConsultaFactura |
| 2.32 | 08/10/2025 | Anexo 25, transport operators' invoices |
| 2.33 | 13/07/2026 | Anexo 25: mandatory `placa` field, Tabla 33 |
| 2.34 | 27/07/2026 | **Anexo 26: mandatory RUC of the invoicing-system provider** |

- Anexo 26 (v2.34): issuers using third-party invoicing systems must add `<campoAdicional nombre="RUC Proveedor">` in `<infoAdicional>` (alphanumeric, max 300), mandatory 60 calendar days after publication in the Registro Oficial; the ficha cites Resolución NAC-DGERCGC26-00000027 — [F2.34 Anexo 26 p.135][F2.34].
- The offline scheme is defined as one where the authorization number is the issuer-generated clave de acceso, under Resolución NAC-DGERCGC14-00790 — [F2.34 glossary p.136][F2.34].
- Live probe: `RecepcionComprobantes?wsdl` and `AutorizacionComprobantes?wsdl` (the names without "Offline") return HTTP 404 on celcer; the Offline ones return 200 — [live test of test host][LIVE].

### Inferences
- A POS that issues third-party-software invoices must check Anexo 26 even though it is a small change. If this POS is sold to other businesses, its RUC is the "RUC Proveedor". If a restaurant runs it for itself, it may not apply. This needs a tax-side reading of the resolution.

### Gaps
- Publication date of NAC-DGERCGC26-00000027 not found, so the 60-day deadline could not be computed. It may already have passed.
- The ficha's phrase "proveedores detallados en la resolución 2718" is not explained in the ficha, and I did not locate that resolution.
- I only tested the legacy "online" endpoint names on celcer, not on cel.

## 2. Web service endpoints, operations, and SOAP shapes

### Takeaway
There are two SOAP 1.1 document/literal services per environment, with an empty `SOAPAction`. Child elements must be **unqualified** (no namespace prefix). `validarComprobante` takes the signed XML as base64; `autorizacionComprobante` takes the 49-digit clave.

### Cited Findings
- Endpoints — [F2.34 §7.2 p.17][F2.34], all confirmed HTTP 200 live:

| Service | Pruebas | Producción |
|---|---|---|
| Recepción | [celcer …/RecepcionComprobantesOffline?wsdl][W-REC-T] | [cel …/RecepcionComprobantesOffline?wsdl][W-REC-P] |
| Autorización | [celcer …/AutorizacionComprobantesOffline?wsdl][W-AUT-T] | [cel …/AutorizacionComprobantesOffline?wsdl][W-AUT-P] |

- Operations and namespaces — [Recepción WSDL][W-REC-T], [Autorización WSDL][W-AUT-T]:

| Operation | Target namespace | Input element | Output wrapper |
|---|---|---|---|
| `validarComprobante` | `http://ec.gob.sri.ws.recepcion` | `xml` (xs:base64Binary) | `RespuestaRecepcionComprobante` |
| `autorizacionComprobante` | `http://ec.gob.sri.ws.autorizacion` | `claveAccesoComprobante` (string) | `RespuestaAutorizacionComprobante` |
| `autorizacionComprobanteLote` | `http://ec.gob.sri.ws.autorizacion` | `claveAccesoLote` (string) | `RespuestaAutorizacionLote` |

- All WSDLs declare `elementFormDefault="unqualified"`, `style="document"`, `use="literal"`, and `soapAction=""` — [Recepción WSDL][W-REC-T].
- Field types that matter — [Autorización WSDL][W-AUT-T]: `numeroComprobantes` is `xs:string`, `fechaAutorizacion` is `xs:dateTime`, `comprobante` is `xs:string` (XML wrapped in CDATA), and every field is `minOccurs="0"`, so any can be absent.
- `mensaje` has `identificador`, `mensaje`, `informacionAdicional`, `tipo` — [WSDL][W-REC-T].

**Request: recepción.** Built from the WSDL. Not live-tested, because I did not submit a document to SRI.

```xml
POST /comprobantes-electronicos-ws/RecepcionComprobantesOffline HTTP/1.1
Host: celcer.sri.gob.ec
Content-Type: text/xml; charset=utf-8
SOAPAction: ""

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4...</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>
```

`<xml>` holds the base64 of the signed XML file's exact UTF-8 bytes — [WSDL type][W-REC-T]; [F2.34 §7.2.3 p.17][F2.34] describes it as the signed comprobante file.

**Response: RECIBIDA** — [F2.34 p.17][F2.34]

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
      <RespuestaRecepcionComprobante>
        <estado>RECIBIDA</estado>
        <comprobantes/>
      </RespuestaRecepcionComprobante>
    </ns2:validarComprobanteResponse>
  </soap:Body>
</soap:Envelope>
```

**Response: DEVUELTA** — [F2.34 pp.17-18][F2.34]

```xml
<RespuestaRecepcionComprobante>
  <estado>DEVUELTA</estado>
  <comprobantes>
    <comprobante>
      <claveAcceso>1702201205176001321000110010030001000011234567816</claveAcceso>
      <mensajes>
        <mensaje>
          <identificador>35</identificador>
          <mensaje>DOCUMENTO INVÁLIDO</mensaje>
          <informacionAdicional>Se encontró el siguiente error en la estructura del comprobante: cvc-complex-type.2.4.a: Invalid content was found starting with element 'totalSinImpuestos'. One of '{fechaEmisionDocSustento}' is expected.</informacionAdicional>
          <tipo>ERROR</tipo>
        </mensaje>
      </mensajes>
    </comprobante>
  </comprobantes>
</RespuestaRecepcionComprobante>
```

**Request: autorización.** Live-tested and working — [live test][LIVE].

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>0311202601179001234500120010010000001231234567814</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>
```

**Response: AUTORIZADO** — [F2.34 pp.18-19][F2.34]

```xml
<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion">
  <RespuestaAutorizacionComprobante>
    <claveAccesoConsultada>0503201201176001321000110010030009900641234567814</claveAccesoConsultada>
    <numeroComprobantes>1</numeroComprobantes>
    <autorizaciones>
      <autorizacion>
        <estado>AUTORIZADO</estado>
        <numeroAutorizacion>0503201201176001321000110010030009900641234567814</numeroAutorizacion>
        <fechaAutorizacion>2012-03-05T16:57:34.997-05:00</fechaAutorizacion>
        <ambiente>PRUEBAS</ambiente>
        <comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0"><!-- signed invoice --></factura>]]></comprobante>
        <mensajes>
          <mensaje>
            <identificador>60</identificador>
            <mensaje>ESTE PROCESO FUE REALIZADO EN EL AMBIENTE DE PRUEBAS</mensaje>
            <tipo>ADVERTENCIA</tipo>
          </mensaje>
        </mensajes>
      </autorizacion>
    </autorizaciones>
  </RespuestaAutorizacionComprobante>
</ns2:autorizacionComprobanteResponse>
```

**Response: no autorizado.** The ficha's example at [F2.34 p.19][F2.34] has the same shape, no `numeroAutorizacion`, and an error such as `46 / RUC no existe / ERROR`. It prints `estado` as `RECHAZADO`; see the conflict in section 3.

**Live responses not in the ficha** — [live test][LIVE]:

Unknown but well-formed key (HTTP 200):
```xml
<RespuestaAutorizacionComprobante>
  <claveAccesoConsultada>0311202601179001234500120010010000001231234567814</claveAccesoConsultada>
  <numeroComprobantes>0</numeroComprobantes>
  <autorizaciones/>
</RespuestaAutorizacionComprobante>
```

Empty key (HTTP 200). Note the `RECHAZADA` state, and that `tipo` and `numeroComprobantes` are absent:
```xml
<RespuestaAutorizacionComprobante>
  <claveAccesoConsultada></claveAccesoConsultada>
  <autorizaciones><autorizacion>
    <estado>RECHAZADA</estado>
    <mensajes><mensaje>
      <identificador>80</identificador>
      <mensaje>ERROR EN LA ESTRUCTURA DE LA CLAVE DE ACCESO</mensaje>
      <informacionAdicional>Error al consultar la clave acceso. Error longitud clave acceso no valida.</informacionAdicional>
    </mensaje></mensajes>
  </autorizacion></autorizaciones>
</RespuestaAutorizacionComprobante>
```

Key from the ficha's old example, on celcer (**HTTP 500 with a SOAP Fault**):
```xml
<soap:Fault><faultcode>soap:Server</faultcode>
<faultstring>javax.persistence.EntityNotFoundException: Unable to find ec.gob.sri.comprobantes.electronicos.persistencia.entidades.basicas.ComprobanteRecibidoBasico with id 17253016</faultstring></soap:Fault>
```

- **WSDL drift between environments.** Recepción and ConsultaComprobante are identical apart from the hostname (diff run live). Autorización differs: in **production** `respuestaLote` extends `respuestaSolicitud` and adds `comprobante` types; in **pruebas** it does not — [producción WSDL][W-AUT-P] vs [pruebas WSDL][W-AUT-T].
- Naming slips in the ficha: its parameter table calls the input `Xml` and the output `RespuestaComprobanteAutorizacion` — [F2.34 p.17][F2.34]. The WSDL says `xml` and `RespuestaRecepcionComprobante` — [WSDL][W-REC-T].

### Inferences
- Parse `comprobante` as a string and store it verbatim. Treat it as the legal artifact, and don't reserialize it.
- Hand-build the SOAP envelopes. A generated client pinned to one WSDL could mis-parse lot responses in the other environment, though the single-comprobante flow is unaffected.
- Treat HTTP 500 with a Fault as "unknown state, retry later", never as a rejection.

### Gaps
- A real AUTORIZADO, NO AUTORIZADO or EN PROCESO response could not be captured, since that needs a certified RUC and a real signature. Those shapes come from the ficha and open-source clients.
- Reception behaviour was not live-tested. Whether SRI accepts base64 with line breaks is unverified, so send it unwrapped.

## 3. Flow and states, polling, retries, duplicates, and lotes

### Takeaway
The flow is two-step and asynchronous: **send, get RECIBIDA or DEVUELTA; wait a configurable time; then poll by clave** until there is a terminal state, for up to **24 hours**. Keep the same clave and secuencial on every resend. **Never** resend while code 70 is active, and handle 43 by querying authorization rather than treating it as failure.

### Cited Findings
- Correct use is asynchronous: after RECIBIDA, "se debe esperar un determinado tiempo (se recomienda que este tiempo sea parametrizable)" before calling authorization, for PPR/AUT/NAT — [F2.34 §7.4 pp.19-20][F2.34]. No number of seconds is given.
- Maximum processing time is 24 hours from RECIBIDA — [F2.34 §5.12 p.14, §7.5 p.20][F2.34].
- It is the issuer's obligation to send the comprobante and verify that it is authorized — [F2.34 §5.12 p.14][F2.34].
- After NAT the issuer must correct, resend, and only then deliver to the receiver — [F2.34 §5.12 p.14][F2.34]; [§4.8 p.10][F2.34].
- Corrected resend uses "la misma clave de acceso y secuencial" — [F2.34 §5.10 p.14][F2.34]; [note 1 p.38][F2.34].
- Exception: when the file is right but issuance is impossible (RUC or establishment closed, RUC inactive, establishment closed), a resend will not help — [F2.34 note 1 p.38][F2.34].
- DEVUELTA comprobantes are **not** stored by SRI; only non-authorized ones are stored — [F2.34 note 1 p.38][F2.34].
- Code 70: do not resend, or generate another clave/secuencial, until an authorization or rejection arrives, within at most 24 hours — [F2.34 note 2 p.38][F2.34].
- Authorization history: the WS returns the authorized XML, but if a comprobante was non-authorized several times it "retornará únicamente el último estado" — [F2.34 §5.11 p.14][F2.34]. There may be several non-authorized responses and only one authorized — [F2.34 FAQ p.142][F2.34].
- Only the first validation failure is reported, in this order: (1) size, active schema, well-formed XML; (2) RUC, establishment, issuance authorization, document type; (3) clave and secuencial uniqueness, clave form; (4) signature, trust chain, OCSP; (5) fecha, receiver id, supporting documents; (6) differences — [F2.34 pp.38-39][F2.34].

**State strings.** The ficha mixes labels, so handle all of these:

| Service | Wire value | Meaning | Source | Action |
|---|---|---|---|---|
| Recepción | `RECIBIDA` | Passed first validation; not yet valid | [F2.34 p.17][F2.34] | Poll authorization |
| Recepción | `DEVUELTA` | Rejected; not stored | [F2.34 pp.18, 38][F2.34] | Branch on code, see section 5 |
| Autorización | `AUTORIZADO` | Valid | [F2.34 p.18][F2.34] | Store XML and date, deliver |
| Autorización | `NO AUTORIZADO` | Rejected, stored | [librejv][librejv], [key49][key49-ops] | Fix and resend, same clave |
| Autorización | `RECHAZADO` | Printed in the ficha's example | [F2.34 p.19][F2.34] | Treat as NO AUTORIZADO |
| Autorización | `RECHAZADA` | Query error (code 80) | [live test][LIVE]; [librejv][librejv] | Client bug |
| Autorización | `EN PROCESO` | Processing (ficha's "PPR") | [librejv][librejv] | Keep polling |
| Autorización | `numeroComprobantes=0` | No record found | [live test][LIVE] | Depends on age, see below |

- **Conflict:** `RECHAZADO` in the ficha's example vs `NO AUTORIZADO` in real clients — [F2.34 p.19][F2.34] vs [librejv][librejv]. The siglas PPR/AUT/NAT are descriptive labels in the ficha; no source I read shows them on the wire — [F2.34 Tabla 6 p.14][F2.34].
- **`numeroComprobantes=0` has no meaning in the ficha.** Clients disagree: librejv's comment says SRI returns 0 when it has internal errors and it resends — [librejv][librejv]. Key49 waits while the send is recent (under 10 minutes) and then re-issues — [key49 operations][key49-ops].
- Key49 also reports an authorization lookup window ("~del mismo día"): older authorized documents return 0 even when authorized — [key49 operations][key49-ops]. This is one project's unverified claim. My old-key test produced a Fault rather than 0, on the test host only, so it neither confirms nor refutes it — [live test][LIVE].
- Code 43 ("CLAVE ACCESO REGISTRADA") arrives as DEVUELTA in practice — [datil][datil]. The FAQ's fix is to check whether the clave was already authorized — [F2.34 p.141][F2.34]. Key49 and factutienda reconcile instead of resending — [key49 operations][key49-ops], [factutienda][factutienda].
- Polling and timeout values seen in clients, none from SRI: 3 s between polls — [factutienda][factutienda]; a 2 s initial wait and 30 s timeout — [Intuit-EC][intuit]; 5 s connect and 25 s read, with retries at 5/15/45/135/405 s for infrastructure errors only — [key49][key49-ops]. Key49's other sections quote 3 s and 5 s timeouts, so it is internally inconsistent — [key49 architecture][key49-arch].
- Key49 claims authorization queries must be **sequential** ("el SRI rechaza paralelas") and that SRI emits intermittent HTTP 302s — [key49 architecture][key49-arch]. One unverified source.

**Lote** — [F2.34 §7.5 and Tablas 8-9 pp.20-21][F2.34]:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<lote version="1.0.0">
  <claveAcceso>2808201400179210439400110010010000000091234567812</claveAcceso>
  <ruc>1792104394001</ruc>
  <comprobantes>
    <comprobante><![CDATA[COMPROBANTE]]></comprobante>
    <comprobante><![CDATA[COMPROBANTE]]></comprobante>
  </comprobantes>
</lote>
```

The lote has its own 49-digit clave, with a serie and secuencial assigned only to the lote send. Results are read through `autorizacionComprobanteLote` — [F2.34 pp.18, 20-21][F2.34].

### Inferences
Recommended client state machine. This is my synthesis, not SRI's text:

1. Persist the signed XML and clave **before** the first network call. On timeout, the outcome is unknown.
2. Send. On `RECIBIDA`, or `DEVUELTA` with 43 or 70, go to polling. Never mint a new clave.
3. Poll at about 2 s, 3 s, 5 s, 10 s, then back off to minutes in a background job, up to 24 hours. Keep the POS flow non-blocking, since 24 hours is the contractual ceiling.
4. Scan every `autorizacion` entry and prefer `AUTORIZADO` if present, because history can contain several.
5. `numeroComprobantes=0`: within a short grace period, keep polling. If it persists and reception was never confirmed, resend the **same** signed XML; a duplicate then surfaces as 43 or 70 rather than causing double issuance.
6. Timeouts, HTTP 5xx, Faults and code 50: retry with backoff. Business errors: stop and surface to a human.
7. Skip lotes for a POS. They add a second clave series and shrink nothing for a one-at-a-time, real-time issuer.

### Gaps
- No SRI-published value for wait time, poll count, or the lookup window. The 24-hour limit is the only firm number.
- The contents of `autorizacionComprobanteLote` responses could not be observed live.
- Whether a `DEVUELTA` with 70 can occur on first send is unclear. Key49 treats it as "not confirmed" and resends, which conflicts with note 2's instruction not to resend — [key49 operations][key49-ops] vs [F2.34 p.38][F2.34]. Follow the ficha.

## 4. Clave de acceso: structure and Módulo 11

### Takeaway
It is a fixed 49-digit string, and the check digit uses weights 2 to 7 cycling from the right, with **11 becoming 0 and 10 becoming 1**. I verified this algorithm against the ficha's example and samples.

### Cited Findings
- Structure, from [F2.34 §5.2 Tabla 1 p.11][F2.34]; positions are computed:

| Pos | Len | Field | Format / values |
|---|---|---|---|
| 1-8 | 8 | Fecha de emisión | `ddmmaaaa` |
| 9-10 | 2 | Tipo de comprobante | `01` factura, `03` liquidación de compra, `04` nota de crédito, `05` nota de débito, `06` guía de remisión, `07` retención ([Tabla 3 p.12][F2.34]) |
| 11-23 | 13 | RUC | `1234567890001` |
| 24 | 1 | Ambiente | `1` pruebas, `2` producción ([Tabla 4 p.13][F2.34]) |
| 25-30 | 6 | Serie | establecimiento + punto de emisión, e.g. `001001` |
| 31-39 | 9 | Secuencial | zero-padded |
| 40-47 | 8 | Código numérico | issuer-defined |
| 48 | 1 | Tipo de emisión | `1` only ([Tabla 2 p.12][F2.34]) |
| 49 | 1 | Dígito verificador | Módulo 11 over the first 48 digits |

- Fields not padded to length make the key malformed and cause rejection — [F2.34 p.11][F2.34].
- The código numérico is a security mechanism whose algorithm is "potestad absoluta del contribuyente emisor" — [F2.34 p.11][F2.34].
- Rule: result 11 gives digit 0; result 10 gives digit 1 — [F2.34 p.11][F2.34].
- Ficha example: `41261533` with weights 3,2,7,6,5,4,3,2 gives 104; 104 mod 11 = 5; 11 - 5 = **6** — [F2.34 p.12][F2.34].

**Algorithm.** Run and asserted against the ficha's example:

```python
def digito_verificador(clave48: str) -> int:
    total = sum(int(c) * (2 + i % 6) for i, c in enumerate(reversed(clave48)))
    r = 11 - total % 11
    return 0 if r == 11 else 1 if r == 10 else r
```

**Worked examples** I computed. The RUC is fictitious:

| Case | First 48 digits | Sum | 11 - (sum mod 11) | DV |
|---|---|---|---|---|
| Normal | `031120260117900123450012001001000000123123456781` | 447 | 4 | 4 |
| Rule 11 | `031120260117900123450012001001000000001123456781` | 418 | 11 | 0 |
| Rule 10 | `031120260117900123450012001001000000010123456781` | 419 | 10 | 1 |

Full key for the normal case: `0311202601179001234500120010010000001231234567814` (03/11/2026, factura, producción, 001-001, secuencial 123, código 12345678, tipo 1). The code above reproduces all three rows.

- I ran the function over every distinct 49-digit string in the ficha's text: **20 of 22 pass**. The two failures are `2111202401176001321000110010010000011171234567810` — [F2.34 p.23][F2.34], stated DV 0, computed 5, used as a "not found" example — and `0403201301176815353000110015010000000081234567816` — [F2.34 pp.66, 77][F2.34], stated DV 6, computed 0, in XML format samples. Both look like illustrative keys rather than an algorithm conflict, since the other 20 pass. Don't use the ficha's keys as test vectors without checking.

### Inferences
- The date in the key must equal `<fechaEmision>`, and all fields must match the XML, or code 58 follows ([F2.34 p.37][F2.34]). Generate the key from the same values the XML uses.
- Persist the código numérico with the document. A fixed value per issuer is allowed, but a random one per document serves the stated security purpose better.

### Gaps
- None material.

## 5. Error and warning codes

### Takeaway
Ficha 2.34 lists **28 rejection codes, 4 warnings, and 6 issuer-side validations** in §11. Their meanings disagree with some open-source documents, so use the table below as the reference and don't copy lists from GitHub.

### Cited Findings
Codes and meanings from [F2.34 §11 pp.36-39][F2.34]. "Stage" is the ficha's: R recepción, A autorización, E emisor. The recovery column is my inference unless a note is cited.

| Code | Name | Meaning | Stage | Recovery |
|---|---|---|---|---|
| 2 | RUC del emisor NO ACTIVO | RUC must be ACTIVO | A | Block, reactivate at SRI; resend same clave |
| 10 | Establecimiento clausurado | Reopens automatically after closure ends | A | Hold and resend after |
| 26 | Tamaño máximo superado | File exceeds limit | R | Reduce file (320 KB limit) |
| 27 | Clase no permitido | Taxpayer class cannot issue | A | Admin issue |
| 28 | Acuerdo de medios electrónicos no aceptado | Agreement must be accepted | R | Accept in SRI en línea, resend |
| 35 | Documento inválido | Fails schema | R | Fix XML; read `informacionAdicional` |
| 36 | Versión esquema descontinuada | Wrong schema version | R | Change `version` attribute |
| 37 | RUC sin autorización de emisión | No issuance request | A | Request certification for this environment |
| 39 | Firma inválida | Signature not valid | A | Re-sign; see FAQ variants below |
| 40 | Error en el certificado | Not found or not X509 | A | Fix certificate embedding |
| 43 | Clave acceso registrada | Already in database | R | Query authorization; don't resend |
| 45 | Secuencial registrado | Already in database | R | Query that clave first; a real collision means a sequence bug |
| 46 | RUC no existe | Issuer RUC not in the registry | A | Check RUC; see conflict below |
| 47 | Tipo de comprobante no existe | Not in catalog | R | Fix `codDoc` |
| 48 | Esquema XSD no existe | No schema for this type | R | Fix type or version |
| 49 | Argumentos nulos | WS called with null args | R | Client bug |
| 50 | Error interno general | Unexpected server error | R | Retry with backoff |
| 52 | Error en diferencias | Calculation error | A | Fix totals. Also listed under E |
| 56 | Establecimiento cerrado | Establishment closed | A | Fix at SRI |
| 57 | Autorización suspendida | Suspended, or no authorization at the emission date | A | Stop and escalate |
| 58 | Error en estructura de clave | Key differs from document | A | Rebuild key from the document |
| 63 | RUC clausurado | Closed by control process | A | Stop, escalate |
| 65 | Fecha de emisión extemporánea | Not sent in time for the emission type | E/R | Escalate; see section 7 |
| 67 | Fecha inválida | Date format error | R | Use `dd/mm/aaaa` |
| 70 | Clave de acceso en procesamiento | Previously sent, still processing | R | **Don't resend**; poll up to 24 h (note 2) |
| 80 | Error en estructura de clave | Query key over 49 digits, non-numeric, or empty | A | Client bug |
| 82 | Error en fecha de inicio de transporte | Before the guía's emission date | R | Fix date |
| 92 | Error al validar monto de devolución IVA | Doesn't match DIG-authorized value | R | Fix value |

Warnings, which do not block authorization — [F2.34 p.38][F2.34]:

| Code | Name | Meaning |
|---|---|---|
| 59 | Identificación no existe | Buyer's id does not exist |
| 60 | Ambiente ejecución | Issued in pruebas; always sent there |
| 62 | Identificación incorrecta | Buyer's id wrong, e.g. cédula fails check digit |
| 68 | Documento sustento | Related document does not exist as electronic |

Issuer-side validations the issuer should implement — [F2.34 note 3 p.39][F2.34]: 34 comprobante no autorizado, 42 certificado revocado (expired and not renewed), 52 error en diferencias, 64 código documento sustento, 65 fecha extemporánea, 69 identificación del receptor.

Consultation WS only — [F2.34 pp.23-25][F2.34]: 99 ERROR AL CONSULTAR DATOS DEL SERVICIO WEB.

- The question's list is covered: 35, 43, 45, 39, 26, 58, 52, 56, 65, 70 all appear above.
- FAQ for 39 — [F2.34 pp.139-140][F2.34]: "nodo comprobante no está firmado" means sign the node; "firma no corresponde con el contenido" is usually strange characters in text fields; "fecha de la firma posterior a la actual" means resend (SRI's servers use the `south-america.pool.ntp.org` NTP pool); "no existe el RUC en el certificado" means inspect the certificate.
- **Conflict inside the ficha:** code 46 means the *issuer's* RUC in the table — [p.37][F2.34] — but the FAQ says the RUC "en la identificación del receptor" — [p.141][F2.34].
- **Conflict in open-source docs:** Intuit-EC labels 65 as invalid signature and 70 as a key mismatch — [Intuit-EC][intuit]. Key49 labels 35 as already registered, 45 as date out of range, 52 as invalid XML and 65 as a future date — [key49 operations][key49-ops]. All contradict F2.34; I treat these as those projects' errors. Key49's handling of 43 and 70 elsewhere still matches the ficha.

### Inferences
- Branch on `identificador`, and log `mensaje` and `informacionAdicional` as-is.
- Three classes suffice: **transient** (network, 5xx, Fault, 50), **reconcile** (43, 45, 70), **terminal until a human acts** (everything else).

### Gaps
- Codes outside this list could still appear. Treat unknown codes as terminal and alert.

## 6. Contingency

### Takeaway
**Contingency keys no longer exist:** they were removed in ficha 2.0 (2015), and `tipoEmision` has one valid value, `1`. The ficha has **no outage procedure at all**. From 1 January 2026 the rule is immediate transmission, and I found no official exception for SRI outages.

### Cited Findings
- "Se elimina las claves de uso complementario (contingencia)" — [F2.34 log v2.0, 05/08/2015, p.5][F2.34]. That is the only occurrence of "contingencia" in the document (full-text search).
- Tabla 2 lists only `1 Emisión normal`; "Para el método de autorización offline, solo existe el tipo de emisión normal" — [F2.34 p.12][F2.34]. Corroborated by [Deley][deley].
- The word "indisponibilidad" does not appear in F2.34 (full-text search). The ficha describes the service as high availability — [F2.34 §7.3 p.19][F2.34].
- Deadline history: within 72 hours, Res. NAC-DGERCGC22-00000064 — [Sovos][sovos22]; **four business days**, Res. NAC-DGERCGC24-00000035 of 30/10/2024 — [NMS Law][nms]; **immediate from 01/01/2026** — [HLB][hlb], [Primicias][primicias].
- HLB: "La transmisión de 4 días se mantiene hasta el 31 de diciembre 2025 y la inmediata desde el 1 de enero del 2026" — [HLB][hlb]. Siigo attributes the rule to NAC-DGERCGC25-00000017 — [Siigo][siigo].
- Primicias' article gives no exception for SRI failures — [Primicias][primicias]. The 2024 electricity emergency allowed preprinted comprobantes up to 5% of the prior year's total, under a temporary transitional rule — [NMS Law][nms].
- Siigo recommends a contingency log (date, time, cause), an emergency issuance mode, and sending pending items as soon as the contingency ends — [Siigo][siigo]. This is a vendor blog's advice, not a rule.

### Inferences
What to do when SRI is down:

1. Generate and sign the XML at sale time. The clave is issuer-generated, so a valid key exists without SRI.
2. Queue it, keeping the **same clave and `fechaEmision`**. Do not re-date to dodge a rejection.
3. Retry with backoff, and record outage evidence (timestamps and errors).
4. Don't deliver it as an authorized comprobante until AUTORIZADO, per [F2.34 §4.8 p.10][F2.34]. Whether a provisional ticket is legally acceptable is a tax question.

### Gaps
- **Most important legal gap:** I did not obtain the official text of NAC-DGERCGC25-00000017 or the amended NAC-DGERCGC18-00000233, so I cannot say whether they cover SRI outages. An accountant or the Registro Oficial should confirm this before launch.
- Sources disagree on when immediate transmission began: one search summary attributed 1 August 2025 to Primicias, whereas the fetched Primicias article and HLB both say 1 January 2026. I use 1 January 2026, and it is past either way.
- The old pre-2015 `tipoEmision` values were not verified, as they are not in F2.34.

## 7. Technical constraints

### Takeaway
Hard published limits are few: UTF-8, **320 KB per comprobante**, **500 KB or about 50 comprobantes per lote**, XAdES-BES with RSA-SHA1 and 2048-bit keys, and a 24-hour processing ceiling. The ficha publishes **no** TLS version, timeout, rate limit, IP rule, or date tolerance.

### Cited Findings
- Encoding UTF-8 — [F2.34 Tabla 7 p.15][F2.34]; `&` must be written `&amp;` — [glossary p.136][F2.34].
- Sizes: "500 kb o 50 comprobantes aproximadamente"; 320 Kb per comprobante individually — [F2.34 §7.5 p.20][F2.34]. **Internal conflict:** the same page later says "máximo 50 comprobantes (512 kb)". It isn't stated whether limits apply before or after base64.
- Signature: XAdES_BES, schema 1.3.2, ENVELOPED, RSA-SHA1, 2048-bit, PKCS12 `.p12` — [F2.34 §6 pp.15-16][F2.34].
- Observed TLS on 2026-11-03: **TLS 1.2**, ECDHE-ECDSA-AES128-GCM-SHA256, HTTP/1.1, no ALPN agreement, on both hosts. Certificates from DigiCert Global G2 TLS RSA SHA256 2020 CA1 validate against the standard trust store. They expire **14 Jan 2027 (cel)** and **10 Feb 2027 (celcer)** — [live test of test host][LIVE].
- Don't hardcode SRI's TLS certificates; they can change without notice — [F2.34 §7.1.4 pp.16-17][F2.34].
- Minimum connectivity: broadband above 256 Kbps — [F2.34 §7.1.2 p.16][F2.34].
- Date tolerance: error 65 exists, but the ficha gives no number of days — [F2.34 pp.37, 39][F2.34]. `fechaEmision` format is `dd/mm/aaaa` — [F2.34 Anexo 1 p.49][F2.34].
- Alphanumeric fields must not contain spaces "generated" between characters; it can cause schema rejection or no response — [F2.34 Anexo 1 p.48][F2.34].
- Decimals: 2 in version 1.0.0 and 6 in 1.1.0 — [F2.34 FAQ p.141][F2.34].
- Test environment: certification is required, requested once per environment; comprobantes there have no tax or legal validity; **no stress or mass testing** — [F2.34 §4.3 pp.9-10][F2.34]. Receiver name may be `PRUEBAS SERVICIO DE RENTAS INTERNAS` — [F2.34 §5.6 p.13][F2.34].
- Prerequisites: active status, up to date on obligations, and a registered débito agreement — [F2.34 §4.3 p.9][F2.34].

### Inferences
- Use the system trust store and no pinning, because both certificates expire around January-February 2027 and will be replaced.
- Parse `fechaAutorizacion` with its `-05:00` offset rather than assuming UTC.
- Validate size before sending. A long ticket line-item list is the realistic way to hit 320 KB.
- RSA-SHA1 is deprecated in many crypto stacks, so confirm the chosen library can produce it.

### Gaps
- Rate limits and IP restrictions: nothing published. All my requests came from one IP without blocks, which proves little.
- Whether SRI **supports** TLS 1.3 could not be determined from one handshake. Minimum supported version is unknown.
- The server's own request timeout is unknown.

## 8. Authorization number and date

### Takeaway
In the offline scheme the **authorization number is the clave de acceso**: the same 49 digits, generated by the issuer before sending. A valid-looking number therefore proves nothing; only `estado=AUTORIZADO` does.

### Cited Findings
- The clave "se constituirá en el número de autorización" — [F2.34 §5.2 p.11][F2.34]; repeated at [§5.9 p.13][F2.34] and [glossary p.136][F2.34].
- The example response shows identical `claveAccesoConsultada` and `numeroAutorizacion` — [F2.34 p.18][F2.34].
- `fechaAutorizacion` is `xs:dateTime` — [WSDL][W-AUT-T], shown as `2012-03-05T16:57:34.997-05:00` — [F2.34 p.18][F2.34].
- `numeroAutorizacion` is absent from the non-authorized example, which still has a `fechaAutorizacion` — [F2.34 p.19][F2.34].
- `ambiente` is the string `PRUEBAS` in the example — [F2.34 p.18][F2.34]; the clave uses digit `1` or `2` — [Tabla 4 p.13][F2.34].

### Inferences
- Store clave, `fechaAutorizacion` and `ambiente` separately, and fill them only from an AUTORIZADO response. The date on a NO AUTORIZADO response isn't an authorization date.
- `AUTORIZADO` in a production flow should also be checked for `ambiente`, to catch misconfiguration. The production string is presumably `PRODUCCIÓN`, unverified.

### Gaps
- No real production response was observed, so the exact `ambiente` string for production is unconfirmed.

## 9. Consulting a comprobante

### Takeaway
There are three routes: the **public portal**, the **ConsultaComprobante WS** (status only, added in v2.31), and the **authorization WS** (returns the XML). They answer different questions, and only ConsultaComprobante exposes annulment state.

### Cited Findings
- Public portal: [validez de comprobantes][SRI-FE] at `https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf`, and validez de emisor at `.../publico/validezEmisor.jsf` — [SRI page][SRI-FE].
- Receivers are obliged to validate their comprobantes through the SRI portal — [F2.34 §5.12 p.14][F2.34].
- Consultation services, new in v2.31 — [F2.34 §8 pp.21-26][F2.34]: [ConsultaComprobante test][W-CON-T] / [producción][W-CON-P], and [ConsultaFactura test][W-FAC-T] on the same paths on `cel`. All returned HTTP 200 live.
- `consultarEstadoAutorizacionComprobante(claveAcceso)`, namespace `http://ec.gob.sri.ws.consultas` — [WSDL][W-CON-T]. Request — [F2.34 p.22][F2.34]:

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.consultas">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:consultarEstadoAutorizacionComprobante>
      <claveAcceso>0211202401050306179800120010020000000677300995216</claveAcceso>
    </ec:consultarEstadoAutorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>
```

Response — [F2.34 pp.22-23][F2.34]:

```xml
<EstadoAutorizacionComprobante>
  <claveAcceso>2111202405176001321000110010010000001241234567810</claveAcceso>
  <mensajes/>
  <estadoAutorizacion>AUTORIZADO</estadoAutorizacion>
  <tipoComprobante>Nota de Débito</tipoComprobante>
  <rucEmisor>1760013210001</rucEmisor>
  <fechaAutorizacion>2024-12-12T10:49:37-05:00</fechaAutorizacion>
</EstadoAutorizacionComprobante>
```

- `estadoAutorizacion` values: `AUTORIZADO`, `NO AUTORIZADO`, `PENDIENTE DE ANULAR`, `ANULADO` — [F2.34 p.22, §8.4 p.25][F2.34].
- Failure: `estadoConsulta=RECHAZADA`, code 99, with "No existen datos para los parámetros ingresados" or "la fecha de emisión está fuera del rango permitido" — [F2.34 p.23][F2.34]. **Conflict:** the prose says the value is in `estadoAutorizacion`, while the XML examples and [WSDL][W-CON-T] put it in `estadoConsulta`. Trust the WSDL.
- ConsultaFactura (`consultarEstadoConfirmacionFacturaComercialNegociable`) returns `estadoConfirmacion=SI`; it concerns factura comercial negociable only — [F2.34 pp.24-26][F2.34].
- ConsultaComprobante was not called live; only its WSDL was fetched.

### Inferences
- Use the authorization WS during issuance and to fetch XML. Use ConsultaComprobante for later status checks, including annulments and possibly documents outside any authorization lookup window.
- The WSDL declares no authentication policy, so it appears open like the others. I did not test this.
- Store the authorized XML at authorization time rather than relying on later retrieval.

### Gaps
- The "rango de fechas permitido" is not defined in F2.34.
- No SLA for the portal. A press report notes SRI acknowledged access intermittency from heavy mass-download demand, surfaced through a search summary; I didn't read that article in full.

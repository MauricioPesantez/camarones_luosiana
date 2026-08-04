#!/usr/bin/python3
"""Agente de impresion compatible con Python 3.6 y Linux i386."""

from __future__ import print_function

import calendar
import datetime
import errno
import json
import os
import random
import re
import signal
import socket
import sys
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


VERSION = "1.0.0-python"
ESC = 0x1B
GS = 0x1D
LINE_WIDTH = 42
ALIGN_LEFT = bytes(bytearray([ESC, 0x61, 0x00]))
ALIGN_CENTER = bytes(bytearray([ESC, 0x61, 0x01]))
INVERT_OFF = bytes(bytearray([GS, 0x42, 0x00]))
INVERT_ON = bytes(bytearray([GS, 0x42, 0x01]))
DEFAULT_LOGO_PATH = "/opt/restaurant-print-agent-python/assets/logo-camarones-louisiana.png"
WORKER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._:-]{1,100}$")
TIME_ZONE_PATTERN = re.compile(r"^[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*$")

_logo_cache = None
_logo_warning_shown = False


class ConfigError(Exception):
    pass


class ApiError(Exception):
    def __init__(self, message, status=0):
        Exception.__init__(self, message)
        self.status = status


class PrinterError(Exception):
    def __init__(self, message, code="PRINTER_ERROR"):
        Exception.__init__(self, message)
        self.code = code


class Config(object):
    pass


def log(level, event, **fields):
    entry = {
        "time": datetime.datetime.utcnow().isoformat() + "Z",
        "level": level,
        "event": event,
    }
    entry.update(fields)
    print(json.dumps(entry, ensure_ascii=False, sort_keys=True), flush=True)


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError("{} es requerido".format(name))
    return value


def integer(name, fallback, minimum, maximum):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError:
        raise ConfigError("{} debe ser un entero".format(name))
    if value < minimum or value > maximum:
        raise ConfigError(
            "{} debe ser un entero entre {} y {}".format(name, minimum, maximum)
        )
    return value


def boolean(name, fallback):
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return fallback
    if raw in ("true", "1", "yes", "on"):
        return True
    if raw in ("false", "0", "no", "off"):
        return False
    raise ConfigError("{} debe ser true o false".format(name))


def configure_timezone(name):
    if not TIME_ZONE_PATTERN.match(name) or ".." in name:
        raise ConfigError("POLL_TIME_ZONE debe ser una zona horaria IANA valida")
    zone_path = os.path.join("/usr/share/zoneinfo", name)
    if not os.path.isfile(zone_path):
        raise ConfigError("POLL_TIME_ZONE debe ser una zona horaria IANA valida")
    os.environ["TZ"] = name
    if hasattr(time, "tzset"):
        time.tzset()


def load_config():
    config = Config()
    config.api_base_url = required("API_BASE_URL").rstrip("/")
    parsed = urlparse(config.api_base_url)
    if parsed.scheme != "https" and parsed.hostname != "localhost":
        raise ConfigError("API_BASE_URL debe usar HTTPS")

    config.token = required("PRINT_AGENT_TOKEN")
    if len(config.token) < 32 or config.token.startswith("CHANGE_ME"):
        raise ConfigError("PRINT_AGENT_TOKEN debe ser una credencial nueva y segura")

    config.worker_id = required("WORKER_ID")
    if not WORKER_ID_PATTERN.match(config.worker_id):
        raise ConfigError("WORKER_ID contiene caracteres no permitidos")

    config.printer_ip = required("PRINTER_IP")
    config.printer_port = integer("PRINTER_PORT", 9100, 1, 65535)
    config.dry_run = boolean("DRY_RUN", True)
    config.poll_interval = integer("POLL_INTERVAL_MS", 5000, 500, 60000) / 1000.0
    config.poll_active_start_hour = integer("POLL_ACTIVE_START_HOUR", 12, 0, 23)
    config.poll_active_end_hour = integer("POLL_ACTIVE_END_HOUR", 21, 0, 23)
    config.poll_time_zone = os.environ.get(
        "POLL_TIME_ZONE", "America/Guayaquil"
    ).strip()
    configure_timezone(config.poll_time_zone)
    config.heartbeat_interval = integer(
        "HEARTBEAT_INTERVAL_MS", 30000, 5000, 300000
    ) / 1000.0
    config.request_timeout = integer(
        "REQUEST_TIMEOUT_MS", 10000, 1000, 60000
    ) / 1000.0
    config.printer_timeout = integer(
        "PRINTER_TIMEOUT_MS", 5000, 500, 30000
    ) / 1000.0
    config.logo_path = os.environ.get("PRINT_LOGO_PATH", DEFAULT_LOGO_PATH).strip()
    return config


class ApiClient(object):
    def __init__(self, config):
        self.config = config

    def request(self, path, body, retries=0):
        last_error = None
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        for attempt in range(retries + 1):
            request = Request(
                self.config.api_base_url + path,
                data=payload,
                headers={
                    "Authorization": "Bearer " + self.config.token,
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                response = urlopen(request, timeout=self.config.request_timeout)
                try:
                    raw = response.read().decode("utf-8")
                finally:
                    response.close()
                return json.loads(raw) if raw else {}
            except HTTPError as error:
                try:
                    data = json.loads(error.read().decode("utf-8"))
                    message = data.get("error") or "La API respondio {}".format(error.code)
                except Exception:
                    message = "La API respondio {}".format(error.code)
                last_error = ApiError(message, error.code)
                if 400 <= error.code < 500:
                    raise last_error
            except (URLError, socket.timeout, ValueError) as error:
                last_error = ApiError(str(error))

            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))

        if last_error:
            raise last_error
        raise ApiError("No se pudo contactar la API")

    def claim(self):
        result = self.request(
            "/api/print-agent/claim", {"workerId": self.config.worker_id}
        )
        return result.get("job")

    def complete(self, job_id):
        self.request(
            "/api/print-agent/jobs/{}/complete".format(quote(job_id, safe="")),
            {"workerId": self.config.worker_id},
            retries=3,
        )

    def fail(self, job_id, error_code, error_message):
        self.request(
            "/api/print-agent/jobs/{}/fail".format(quote(job_id, safe="")),
            {
                "workerId": self.config.worker_id,
                "errorCode": error_code,
                "errorMessage": error_message,
            },
            retries=3,
        )

    def heartbeat(self, reachable, last_error):
        self.request(
            "/api/print-agent/heartbeat",
            {
                "workerId": self.config.worker_id,
                "name": self.config.worker_id,
                "version": VERSION,
                "printerReachable": reachable,
                "lastError": last_error,
            },
        )


def ascii_text(value):
    if value is None:
        value = ""
    normalized = unicodedata.normalize("NFD", str(value))
    output = []
    for char in normalized:
        if unicodedata.combining(char):
            continue
        code = ord(char)
        if char == "\n" or 0x20 <= code <= 0x7E:
            output.append(char)
        else:
            output.append("?")
    return "".join(output)


def centered(value):
    clean = ascii_text(value)[:LINE_WIDTH]
    return " " * max(0, (LINE_WIDTH - len(clean)) // 2) + clean


def amount_line(label, amount):
    amount = float(amount or 0)
    value = "{}${:.2f}".format("-" if amount < 0 else "", abs(amount))
    clean_label = ascii_text(label)
    padding = max(1, LINE_WIDTH - len(clean_label) - len(value))
    return clean_label + " " * padding + value


def payment_method_label(order):
    if order.get("type") != "domicilio":
        return None
    value = order.get("paymentMethod")
    return value if value in ("efectivo", "transferencia") else None


def amount_lines_for_order(order):
    separator = "-" * LINE_WIDTH
    total = float(order.get("total") or 0)
    surcharge = float(order.get("surcharge") or 0)
    delivery = float(order.get("deliveryCost") or 0)
    subtotal = total - surcharge - delivery

    if order.get("type") == "local":
        return [separator, amount_line("TOTAL:", total)]
    if order.get("type") == "para_llevar":
        return [
            separator,
            amount_line("Subtotal productos:", subtotal),
            amount_line("Recipientes:", surcharge),
            separator,
            amount_line("TOTAL:", total),
        ]

    payment = payment_method_label(order)
    if payment == "efectivo":
        total_local = subtotal + surcharge
        return [
            separator,
            amount_line("Subtotal productos:", subtotal),
            amount_line("Recipientes:", surcharge),
            separator,
            amount_line("TOTAL:", total_local),
            separator,
            "DELIVERY:",
            amount_line("Envio:", delivery),
            amount_line("Cobra al cliente:", total_local + delivery),
        ]
    if payment == "transferencia":
        return [separator, amount_line("Envio:", delivery)]
    return []


def spice_level_label(value):
    labels = {
        "picante_1": "PICANTE 1",
        "picante_2": "PICANTE 2",
        "picante_3": "PICANTE 3",
        "leve": "LEVE",
        "natural": "NATURAL",
    }
    return labels.get(value) if value else None


def local_datetime(iso_value):
    if not iso_value:
        return "-"
    match = re.match(
        r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$", iso_value
    )
    if not match:
        return ascii_text(iso_value)
    parsed = datetime.datetime.strptime(match.group(1), "%Y-%m-%dT%H:%M:%S")
    epoch = calendar.timegm(parsed.timetuple())
    return time.strftime("%d/%m/%Y, %H:%M:%S", time.localtime(epoch))


def amendment_reference(order, revision):
    visible_number = order.get("dailyNumber")
    if visible_number is None:
        visible_number = order.get("shortCode")
    daily_date = order.get("dailyDate") or ""
    match = re.match(r"^\d{4}-(\d{2})-(\d{2})$", daily_date)
    visible_date = " {}-{}".format(match.group(2), match.group(1)) if match else ""
    return "ORDEN #{}{} REV {}".format(visible_number, visible_date, revision)


def amendment_quantity_delta(change):
    value = change.get("quantityDelta")
    if isinstance(value, int) and not isinstance(value, bool) and value != 0:
        return value
    return int(change.get("quantity") or 0) - int(change.get("previousQuantity") or 0)


def amendment_amount_delta(change):
    value = change.get("amountDelta")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def lines_for_payload(payload):
    order = payload.get("order") or {}
    if payload.get("payloadVersion") != 1 or not order.get("id"):
        raise PrinterError("Payload de impresion no soportado", "INVALID_PAYLOAD")

    job_type = payload.get("jobType")
    revision = int(payload.get("revision") or 0)
    visible_number = order.get("dailyNumber")
    if visible_number is None:
        visible_number = order.get("shortCode")

    if job_type == "ORDER":
        titles = [centered("ORDEN #{}".format(visible_number))]
    else:
        titles = [
            centered(payload.get("ticketLabel") or "REIMPRESION"),
            centered(amendment_reference(order, revision)),
        ]

    lines = ["=" * LINE_WIDTH] + titles + ["=" * LINE_WIDTH]
    if order.get("type") != "local":
        type_label = "PARA LLEVAR" if order.get("type") == "para_llevar" else "DOMICILIO"
        lines.append("Tipo: " + type_label)
    payment = payment_method_label(order)
    if payment:
        lines.append("Pago: " + payment.upper())
    if order.get("type") == "local":
        table = order.get("tableNumber")
        lines.append("Mesa: {}".format(table if table is not None else "-"))
    elif order.get("customerName"):
        lines.append("Cliente: " + str(order.get("customerName")))
    if order.get("customerPhone"):
        lines.append("Telefono: " + str(order.get("customerPhone")))

    date_value = payload.get("generatedAt") if job_type == "AMENDMENT" else order.get("createdAt")
    lines.append(
        "{}: {}".format("Hora mod." if job_type == "AMENDMENT" else "Hora", local_datetime(date_value))
    )
    lines.append("-" * LINE_WIDTH)

    if job_type == "AMENDMENT":
        total_delta = 0.0
        total_surcharge_delta = 0.0
        has_amount_delta = False
        for change in payload.get("changes") or []:
            quantity_delta = amendment_quantity_delta(change)
            amount_delta = amendment_amount_delta(change)
            prefix = "+" if quantity_delta > 0 else "-"
            courtesy = " [CORTESIA]" if change.get("complimentary") else ""
            lines.append(
                "{} {}x {}{}".format(
                    prefix,
                    abs(quantity_delta),
                    change.get("productName") or "Producto",
                    courtesy,
                )
            )
            change_spice = spice_level_label(change.get("spiceLevel"))
            if change_spice:
                lines.append("  Salsa Louisiana: " + change_spice)
            if amount_delta is not None:
                has_amount_delta = True
                total_delta += amount_delta
                lines.append(amount_line("  Cambio:", amount_delta))
            surcharge_delta = float(change.get("surchargeDelta") or 0)
            if surcharge_delta:
                total_surcharge_delta += surcharge_delta
                lines.append(amount_line("  Envases:", surcharge_delta))
            if change.get("observations"):
                lines.append("  Obs: " + str(change.get("observations")))
        lines.append("-" * LINE_WIDTH)
        if has_amount_delta:
            lines.append(amount_line("AJUSTE PRODUCTOS:", total_delta))
        else:
            lines.append("AJUSTE NO DISPONIBLE - REVISAR")
        if total_surcharge_delta:
            lines.append(amount_line("AJUSTE ENVASES:", total_surcharge_delta))
            if has_amount_delta:
                lines.append(
                    amount_line(
                        "AJUSTE TOTAL:", total_delta + total_surcharge_delta
                    )
                )
        if order.get("type") != "local":
            lines.append("NO REPETIR ENVIO NI RECIPIENTES")
    else:
        for item in order.get("items") or []:
            courtesy = " [CORTESIA]" if item.get("complimentary") else ""
            lines.append(
                "{}x {}{}".format(
                    item.get("quantity") or 0,
                    item.get("productName") or "Producto",
                    courtesy,
                )
            )
            item_spice = spice_level_label(item.get("spiceLevel"))
            if item_spice:
                lines.append("  Salsa Louisiana: " + item_spice)
            if item.get("observations"):
                lines.append("  Obs: " + str(item.get("observations")))

    has_item_spice = any(
        spice_level_label(item.get("spiceLevel"))
        for item in (order.get("items") or [])
    )
    legacy_spice = spice_level_label(order.get("spiceLevel"))
    if not has_item_spice and legacy_spice:
        lines.extend(["-" * LINE_WIDTH, "Salsa Louisiana: " + legacy_spice])
    if order.get("observations"):
        lines.extend(["-" * LINE_WIDTH, "OBSERVACIONES:", str(order.get("observations"))])
    if payload.get("reason"):
        lines.extend(["-" * LINE_WIDTH, "Motivo: " + str(payload.get("reason"))])
    if payload.get("requestedBy"):
        lines.append("Solicita: " + str(payload.get("requestedBy")))
    if job_type != "AMENDMENT":
        lines.extend(amount_lines_for_order(order))
    lines.extend(["=" * LINE_WIDTH, "", "", ""])
    return [ascii_text(line) for line in lines]


def encode_ticket_lines(lines):
    chunks = []
    for line in lines:
        emphasized = re.match(r"^(Tipo|Mesa):", line)
        selected = re.match(r"^(\s*Salsa Louisiana:) (.+)$", line)
        if emphasized:
            label = emphasized.group(0)
            chunks.extend(
                [
                    INVERT_ON,
                    label.upper().encode("ascii"),
                    INVERT_OFF,
                    (line[len(label):] + "\n").encode("ascii"),
                ]
            )
        elif selected:
            chunks.extend(
                [
                    (selected.group(1) + " ").encode("ascii"),
                    INVERT_ON,
                    (" " + selected.group(2) + " ").encode("ascii"),
                    INVERT_OFF,
                    b"\n",
                ]
            )
        else:
            chunks.append((line + "\n").encode("ascii"))
    return b"".join(chunks)


def encode_esc_pos_qr(data):
    value = str(data or "").encode("utf-8")
    if not value or len(value) > 1024:
        raise PrinterError("URL de cobro no valida", "INVALID_PAYMENT_URL")
    store_length = len(value) + 3
    return b"".join(
        [
            ALIGN_CENTER,
            b"ESCANEA PARA COBRAR\n",
            bytes(bytearray([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])),
            bytes(bytearray([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x05])),
            bytes(bytearray([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31])),
            bytes(
                bytearray(
                    [
                        GS,
                        0x28,
                        0x6B,
                        store_length & 0xFF,
                        (store_length >> 8) & 0xFF,
                        0x31,
                        0x50,
                        0x30,
                    ]
                )
            ),
            value,
            bytes(bytearray([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])),
            b"\nSe requiere iniciar sesion\nCamarones Louisiana 2026 v1.0\n\n\n",
            ALIGN_LEFT,
        ]
    )


def encode_esc_pos_raster(width, height, rgba):
    if width <= 0 or width > 576:
        raise ValueError("El ancho del logo debe estar entre 1 y 576 pixeles")
    if height <= 0 or height > 2047:
        raise ValueError("El alto del logo debe estar entre 1 y 2047 pixeles")
    if len(rgba) != width * height * 4:
        raise ValueError("Los datos RGBA del logo no coinciden con sus dimensiones")

    bytes_per_row = (width + 7) // 8
    raster = bytearray(bytes_per_row * height)
    for y in range(height):
        for x in range(width):
            pixel = (y * width + x) * 4
            alpha = rgba[pixel + 3] / 255.0
            red = 255 + (rgba[pixel] - 255) * alpha
            green = 255 + (rgba[pixel + 1] - 255) * alpha
            blue = 255 + (rgba[pixel + 2] - 255) * alpha
            grayscale = 0.2126 * red + 0.7152 * green + 0.0722 * blue
            if grayscale < 128:
                raster[y * bytes_per_row + x // 8] |= 0x80 >> (x % 8)

    header = bytes(
        bytearray(
            [
                GS,
                0x76,
                0x30,
                0x00,
                bytes_per_row & 0xFF,
                (bytes_per_row >> 8) & 0xFF,
                height & 0xFF,
                (height >> 8) & 0xFF,
            ]
        )
    )
    return header + bytes(raster)


def load_logo_raster(path):
    global _logo_cache
    if _logo_cache is not None:
        return _logo_cache
    try:
        from PIL import Image
    except ImportError:
        raise RuntimeError("Falta python3-pil para cargar el logo")

    image = Image.open(path).convert("RGBA")
    width, height = image.size
    rgba = bytearray()
    for pixel in image.getdata():
        rgba.extend(pixel)
    _logo_cache = encode_esc_pos_raster(width, height, rgba)
    return _logo_cache


def build_esc_pos_ticket(payload, logo_path=DEFAULT_LOGO_PATH, logo_raster=None):
    global _logo_warning_shown
    text = encode_ticket_lines(lines_for_payload(payload))
    logo = logo_raster
    if logo is None:
        try:
            logo = load_logo_raster(logo_path)
        except Exception as error:
            logo = b""
            if not _logo_warning_shown:
                _logo_warning_shown = True
                log("warn", "logo_load_failed", message=str(error))

    chunks = [bytes(bytearray([ESC, 0x40]))]
    if logo:
        chunks.extend([ALIGN_CENTER, logo, b"\n"])
    chunks.extend([ALIGN_LEFT, text])
    payment_url = (payload.get("order") or {}).get("paymentUrl")
    if payload.get("jobType") != "AMENDMENT" and payment_url:
        chunks.append(encode_esc_pos_qr(payment_url))
    chunks.append(bytes(bytearray([GS, 0x56, 0x42, 0x05])))
    return b"".join(chunks)


def printer_error_code(error):
    if isinstance(error, socket.timeout):
        return "ETIMEDOUT"
    code = getattr(error, "errno", None)
    if code in errno.errorcode:
        return errno.errorcode[code]
    return "PRINTER_ERROR"


def send_to_printer(config, payload):
    ticket = build_esc_pos_ticket(payload, logo_path=config.logo_path)
    try:
        connection = socket.create_connection(
            (config.printer_ip, config.printer_port), config.printer_timeout
        )
        try:
            connection.settimeout(config.printer_timeout)
            connection.sendall(ticket)
            connection.shutdown(socket.SHUT_WR)
        finally:
            connection.close()
    except (OSError, socket.timeout) as error:
        raise PrinterError(str(error), printer_error_code(error))


def check_printer(config):
    try:
        connection = socket.create_connection(
            (config.printer_ip, config.printer_port), config.printer_timeout
        )
        connection.close()
        return True, None
    except (OSError, socket.timeout) as error:
        return False, printer_error_code(error)


def is_polling_active(hour, start_hour, end_hour):
    if start_hour == end_hour:
        return True
    if start_hour < end_hour:
        return start_hour <= hour < end_hour
    return hour >= start_hour or hour < end_hour


def error_details(error):
    if isinstance(error, PrinterError):
        return error.code, str(error)
    if isinstance(error, ApiError):
        return "API_ERROR", str(error)
    return "AGENT_ERROR", str(error)


class Worker(object):
    def __init__(self, config):
        self.config = config
        self.api = ApiClient(config)
        self.stopping = False
        self.next_heartbeat = 0.0

    def stop(self, _signal=None, _frame=None):
        self.stopping = True

    def heartbeat_if_due(self, force=False):
        now = time.monotonic()
        if not force and now < self.next_heartbeat:
            return
        reachable, health_error = check_printer(self.config)
        self.api.heartbeat(reachable, health_error)
        self.next_heartbeat = now + self.config.heartbeat_interval
        log("info", "heartbeat", printerReachable=reachable)

    def run(self):
        log(
            "info",
            "agent_started",
            workerId=self.config.worker_id,
            dryRun=self.config.dry_run,
            python=sys.version.split()[0],
        )
        try:
            self.heartbeat_if_due(force=True)
        except Exception as error:
            code, message = error_details(error)
            log("warn", "initial_heartbeat_failed", code=code, message=message)

        if self.config.dry_run:
            log(
                "warn",
                "dry_run_enabled",
                message="El agente reporta salud pero no reclama ni imprime trabajos",
            )
            while not self.stopping:
                try:
                    self.heartbeat_if_due()
                except Exception as error:
                    code, message = error_details(error)
                    log("warn", "heartbeat_failed", code=code, message=message)
                time.sleep(1)
            return

        api_failures = 0
        was_polling_active = None
        while not self.stopping:
            try:
                self.heartbeat_if_due()
            except Exception as error:
                code, message = error_details(error)
                log("warn", "heartbeat_failed", code=code, message=message)

            hour = time.localtime().tm_hour
            polling_active = is_polling_active(
                hour,
                self.config.poll_active_start_hour,
                self.config.poll_active_end_hour,
            )
            if not polling_active:
                if was_polling_active is not False:
                    log(
                        "info",
                        "polling_paused_by_schedule",
                        startHour=self.config.poll_active_start_hour,
                        endHour=self.config.poll_active_end_hour,
                        timeZone=self.config.poll_time_zone,
                    )
                was_polling_active = False
                time.sleep(5)
                continue
            if was_polling_active is False:
                log("info", "polling_resumed_by_schedule")
            was_polling_active = True

            try:
                job = self.api.claim()
                api_failures = 0
                if not job:
                    time.sleep(self.config.poll_interval)
                    continue
                log(
                    "info",
                    "job_claimed",
                    jobId=job.get("id"),
                    orderId=job.get("ordenId"),
                    type=job.get("type"),
                    attempt=job.get("attempts"),
                )

                try:
                    send_to_printer(self.config, job.get("payload") or {})
                except Exception as error:
                    code, message = error_details(error)
                    log("error", "job_failed", jobId=job.get("id"), code=code, message=message)
                    self.api.fail(job.get("id"), code, message)
                    continue

                try:
                    self.api.complete(job.get("id"))
                    log("info", "job_completed", jobId=job.get("id"))
                except Exception as error:
                    code, message = error_details(error)
                    log(
                        "error",
                        "job_confirmation_failed",
                        jobId=job.get("id"),
                        code=code,
                        message=message,
                    )
                    raise
            except Exception as error:
                api_failures += 1
                base = min(30.0, 2 ** min(api_failures, 5))
                delay = base * (0.8 + random.random() * 0.4)
                code, message = error_details(error)
                log(
                    "warn",
                    "api_unavailable",
                    code=code,
                    message=message,
                    delayMs=int(delay * 1000),
                )
                time.sleep(delay)


def main():
    if sys.version_info < (3, 6):
        raise ConfigError("Se requiere Python 3.6 o superior")
    config = load_config()
    worker = Worker(config)
    signal.signal(signal.SIGTERM, worker.stop)
    signal.signal(signal.SIGINT, worker.stop)
    worker.run()
    log("info", "agent_stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log("error", "agent_fatal", message=str(error))
        sys.exit(1)

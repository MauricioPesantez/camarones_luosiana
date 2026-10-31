import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import agent


def payload(order_type="local", payment_method=None):
    return {
        "payloadVersion": 1,
        "jobType": "ORDER",
        "revision": 0,
        "ticketLabel": "ORDEN",
        "generatedAt": "2026-07-31T18:42:18.000Z",
        "order": {
            "id": "order-1",
            "shortCode": "a7c219",
            "dailyNumber": 123,
            "dailyDate": "2026-07-31",
            "type": order_type,
            "tableNumber": 8 if order_type == "local" else None,
            "customerName": None if order_type == "local" else "Carolina",
            "customerPhone": "0987654321" if order_type == "domicilio" else None,
            "observations": None,
            "surcharge": 0 if order_type == "local" else 1.25,
            "deliveryCost": 5 if order_type == "domicilio" else 0,
            "paymentMethod": payment_method,
            "total": 106.25 if order_type == "domicilio" else 31.75,
            "createdAt": "2026-07-31T18:42:18.000Z",
            "items": [
                {
                    "productName": "Arroz chaufa",
                    "quantity": 2,
                    "observations": None,
                    "spiceLevel": "leve",
                    "complimentary": False,
                }
            ],
        },
    }


class TicketTests(unittest.TestCase):
    def ticket_text(self, value):
        return agent.build_esc_pos_ticket(value, logo_raster=b"").decode(
            "ascii", errors="replace"
        )

    def test_local_ticket_and_inverted_table(self):
        ticket = agent.build_esc_pos_ticket(payload(), logo_raster=b"")
        text = ticket.decode("ascii", errors="replace")
        self.assertIn("ORDEN #123", text)
        self.assertIn(agent.INVERT_ON + b"MESA:" + agent.INVERT_OFF, ticket)
        self.assertIn("TOTAL:", text)
        self.assertNotIn("Tipo:", text)
        self.assertIn("2x Arroz chaufa", text)
        self.assertIn("Salsa Louisiana:", text)
        self.assertIn(" LEVE", text)
        self.assertIn(agent.INVERT_ON + b" LEVE " + agent.INVERT_OFF, ticket)

    def test_cash_delivery_amounts(self):
        text = self.ticket_text(payload("domicilio", "efectivo"))
        self.assertIn("Pago: EFECTIVO", text)
        self.assertIn("TOTAL:", text)
        self.assertIn("Envio:", text)
        self.assertIn("Cobra al cliente:", text)
        self.assertLess(text.index("TOTAL:"), text.index("Envio:"))

    def test_payment_qr_commands(self):
        value = payload("domicilio", "efectivo")
        url = "https://pos.example.com/ordenes/cobrar/token-seguro"
        value["order"]["paymentUrl"] = url
        ticket = agent.build_esc_pos_ticket(value, logo_raster=b"")
        self.assertIn(b"ESCANEA PARA COBRAR", ticket)
        self.assertIn(url.encode("utf-8"), ticket)
        self.assertIn(
            bytes(bytearray([agent.GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])),
            ticket,
        )

    def test_transfer_delivery_only_prints_delivery_amount(self):
        text = self.ticket_text(payload("domicilio", "transferencia"))
        self.assertIn("Pago: TRANSFERENCIA", text)
        self.assertIn("Envio:", text)
        self.assertNotIn("TOTAL:", text)
        self.assertNotIn("Subtotal productos:", text)
        self.assertNotIn("ESCANEA PARA COBRAR", text)

    def test_amendment_prints_delta(self):
        value = payload("para_llevar")
        value.update(
            {
                "jobType": "AMENDMENT",
                "ticketLabel": "MODIFICACION",
                "revision": 2,
                "reason": "Cliente agrego un producto",
                "requestedBy": "Daniel",
                "changes": [
                    {
                        "action": "ADD",
                        "productName": "Combo Simple",
                        "previousQuantity": 0,
                        "quantity": 1,
                        "quantityDelta": 1,
                        "amountDelta": 6.5,
                        "surchargeDelta": 1.25,
                        "observations": None,
                        "complimentary": False,
                    }
                ],
            }
        )
        text = self.ticket_text(value)
        self.assertIn("MODIFICACION", text)
        self.assertIn("ORDEN #123 31-07 REV 2", text)
        self.assertIn("+ 1x Combo Simple", text)
        self.assertIn("AJUSTE PRODUCTOS:", text)
        self.assertIn("AJUSTE ENVASES:", text)
        self.assertIn("AJUSTE TOTAL:", text)
        self.assertIn("NO REPETIR ENVIO NI RECIPIENTES", text)
        self.assertNotIn("Recipientes:", text)

    def test_checklist_products_sauces_notes_and_responsible(self):
        value = payload()
        value["order"].update({
            "observations": "Incluir cubiertos",
            "items": [
                {"productName": "Combo Mixto Small", "quantity": 2, "spiceLevel": "natural", "observations": "Salsa aparte"},
                {"productName": "Combo Simple", "quantity": 1, "spiceLevel": "picante_3"},
                {"productName": "Chorizo", "quantity": 1},
                {"productName": "Gaseosa Personal Coca", "quantity": 1, "complimentary": True},
            ],
        })
        ticket = agent.build_esc_pos_ticket(value, logo_raster=b"")
        text = ticket.decode("ascii")
        for product in ("[ ] 2x Combo Mixto Small", "[ ] 1x Combo Simple", "[ ] 1x Chorizo", "[ ] 1x Gaseosa Personal Coca [CORTESIA]"):
            self.assertIn(product, text)
        for level in (b"NATURAL", b"PICANTE 3"):
            self.assertIn(b"  [ ] Salsa Louisiana: " + agent.INVERT_ON + b" " + level + b" " + agent.INVERT_OFF, ticket)
        self.assertIn("  [ ] Obs: Salsa aparte", text)
        self.assertIn("[ ] OBSERVACIONES:\n    Incluir cubiertos", text)
        self.assertEqual(text.count("[ ]"), 8)
        self.assertEqual(text.count("Responsable:"), 1)

    def test_legacy_and_missing_spice(self):
        value = payload()
        value["order"]["spiceLevel"] = "leve"
        value["order"]["items"] = [{"productName": "Combo", "quantity": 1}]
        self.assertIn("[ ] Salsa Louisiana: LEVE", agent.lines_for_payload(value))
        del value["order"]["spiceLevel"]
        value["order"]["items"][0].update({"spiceLevel": "desconocido", "observations": " "})
        value["order"]["observations"] = " "
        text = self.ticket_text(value)
        self.assertNotIn("Salsa Louisiana:", text)
        self.assertNotIn("OBSERVACIONES:", text)
        self.assertNotIn("Obs:", text)

    def test_long_text_wraps_without_losing_content_or_repeating_boxes(self):
        value = payload()
        name = "Combo mixto con camarón jumbo y langostinos " + "X" * 70
        note = "Salsa aparte\r\n" + "Y" * 70
        value["order"]["items"] = [{"productName": name, "quantity": 2, "complimentary": True, "observations": note}]
        lines = agent.lines_for_payload(value)
        self.assertTrue(all(len(line) <= 42 for line in lines))
        self.assertEqual("\n".join(lines).count("[ ]"), 2)
        start = next(i for i, line in enumerate(lines) if line.startswith("[ ] 2x"))
        note_start = next(i for i, line in enumerate(lines) if line.startswith("  [ ] Obs:"))
        self.assertEqual(
            "".join("".join(lines[start:note_start]).split()),
            "".join(("[ ] 2x " + agent.ascii_text(name) + " [CORTESIA]").split()),
        )
        self.assertIn("Y" * 70, "".join("".join(lines[note_start:]).split()))

    def test_additions_removals_and_reductions_only_check_changes(self):
        for action, previous, quantity in (("ADD", 0, 1), ("REMOVE", 1, 0), ("UPDATE", 3, 2), ("UPDATE", 2, 3)):
            with self.subTest(action=action, quantity=quantity):
                value = payload()
                delta = quantity - previous
                value.update({
                    "jobType": "AMENDMENT", "ticketLabel": "MODIFICACION", "revision": 2,
                    "changes": [{"action": action, "previousQuantity": previous, "quantity": quantity,
                                 "quantityDelta": delta, "amountDelta": delta * 6.5,
                                 "productName": "Combo Simple", "spiceLevel": "picante_2", "observations": "Salsa aparte"}],
                })
                value["order"]["items"][0]["spiceLevel"] = None
                value["order"]["spiceLevel"] = "leve"
                value["order"]["observations"] = "Incluir cubiertos"
                text = self.ticket_text(value)
                self.assertNotIn("Arroz chaufa", text)
                self.assertNotIn(" LEVE ", text)
                self.assertIn("OBSERVACIONES (REFERENCIA):", text)
                self.assertNotIn("ESCANEA PARA COBRAR", text)
                if delta < 0:
                    self.assertIn("[ ] RETIRAR / NO PREPARAR:\n    - 1x Combo Simple", text)
                    self.assertNotIn("[ ] Salsa Louisiana:", text)
                    self.assertNotIn("[ ] Obs:", text)
                    self.assertEqual(text.count("[ ]"), 1)
                else:
                    self.assertIn("[ ] + 1x Combo Simple", text)
                    self.assertIn("  [ ] Salsa Louisiana:", text)
                    self.assertIn("  [ ] Obs: Salsa aparte", text)

    def test_reprint_has_blank_boxes_and_copy_warning(self):
        value = payload()
        value.update({"jobType": "REPRINT", "ticketLabel": "REIMPRESION", "revision": 3,
                      "reason": "Papel extraviado", "requestedBy": "Daniel"})
        text = self.ticket_text(value)
        for expected in ("REIMPRESION", "COPIA - NO PREPARAR DE NUEVO", "Motivo: Papel extraviado", "Solicita: Daniel"):
            self.assertIn(expected, text)
        self.assertEqual(text.count("[ ]"), 2)
        self.assertEqual(text.count("Responsable:"), 1)

    def test_raster_encoding(self):
        rgba = bytearray([0, 0, 0, 255, 255, 255, 255, 255])
        raster = agent.encode_esc_pos_raster(2, 1, rgba)
        self.assertEqual(raster[:4], bytes(bytearray([0x1D, 0x76, 0x30, 0x00])))
        self.assertEqual(raster[-1], 0x80)


class ScheduleTests(unittest.TestCase):
    def test_day_schedule(self):
        self.assertFalse(agent.is_polling_active(11, 12, 21))
        self.assertTrue(agent.is_polling_active(12, 12, 21))
        self.assertTrue(agent.is_polling_active(20, 12, 21))
        self.assertFalse(agent.is_polling_active(21, 12, 21))

    def test_overnight_schedule(self):
        self.assertTrue(agent.is_polling_active(23, 21, 4))
        self.assertTrue(agent.is_polling_active(2, 21, 4))
        self.assertFalse(agent.is_polling_active(12, 21, 4))


class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.original_environment = os.environ.copy()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_environment)
        if hasattr(agent.time, "tzset"):
            agent.time.tzset()

    def valid_environment(self):
        os.environ.update(
            {
                "API_BASE_URL": "https://example.com",
                "PRINT_AGENT_TOKEN": "a" * 32,
                "WORKER_ID": "cocina-python-i386-01",
                "PRINTER_IP": "192.168.18.113",
                "POLL_TIME_ZONE": "America/Guayaquil",
            }
        )

    def test_loads_python_36_compatible_defaults(self):
        self.valid_environment()
        config = agent.load_config()
        self.assertTrue(config.dry_run)
        self.assertEqual(config.printer_port, 9100)
        self.assertEqual(config.poll_interval, 5.0)

    def test_rejects_example_token(self):
        self.valid_environment()
        os.environ["PRINT_AGENT_TOKEN"] = "CHANGE_ME_GENERATE_A_NEW_RANDOM_TOKEN"
        with self.assertRaises(agent.ConfigError):
            agent.load_config()


if __name__ == "__main__":
    unittest.main()

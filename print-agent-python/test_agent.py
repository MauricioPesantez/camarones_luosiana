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

    def test_cash_delivery_amounts(self):
        text = self.ticket_text(payload("domicilio", "efectivo"))
        self.assertIn("Pago: EFECTIVO", text)
        self.assertIn("TOTAL:", text)
        self.assertIn("Envio:", text)
        self.assertIn("Cobra al cliente:", text)
        self.assertLess(text.index("TOTAL:"), text.index("Envio:"))

    def test_transfer_delivery_only_prints_delivery_amount(self):
        text = self.ticket_text(payload("domicilio", "transferencia"))
        self.assertIn("Pago: TRANSFERENCIA", text)
        self.assertIn("Envio:", text)
        self.assertNotIn("TOTAL:", text)
        self.assertNotIn("Subtotal productos:", text)

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

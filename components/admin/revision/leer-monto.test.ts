import assert from "node:assert/strict";
import { leerMonto } from "./leer-monto";

const validos: [string, number][] = [
  ["3", 3], ["3,00", 3], ["3.00", 3], [".5", 0.5], [",50", 0.5], ["9999.99", 9999.99], [" 3 ", 3],
];
for (const [texto, monto] of validos) assert.equal(leerMonto(texto), monto, `"${texto}"`);
for (const texto of ["0", "", "abc", "10000", "1.001", "1,2,3", ".", ",", "0,00", "-3"])
  assert.equal(leerMonto(texto), null, `"${texto}"`);
console.log("leer-monto tests passed");

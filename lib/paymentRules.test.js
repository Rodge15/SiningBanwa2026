import assert from "node:assert/strict";
import test from "node:test";
import { validatePaymentMethod, validatePaymentReference, validateProofFile } from "./paymentRules.js";

test("accepts a GCash reference and rejects a short one", () => {
  assert.equal(validatePaymentMethod("gcash").value, "gcash");
  assert.equal(validatePaymentMethod("cash").ok, false);
  assert.equal(validatePaymentReference("GCASH-1234").value, "GCASH-1234");
  assert.equal(validatePaymentReference("12").ok, false);
});

test("accepts a real PNG screenshot and rejects other files", () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 0,
  ]);
  const file = { size: png.length, type: "image/png" };

  assert.equal(validateProofFile(file, png).value.extension, "png");
  assert.equal(validateProofFile(file, Buffer.from("not an image")).ok, false);
  assert.equal(validateProofFile({ size: 0, type: "image/png" }, png).ok, false);
});

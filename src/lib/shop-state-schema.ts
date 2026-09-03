import { z } from "zod";

/** Keys we validate tightly (others pass through unchanged). */
export type ValidatedShopStateKey = "inventory" | "parties" | "documents" | "cart";

/** Loose object row — require id when present as array item, allow extra keys. */
const passthroughRow = z.object({}).passthrough();
const idRow = z.object({ id: z.string().min(1) }).passthrough();

export const inventoryShopStateSchema = z
  .object({
    overrides: z.record(z.any()).optional(),
    customParts: z.array(idRow).optional(),
    customCategories: z.array(passthroughRow).optional(),
  })
  .passthrough();

export const partiesShopStateSchema = z
  .object({
    clients: z.array(idRow).optional(),
    suppliers: z.array(idRow).optional(),
  })
  .passthrough();

export const documentsShopStateSchema = z.array(idRow);

export const cartShopStateSchema = z
  .object({
    documentKind: z.any().optional(),
    lines: z.array(passthroughRow).optional(),
    partyId: z.string().optional(),
    partyName: z.string().optional(),
    heldCarts: z.array(passthroughRow).optional(),
  })
  .passthrough();

const schemaByKey: Record<ValidatedShopStateKey, z.ZodTypeAny> = {
  inventory: inventoryShopStateSchema,
  parties: partiesShopStateSchema,
  documents: documentsShopStateSchema,
  cart: cartShopStateSchema,
};

function isValidatedKey(key: string): key is ValidatedShopStateKey {
  return key in schemaByKey;
}

/**
 * Validate a shop_state JSON blob for known keys.
 * Returns the original value on success, or an error when the shape is unsafe.
 */
export function parseShopStateValue<T>(
  key: string,
  value: unknown,
): { ok: true; value: T } | { ok: false; error: string } {
  if (!isValidatedKey(key)) return { ok: true, value: value as T };
  const schema = schemaByKey[key];
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: value as T };
  const detail = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Invalid shop_state:${key}${detail ? ` — ${detail}` : ""}` };
}

/** OpenAI tool schemas for the in-app shop assistant. */

export const SHOP_CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "who_owes_me",
      description: "List clients with an open balance (Who owes me / client dues).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client",
      description: "Find a client by name and show contact plus net due.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client name or contact name" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client_invoices",
      description: "List a client's invoices with paid / remaining / fulfillment.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_paid_vs_received",
      description:
        "For a client: money paid, money of paid parts already received (delivered/picked up), and paid parts still waiting.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_parts",
      description: "Search inventory by part number, name, or OEM code.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_cart",
      description: "Add a catalog part to the operator cart (they still finish checkout).",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          qty: { type: "number", description: "Quantity, default 1" },
        },
        required: ["partNumber"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_payment",
      description:
        "Record a real payment (creates a receipt). Prefer this when the operator says the client paid. Confirm with the operator in the UI before it runs.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string" },
          amount: { type: "number" },
          method: { type: "string", enum: ["Cash", "OMT", "Whish"] },
          invoiceId: { type: "string", description: "Optional specific invoice id" },
          mobile: { type: "string", description: "Required for OMT and Whish" },
        },
        required: ["clientName", "amount", "method"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_client",
      description: "Open that client's page in the app.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];

export const SHOP_CHAT_CONFIRM_TOOLS = new Set(["record_payment"]);

export const SHOP_CHAT_SYSTEM = `You are the Parts Village shop assistant (Lebanon, heavy-equipment parts).
Reply in the same language the operator used — English, Arabic, or mixed.
You can look up clients, dues, invoices, paid-vs-received parts, and stock, add parts to the cart, record payments, and open a client page.
Never invent invoice numbers, receipts, quantities, or money. Always call a tool before stating figures.
Money is USD. If a tool returns no match, say so and ask for a clearer name or part number.
To sell, add parts to the cart; the operator finishes checkout.
Do not delete data. record_payment creates a real receipt — only when they clearly asked to record money received.`;

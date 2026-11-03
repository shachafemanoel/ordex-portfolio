import { describe, expect, it } from "vitest";
import {
  blockers,
  createOrder,
  initialOrders,
  targets,
  transition,
} from "@/src/demo";
import { OrderStatus as S } from "@/lib/order-status-type";

describe("standalone order flow", () => {
  it("completes an order only after readiness, scheduling and payment", () => {
    let order = createOrder("DEMO-1", "לקוח הדגמה", "מוצר הדגמה", 45000);
    expect(() => transition(order, S.COMPLETED, "")).toThrow();
    order = transition(order, S.PROCESSING, "");
    expect(blockers(order, S.READY, "")).toContain(
      "כל הפריטים חייבים להיות מוכנים (שוריינו מהמלאי או התקבלו מספק)",
    );
    order = transition(
      { ...order, items: [{ allocationStatus: "ALLOCATED" }] },
      S.READY,
      "",
    );
    expect(blockers(order, S.IN_TRANSIT, "")).toHaveLength(2);
    order = {
      ...order,
      scheduledAt: "2026-11-04",
      paidAmountCents: 45000,
      paymentStatus: "PAID",
    };
    order = transition(order, S.IN_TRANSIT, "");
    order = transition(order, S.COMPLETED, "נמסר ללקוח ההדגמה");
    expect(order.status).toBe(S.COMPLETED);
    expect(order.history).toHaveLength(5);
    expect(targets(order)).toEqual([]);
  });
  it("resumes only to the state before holding, with an audit trail", () => {
    const order = transition(
      createOrder("DEMO-1", "לקוח הדגמה", "מוצר", 100),
      S.PROCESSING,
      "",
    );
    expect(() => transition(order, S.ON_HOLD, "  ")).toThrow();
    const held = transition(order, S.ON_HOLD, "הלקוח ביקש");
    expect(targets(held)).toEqual([S.PROCESSING, S.CANCELLED]);
    expect(() => transition(held, S.READY, "")).toThrow();
    expect(transition(held, S.PROCESSING, "").previousStatus).toBeUndefined();
  });
  it("reset returns independent synthetic records", () => {
    const original = initialOrders();
    original[0].items[0].allocationStatus = "ALLOCATED";
    expect(initialOrders()[0].items[0].allocationStatus).toBe("PENDING");
    expect(
      original.every((order) => order.customerPhone === "0000000000"),
    ).toBe(true);
  });
});

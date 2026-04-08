import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageBusImpl } from "../bus.js";

describe("MessageBusImpl", () => {
  let bus: MessageBusImpl;

  beforeEach(() => {
    bus = new MessageBusImpl();
  });

  it("delivers published messages to subscribers", () => {
    const handler = vi.fn();
    bus.subscribe("test-channel", handler);

    bus.publish("test-channel", { value: 42 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it("does not deliver to unrelated channels", () => {
    const handler = vi.fn();
    bus.subscribe("channel-a", handler);

    bus.publish("channel-b", "hello");

    expect(handler).not.toHaveBeenCalled();
  });

  it("delivers to multiple subscribers on the same channel", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.subscribe("shared", handlerA);
    bus.subscribe("shared", handlerB);

    bus.publish("shared", "data");

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).toHaveBeenCalledOnce();
  });

  it("returns an unsubscribe function", () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("channel", handler);

    bus.publish("channel", "first");
    unsubscribe();
    bus.publish("channel", "second");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("first");
  });

  it("unsubscribing one handler does not affect others", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubA = bus.subscribe("channel", handlerA);
    bus.subscribe("channel", handlerB);

    unsubA();
    bus.publish("channel", "data");

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledOnce();
  });

  it("handles publishing to a channel with no subscribers", () => {
    // Should not throw
    expect(() => bus.publish("empty-channel", "data")).not.toThrow();
  });

  it("delivers messages in subscription order", () => {
    const order: string[] = [];
    bus.subscribe("ordered", () => order.push("first"));
    bus.subscribe("ordered", () => order.push("second"));
    bus.subscribe("ordered", () => order.push("third"));

    bus.publish("ordered", null);

    expect(order).toEqual(["first", "second", "third"]);
  });

  it("supports multiple channels independently", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.subscribe("channel-a", handlerA);
    bus.subscribe("channel-b", handlerB);

    bus.publish("channel-a", "for-a");
    bus.publish("channel-b", "for-b");

    expect(handlerA).toHaveBeenCalledWith("for-a");
    expect(handlerB).toHaveBeenCalledWith("for-b");
  });

  it("does not break when handler throws", () => {
    const badHandler = vi.fn(() => {
      throw new Error("handler error");
    });
    const goodHandler = vi.fn();

    bus.subscribe("channel", badHandler);
    bus.subscribe("channel", goodHandler);

    // Should not throw, and the second handler should still run
    expect(() => bus.publish("channel", "data")).not.toThrow();
    expect(goodHandler).toHaveBeenCalledOnce();
  });
});

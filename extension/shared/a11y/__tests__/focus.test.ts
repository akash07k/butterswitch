import { describe, it, expect, beforeEach } from "vitest";
import { focusFirst, focusNearest } from "../focus.js";

/**
 * Focus utilities use DOM APIs.
 * Vitest's JSDOM environment provides a minimal DOM.
 *
 * Note: innerHTML usage here is safe — these are test fixtures
 * with hardcoded content, not user-provided data.
 */
describe("focusFirst", () => {
  beforeEach(() => {
    document.body.textContent = "";
  });

  it("focuses the first focusable element in a container", () => {
    const container = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.textContent = "Not focusable";
    const button = document.createElement("button");
    button.id = "btn";
    button.textContent = "Click me";
    const input = document.createElement("input");
    input.id = "input";

    container.appendChild(paragraph);
    container.appendChild(button);
    container.appendChild(input);
    document.body.appendChild(container);

    focusFirst(container);

    expect(document.activeElement?.id).toBe("btn");
  });

  it("returns true when an element was focused", () => {
    const container = document.createElement("div");
    const button = document.createElement("button");
    button.textContent = "OK";
    container.appendChild(button);
    document.body.appendChild(container);

    const result = focusFirst(container);
    expect(result).toBe(true);
  });

  it("returns false when no focusable element exists", () => {
    const container = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.textContent = "No buttons here";
    container.appendChild(paragraph);
    document.body.appendChild(container);

    const result = focusFirst(container);
    expect(result).toBe(false);
  });
});

describe("focusNearest", () => {
  beforeEach(() => {
    document.body.textContent = "";
  });

  it("focuses the next sibling when the reference is removed", () => {
    const list = document.createElement("ul");
    const buttons: HTMLButtonElement[] = [];

    for (const id of ["a", "b", "c"]) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.id = id;
      btn.textContent = id.toUpperCase();
      li.appendChild(btn);
      list.appendChild(li);
      buttons.push(btn);
    }
    document.body.appendChild(list);

    // Simulate: B is focused and about to be removed
    const target = document.getElementById("b")!;
    focusNearest(target, buttons);

    // Should focus C (next after B)
    expect(document.activeElement?.id).toBe("c");
  });

  it("focuses the previous sibling when target is last", () => {
    const list = document.createElement("ul");
    const buttons: HTMLButtonElement[] = [];

    for (const id of ["a", "b", "c"]) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.id = id;
      btn.textContent = id.toUpperCase();
      li.appendChild(btn);
      list.appendChild(li);
      buttons.push(btn);
    }
    document.body.appendChild(list);

    const target = document.getElementById("c")!;
    focusNearest(target, buttons);

    // C is last, so focus B (previous)
    expect(document.activeElement?.id).toBe("b");
  });

  it("returns false when no alternative exists", () => {
    const btn = document.createElement("button");
    btn.id = "only";
    btn.textContent = "Only";
    document.body.appendChild(btn);

    const result = focusNearest(btn, [btn]);
    expect(result).toBe(false);
  });
});

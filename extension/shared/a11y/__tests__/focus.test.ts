import { describe, it, expect, beforeEach } from "vitest";
import { focusFirst } from "../focus.js";

/**
 * Focus utilities use DOM APIs.
 * Vitest's JSDOM environment provides a minimal DOM.
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

  it("skips disabled focusable elements", () => {
    const container = document.createElement("div");
    const disabled = document.createElement("button");
    disabled.id = "disabled";
    disabled.disabled = true;
    const enabled = document.createElement("button");
    enabled.id = "enabled";
    container.appendChild(disabled);
    container.appendChild(enabled);
    document.body.appendChild(container);

    focusFirst(container);

    expect(document.activeElement?.id).toBe("enabled");
  });

  it("respects tabindex=-1 by skipping it", () => {
    const container = document.createElement("div");
    const skipped = document.createElement("a");
    skipped.id = "skipped";
    skipped.href = "#";
    skipped.tabIndex = -1;
    const focusable = document.createElement("a");
    focusable.id = "focusable";
    focusable.href = "#";
    container.appendChild(skipped);
    container.appendChild(focusable);
    document.body.appendChild(container);

    focusFirst(container);

    expect(document.activeElement?.id).toBe("focusable");
  });
});

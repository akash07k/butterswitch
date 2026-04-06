import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("returns defaults when no args provided", () => {
    const opts = parseCliArgs([]);

    expect(opts.port).toBe(8089);
    expect(opts.file).toBeUndefined();
    expect(opts.level).toBe(0); // DEBUG
    expect(opts.tag).toBeUndefined();
    expect(opts.color).toBe(false);
  });

  it("parses --port", () => {
    const opts = parseCliArgs(["--port", "3000"]);
    expect(opts.port).toBe(3000);
  });

  it("parses -p as short for --port", () => {
    const opts = parseCliArgs(["-p", "4000"]);
    expect(opts.port).toBe(4000);
  });

  it("parses --file", () => {
    const opts = parseCliArgs(["--file", "output.log"]);
    expect(opts.file).toBe("output.log");
  });

  it("parses -f as short for --file", () => {
    const opts = parseCliArgs(["-f", "out.log"]);
    expect(opts.file).toBe("out.log");
  });

  it("parses --level", () => {
    const opts = parseCliArgs(["--level", "warn"]);
    expect(opts.level).toBe(2); // WARN
  });

  it("parses -l as short for --level", () => {
    const opts = parseCliArgs(["-l", "error"]);
    expect(opts.level).toBe(3); // ERROR
  });

  it("parses --tag", () => {
    const opts = parseCliArgs(["--tag", "sound-engine"]);
    expect(opts.tag).toBe("sound-engine");
  });

  it("parses -t as short for --tag", () => {
    const opts = parseCliArgs(["-t", "audio"]);
    expect(opts.tag).toBe("audio");
  });

  it("parses --color flag", () => {
    const opts = parseCliArgs(["--color"]);
    expect(opts.color).toBe(true);
  });

  it("parses multiple options together", () => {
    const opts = parseCliArgs([
      "-p",
      "9000",
      "-f",
      "log.txt",
      "-l",
      "info",
      "-t",
      "app",
      "--color",
    ]);

    expect(opts.port).toBe(9000);
    expect(opts.file).toBe("log.txt");
    expect(opts.level).toBe(1);
    expect(opts.tag).toBe("app");
    expect(opts.color).toBe(true);
  });
});

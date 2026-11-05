// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrateSettings, resolveTheme, sanitize, SETTINGS_BOOT_SCRIPT, SETTINGS_STORAGE_KEY } from "@/lib/settings/store";

afterEach(() => {
  localStorage.clear();
  const el = document.documentElement;
  for (const a of ["data-theme", "data-board-theme", "data-motion"]) el.removeAttribute(a);
});

describe("settings migration (v1 → v2)", () => {
  it("maps the old colored board themes to monochrome ones", () => {
    expect(migrateSettings({ boardTheme: "nocturne" }, 1).boardTheme).toBe("studio");
    expect(migrateSettings({ boardTheme: "glacier" }, 1).boardTheme).toBe("studio");
    expect(migrateSettings({ boardTheme: "walnut" }, 1).boardTheme).toBe("graphite");
    expect(migrateSettings({ boardTheme: "moss" }, 1).boardTheme).toBe("graphite");
    expect(migrateSettings({ boardTheme: "rosewood" }, 1).boardTheme).toBe("graphite");
    expect(migrateSettings({ boardTheme: "contrast" }, 1).boardTheme).toBe("contrast");
  });

  it("moves the old default piece set to Gloss but keeps an explicit Classic choice", () => {
    expect(migrateSettings({ pieceSet: "lumen" }, 1).pieceSet).toBe("gloss");
    expect(migrateSettings({}, 1).pieceSet).toBe("gloss");
    expect(migrateSettings({ pieceSet: "cburnett" }, 1).pieceSet).toBe("cburnett");
  });

  it("adds the interface theme and keeps everything else", () => {
    const m = migrateSettings({ boardTheme: "walnut", sound: false, volume: 0.3, ghostDelay: 5 }, 1);
    expect(m.theme).toBe("system");
    expect(m).toMatchObject({ sound: false, volume: 0.3, ghostDelay: 5 });
  });

  it("drops invalid values instead of breaking the UI", () => {
    expect(sanitize({ boardTheme: "neon", pieceSet: "plastic", theme: "sepia" })).toMatchObject({ boardTheme: "studio", pieceSet: "gloss", theme: "system" });
    expect(sanitize({ boardTheme: "moss" }).boardTheme).toBe("graphite");
  });

  it("defaults to the system theme, Studio board and Gloss pieces", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ theme: "system", boardTheme: "studio", pieceSet: "gloss" });
  });
});

describe("boot script (before first paint)", () => {
  const run = () => new Function(SETTINGS_BOOT_SCRIPT)();

  it("applies the saved theme, board theme and motion", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ state: { theme: "dark", boardTheme: "ink", motion: "reduced" }, version: 2 }));
    run();
    const el = document.documentElement;
    expect(el.getAttribute("data-theme")).toBe("dark");
    expect(el.getAttribute("data-board-theme")).toBe("ink");
    expect(el.getAttribute("data-motion")).toBe("reduced");
  });

  it("maps a board theme saved before the redesign", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ state: { boardTheme: "walnut" }, version: 1 }));
    run();
    expect(document.documentElement.getAttribute("data-board-theme")).toBe("graphite");
  });

  it("falls back to the OS theme and the Studio board with nothing saved", () => {
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe(resolveTheme("system"));
    expect(document.documentElement.getAttribute("data-board-theme")).toBe("studio");
  });

  it("survives a corrupt entry", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(run).not.toThrow();
    expect(document.documentElement.getAttribute("data-board-theme")).toBe("studio");
  });
});

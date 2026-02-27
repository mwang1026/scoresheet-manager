import { describe, it, expect } from "vitest";
import {
  NAV_ITEMS,
  MOBILE_PRIMARY_NAV,
  MOBILE_OVERFLOW_NAV,
} from "./nav-items";

describe("nav-items", () => {
  it("should have exactly 6 navigation items", () => {
    expect(NAV_ITEMS).toHaveLength(6);
  });

  it("should have correct hrefs for all items", () => {
    expect(NAV_ITEMS[0].href).toBe("/");
    expect(NAV_ITEMS[1].href).toBe("/players");
    expect(NAV_ITEMS[2].href).toBe("/news");
    expect(NAV_ITEMS[3].href).toBe("/draft");
    expect(NAV_ITEMS[4].href).toBe("/opponents");
    expect(NAV_ITEMS[5].href).toBe("/settings");
  });

  it("should have correct labels for all items", () => {
    expect(NAV_ITEMS[0].label).toBe("Dashboard");
    expect(NAV_ITEMS[1].label).toBe("Players");
    expect(NAV_ITEMS[2].label).toBe("News");
    expect(NAV_ITEMS[3].label).toBe("Draft");
    expect(NAV_ITEMS[4].label).toBe("Opponents");
    expect(NAV_ITEMS[5].label).toBe("Settings");
  });

  it("should have icons for all items", () => {
    NAV_ITEMS.forEach((item) => {
      expect(item.icon).toBeDefined();
      // lucide-react icons are objects/components, not plain functions
      expect(typeof item.icon).toMatch(/^(function|object)$/);
    });
  });

  it("should split mobile nav correctly (4 primary + 2 overflow)", () => {
    expect(MOBILE_PRIMARY_NAV).toHaveLength(4);
    expect(MOBILE_OVERFLOW_NAV).toHaveLength(2);

    expect(MOBILE_PRIMARY_NAV[0].label).toBe("Dashboard");
    expect(MOBILE_PRIMARY_NAV[1].label).toBe("Players");
    expect(MOBILE_PRIMARY_NAV[2].label).toBe("News");
    expect(MOBILE_PRIMARY_NAV[3].label).toBe("Draft");

    expect(MOBILE_OVERFLOW_NAV[0].label).toBe("Opponents");
    expect(MOBILE_OVERFLOW_NAV[1].label).toBe("Settings");
  });
});

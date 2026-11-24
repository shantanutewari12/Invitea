import { describe, expect, it } from "vitest";

import { fitWithin } from "./image-resize";

describe("fitWithin", () => {
  it("keeps images that already fit", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it("scales the longer edge down to the limit and keeps the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 6000, 1600)).toEqual({ width: 800, height: 1600 });
  });
  it("never produces a zero-sized edge", () => {
    expect(fitWithin(100000, 10, 1600).height).toBeGreaterThanOrEqual(1);
  });
});

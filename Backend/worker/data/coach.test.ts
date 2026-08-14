import { describe, expect, it } from "vitest";
import { queuedSession } from "./coach";

const deck = ["legs", "push", "pull", "legs-2"].map((id) => ({ id }));

describe("training queue", () => {
  it("keeps the first card next until a workout is completed", () => {
    expect(queuedSession(deck, 0)).toEqual({
      completedCount: 0,
      queueIndex: 0,
      sessionNumber: 1,
      session: deck[0],
    });
  });

  it("advances exactly one card per completed workout", () => {
    expect(queuedSession(deck, 1).session).toBe(deck[1]);
    expect(queuedSession(deck, 2).session).toBe(deck[2]);
    expect(queuedSession(deck, 3).session).toBe(deck[3]);
  });

  it("wraps the deck while the lifetime session number keeps increasing", () => {
    expect(queuedSession(deck, 13)).toEqual({
      completedCount: 13,
      queueIndex: 1,
      sessionNumber: 14,
      session: deck[1],
    });
  });

  it("has no next card when no plan is active", () => {
    expect(queuedSession([], 8)).toEqual({
      completedCount: 8,
      queueIndex: null,
      sessionNumber: null,
      session: null,
    });
  });
});

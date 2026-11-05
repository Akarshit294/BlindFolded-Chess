// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoveInput } from "@/components/game/MoveInput";

afterEach(cleanup);

function setup(chess: Chess, props: Partial<Parameters<typeof MoveInput>[0]> = {}) {
  const onMove = vi.fn();
  const onIllegal = vi.fn();
  const utils = render(<MoveInput chess={chess} hints="validate" onMove={onMove} onIllegal={onIllegal} {...props} />);
  const input = screen.getByTestId("move-input") as HTMLInputElement;
  const type = (text: string) => fireEvent.change(input, { target: { value: text } });
  const enter = () => fireEvent.keyDown(input, { key: "Enter" });
  return { ...utils, onMove, onIllegal, input, type, enter };
}

describe("MoveInput", () => {
  it("keeps the same, focused field after an illegal move", () => {
    const { input, type, enter, onIllegal } = setup(new Chess());
    input.focus();
    type("e5");
    act(() => enter());
    expect(onIllegal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("move-input")).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it("does not swap a complete but illegal move for a suggestion", () => {
    const chess = new Chess();
    chess.move("Nf3");
    chess.move("d5");
    const { type, enter, onMove, onIllegal } = setup(chess, { hints: "autocomplete" });
    type("f3"); // meant the pawn, but the knight stands there; knight moves are suggested
    expect(screen.getByRole("listbox", { name: "Suggestions" })).toBeTruthy();
    act(() => enter());
    expect(onMove).not.toHaveBeenCalled();
    expect(onIllegal).toHaveBeenCalledTimes(1);
  });

  it("still completes unfinished text with the highlighted suggestion", () => {
    const { type, enter, onMove } = setup(new Chess(), { hints: "autocomplete" });
    type("Nf");
    act(() => enter());
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]![0].san).toBe("Nf3");
  });

  it("drops disambiguation choices when the position changes or input is disabled", async () => {
    // Knights on b1 and f3 can both reach d2.
    const chess = new Chess("rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1");
    chess.move("d4");
    chess.move("d5");
    const { type, enter, onMove, rerender, onIllegal } = setup(chess);
    type("Nd2");
    act(() => enter());
    expect(screen.getByRole("listbox", { name: "Choose a move" })).toBeTruthy();

    // Disabled (e.g. the engine's turn): the chips can't play.
    rerender(<MoveInput chess={chess} hints="validate" onMove={onMove} onIllegal={onIllegal} disabled />);
    for (const b of screen.getAllByRole("option")) fireEvent.click(b);
    expect(onMove).not.toHaveBeenCalled();

    // A new position clears them.
    const next = new Chess(chess.fen());
    next.move("Nbd2");
    rerender(<MoveInput chess={next} hints="validate" onMove={onMove} onIllegal={onIllegal} />);
    // (The list fades out, so wait for the exit animation.)
    await waitFor(() => expect(screen.queryByRole("listbox", { name: "Choose a move" })).toBeNull());
  });
});

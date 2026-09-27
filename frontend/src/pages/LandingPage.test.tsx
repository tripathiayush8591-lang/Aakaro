// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getContext on HTMLCanvasElement for jsdom
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    });
    // Default matchMedia mock (standard motion)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(cleanup);

  it("renders the hero titles and tagline", () => {
    render(<LandingPage onEnterApp={() => {}} />);
    expect(screen.getAllByText("AAKARO").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Give your idea an identity.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Scroll to explore")).toBeTruthy();
  });

  it("renders the canvas and primary CTA button", () => {
    const handleEnter = vi.fn();
    render(<LandingPage onEnterApp={handleEnter} />);
    const cta = screen.getByRole("button", { name: "Enter Aakaro" });
    expect(cta).toBeTruthy();

    fireEvent.click(cta);
    expect(handleEnter).toHaveBeenCalledTimes(1);
  });

  it("supports prefers-reduced-motion cleanly", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const handleEnter = vi.fn();
    render(<LandingPage onEnterApp={handleEnter} />);

    const cta = screen.getByRole("button", { name: "Enter Aakaro" });
    expect(cta).toBeTruthy();
    fireEvent.click(cta);
    expect(handleEnter).toHaveBeenCalledTimes(1);
  });
});

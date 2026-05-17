/**
 * @jest-environment jsdom
 */
// ─────────────────────────────────────────────
// Unit tests: StatCard component
// ─────────────────────────────────────────────
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StatCard from "../components/StatCard";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Block Height" value="12345" />);

    expect(screen.getByText("Block Height")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<StatCard title="Latency" value="50ms" subtitle="RPC round-trip" />);

    expect(screen.getByText("RPC round-trip")).toBeInTheDocument();
  });

  it("shows dash when value is null/undefined", () => {
    render(<StatCard title="Peers" value={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("applies correct color class for sky (default)", () => {
    const { container } = render(<StatCard title="Test" value="100" />);
    const valueEl = container.querySelector(".text-sky-400");
    expect(valueEl).toBeInTheDocument();
  });

  it("applies correct color class for green", () => {
    const { container } = render(<StatCard title="Test" value="100" color="green" />);
    const valueEl = container.querySelector(".text-emerald-400");
    expect(valueEl).toBeInTheDocument();
  });

  it("applies correct color class for red", () => {
    const { container } = render(<StatCard title="Test" value="100" color="red" />);
    const valueEl = container.querySelector(".text-red-400");
    expect(valueEl).toBeInTheDocument();
  });
});

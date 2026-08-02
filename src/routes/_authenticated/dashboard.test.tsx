import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const auth = vi.hoisted(() => ({ current: { user: { email: "s@example.com" }, isAdmin: false } }));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth.current }));

vi.mock("@/features/results/components/AttemptHistory", () => ({
  AttemptHistory: () => <div data-testid="attempt-history" />,
}));

import { Route } from "./dashboard";

function renderDashboard() {
  const Component = (Route as unknown as { options: { component: () => React.ReactElement } })
    .options.component;
  return render(<Component />);
}

type MetaTag = { title?: string; name?: string; property?: string; content?: string };

function meta(): MetaTag[] {
  const head = (Route as unknown as { options: { head: () => { meta: MetaTag[] } } }).options.head;
  return head().meta;
}


describe("Dashboard route", () => {
  it("renders the page shell, the signed-in identity and the attempts section", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("s@example.com")).toBeInTheDocument();
    expect(screen.getByText("student")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recent attempts" })).toBeInTheDocument();
    expect(screen.getByTestId("attempt-history")).toBeInTheDocument();
  });

  it("badges an administrator", () => {
    auth.current = { user: { email: "admin@example.com" }, isAdmin: true };
    renderDashboard();
    expect(screen.getByText("admin")).toBeInTheDocument();
    auth.current = { user: { email: "s@example.com" }, isAdmin: false };
  });

  it("links to the exam catalogue", () => {
    renderDashboard();
    const link = screen.getByRole("link", { name: "Browse practice exams" });
    expect(link).toHaveAttribute("to", "/exams");
  });

  it("declares its own noindex head metadata", () => {
    const tags = meta();
    expect(tags.find((tag) => "title" in tag)?.title).toBe("Dashboard — AskMeExam");
    expect(tags.find((tag) => tag.name === "robots")?.content).toBe("noindex");
    expect(tags.some((tag) => tag.property === "og:title")).toBe(true);
  });
});

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

vi.mock("@/features/dashboard/components/StudentDashboard", () => ({
  StudentDashboard: () => <div data-testid="student-dashboard" />,
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
  it("renders the page shell and the student dashboard", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByTestId("student-dashboard")).toBeInTheDocument();
  });

  it("greets the signed-in student by name", () => {
    renderDashboard();
    expect(screen.getByText(/Welcome back, s\./)).toBeInTheDocument();
  });

  it("declares its own noindex head metadata", () => {
    const tags = meta();
    expect(tags.find((tag) => "title" in tag)?.title).toBe("Dashboard — AskMeExam");
    expect(tags.find((tag) => tag.name === "robots")?.content).toBe("noindex");
    expect(tags.some((tag) => tag.property === "og:title")).toBe(true);
  });
});

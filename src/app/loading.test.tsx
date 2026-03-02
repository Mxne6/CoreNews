import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "@/app/loading";

describe("GlobalLoading", () => {
  it("renders lightweight route loading indicator", () => {
    render(<Loading />);

    expect(screen.getByText("正在加载页面内容...")).toBeInTheDocument();
    expect(screen.getByTestId("route-loading-indicator")).toBeInTheDocument();
  });
});

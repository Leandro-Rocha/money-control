/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { render, cleanup } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
import { ModalShell } from "./ModalShell";
import { Building } from "lucide-react";

describe("EmptyState", () => {
  it("renders correctly when icon is a forwardRef component like LucideIcon", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: Building,
        title: "Nenhuma conta encontrada",
        description: "Tente novamente mais tarde.",
      })
    );

    expect(html).toContain("Nenhuma conta encontrada");
    expect(html).toContain("Tente novamente mais tarde.");
    expect(html).toContain("lucide-building");
  });

  it("renders correctly when icon is an instantiated React element", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: React.createElement(Building, { className: "custom-class" }),
        title: "Elemento de teste",
      })
    );

    expect(html).toContain("Elemento de teste");
    expect(html).toContain("custom-class");
  });

  it("renders correctly without an icon", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: "Sem ícone",
      })
    );

    expect(html).toContain("Sem ícone");
  });
});

describe("ModalShell icon rendering", () => {
  // ModalShell usa portal do Radix: renderiza no document.body, não em SSR.
  afterEach(cleanup);

  it("renders correctly when icon is a forwardRef component like LucideIcon", () => {
    render(
      React.createElement(
        ModalShell,
        {
          open: true,
          onClose: () => {},
          title: "Modal de Teste",
          icon: Building,
        },
        React.createElement("div", null, "Conteúdo")
      )
    );

    expect(document.body.innerHTML).toContain("Modal de Teste");
    expect(document.body.innerHTML).toContain("lucide-building");
  });

  it("renders correctly when icon is an instantiated React element", () => {
    render(
      React.createElement(
        ModalShell,
        {
          open: true,
          onClose: () => {},
          title: "Modal com Elemento",
          icon: React.createElement(Building, { className: "custom-modal-icon" }),
        },
        React.createElement("div", null, "Conteúdo")
      )
    );

    expect(document.body.innerHTML).toContain("Modal com Elemento");
    expect(document.body.innerHTML).toContain("custom-modal-icon");
  });
});

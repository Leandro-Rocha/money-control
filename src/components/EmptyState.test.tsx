import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
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
  it("renders correctly when icon is a forwardRef component like LucideIcon", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
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

    expect(html).toContain("Modal de Teste");
    expect(html).toContain("lucide-building");
  });

  it("renders correctly when icon is an instantiated React element", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
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

    expect(html).toContain("Modal com Elemento");
    expect(html).toContain("custom-modal-icon");
  });
});

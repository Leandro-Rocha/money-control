import { describe, it, expect } from "vitest";
import { MAX_OPEN, closeAccount, openAccount, parseSelection, selectAccount } from "./selection";

describe("parseSelection", () => {
  const ids = [1, 2, 3, 4];
  it("lista salva válida", () => expect(parseSelection("[2,3]", ids)).toEqual([2, 3]));
  it("descarta ids que não existem e corta em 2", () => expect(parseSelection("[9,1,2,3,4]", ids)).toEqual([1, 2]));
  it("formato antigo {id: bool} vira os abertos", () => expect(parseSelection('{"1":false,"2":true,"3":true}', ids)).toEqual([2, 3]));
  it("vazio, quebrado ou sem válidos cai na primeira conta", () => {
    expect(parseSelection(null, ids)).toEqual([1]);
    expect(parseSelection("{{", ids)).toEqual([1]);
    expect(parseSelection("[99]", ids)).toEqual([1]);
    expect(parseSelection('"x"', ids)).toEqual([1]);
  });
  it("sem contas, nada aberto", () => expect(parseSelection("[1]", [])).toEqual([]));
});

describe("selectAccount", () => {
  it("clique simples troca a seleção", () => expect(selectAccount([1, 2], 3, false)).toEqual([3]));
  it("ctrl+clique soma ao conjunto", () => expect(selectAccount([1], 3, true)).toEqual([1, 3]));
  it("ctrl+clique num aberto fecha, mas nunca zera", () => {
    expect(selectAccount([1, 3], 3, true)).toEqual([1]);
    expect(selectAccount([1], 1, true)).toEqual([1]);
  });
  it("acima do limite, sai o mais antigo", () => expect(selectAccount([1, 2], 4, true)).toEqual([2, 4]));
  it("limite é 2", () => expect(MAX_OPEN).toBe(2));
});

describe("openAccount / closeAccount", () => {
  it("abrir um já aberto não muda", () => expect(openAccount([1, 2], 2)).toEqual([1, 2]));
  it("abrir soma respeitando o limite", () => expect(openAccount([1, 2], 4)).toEqual([2, 4]));
  it("fechar tira da lista, pode zerar", () => {
    expect(closeAccount([1, 2], 1)).toEqual([2]);
    expect(closeAccount([2], 2)).toEqual([]);
  });
});

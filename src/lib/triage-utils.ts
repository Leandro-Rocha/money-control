import { UncategorizedTransaction } from "./actions/triage";

export interface WhatsAppFormatItem {
  day: number;
  month: string;
  purchaseDate?: string | null;
  accountName: string;
  amount: number;
  description: string;
  originalDescription?: string | null;
}

export function formatCurrencyBRL(value: number): string {
  return Math.abs(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatUncategorizedForWhatsApp(
  items: WhatsAppFormatItem[]
): string {
  if (!items || items.length === 0) {
    return "";
  }

  const lines = items.map((item, index) => {
    let dateStr = "";
    if (item.purchaseDate && item.purchaseDate.includes("/")) {
      // Ex: DD/MM/YYYY -> DD/MM
      const parts = item.purchaseDate.split("/");
      dateStr = `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`;
    } else {
      const day = String(item.day).padStart(2, "0");
      const monthNum = item.month.includes("-")
        ? item.month.split("-")[1]
        : "";
      dateStr = monthNum ? `${day}/${monthNum}` : `${day}`;
    }

    const valueStr = formatCurrencyBRL(item.amount);
    const desc = (item.originalDescription || item.description || "").trim();

    return `${index + 1}. ${dateStr} • ${valueStr} • ${item.accountName}: ${desc}`;
  });

  return [
    "Oi! Dá uma olhada nessas compras aqui pra gente categorizar:",
    "",
    ...lines,
    "",
    "Sabe o que foram?",
  ].join("\n");
}

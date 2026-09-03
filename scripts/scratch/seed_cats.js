import Database from 'better-sqlite3';
const db = new Database('data/money_control.db');
const cats = [
  { name: "Salário", type: "income", color: "#16a34a", show_in_summary: 1 },
  { name: "Rendimento", type: "income", color: "#65a30d", show_in_summary: 1 },
  { name: "Casa", type: "expense", color: "#2563eb", show_in_summary: 1 },
  { name: "Mercado", type: "expense", color: "#059669", show_in_summary: 1 },
  { name: "Comida", type: "expense", color: "#d97706", show_in_summary: 1 },
  { name: "Assinatura", type: "expense", color: "#0284c7", show_in_summary: 1 },
  { name: "Saúde", type: "expense", color: "#e11d48", show_in_summary: 1 },
  { name: "Cuidados", type: "expense", color: "#db2777", show_in_summary: 1 },
  { name: "Carro", type: "expense", color: "#475569", show_in_summary: 1 },
  { name: "Filhos", type: "expense", color: "#9333ea", show_in_summary: 1 },
  { name: "Cartão", type: "expense", color: "#1f2937", show_in_summary: 1 },
  { name: "Transferência", type: "both", color: "#9ca3af", show_in_summary: 0 },
  { name: "Variação Patrimonial", type: "both", color: "#10b981", show_in_summary: 0 },
  { name: "Outros", type: "both", color: "#64748b", show_in_summary: 1 }
];

const insert = db.prepare('INSERT INTO categories (name, type, color, show_in_summary) VALUES (?, ?, ?, ?)');
for (const c of cats) {
  try {
    insert.run(c.name, c.type, c.color, c.show_in_summary);
  } catch (e) {
    console.log("Already exists:", c.name);
  }
}
console.log('Categories seeded!');

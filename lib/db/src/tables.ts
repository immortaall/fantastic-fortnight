import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

// ── Whitelist ──────────────────────────────────────────────────────────────

export const whitelistTable = pgTable("whitelist", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Whitelist = typeof whitelistTable.$inferSelect;
export type InsertWhitelist = typeof whitelistTable.$inferInsert;

// ── Query History ──────────────────────────────────────────────────────────

export const queryHistoryTable = pgTable("query_history", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  type: text("type").notNull(),
  query: text("query").notNull(),
  found: boolean("found").notNull().default(false),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type QueryHistory = typeof queryHistoryTable.$inferSelect;
export type InsertQueryHistory = typeof queryHistoryTable.$inferInsert;

// ── Planilha Linhas ────────────────────────────────────────────────────────

export const planilhaLinhasTable = pgTable("planilha_linhas", {
  id: serial("id").primaryKey(),
  codigoMaterial: text("codigo_material").notNull(),
  descricao: text("descricao"),
  codigoOP: text("codigo_op"),
  qtdEmpenho: numeric("qtd_empenho"),
  dataPlanejada: text("data_planejada"),
  statusSetor: text("status_setor"),
  saldoAtual: numeric("saldo_atual"),
  qtdPC: numeric("qtd_pc"),
  dataChegada: text("data_chegada"),
  pedido: text("pedido"),
  cliente: text("cliente"),
  setor: text("setor"),
  pontoPedido: numeric("ponto_pedido"),
  diferencaEstoque: numeric("diferenca_estoque"),
  compradora: text("compradora"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export type PlanilhaLinha = typeof planilhaLinhasTable.$inferSelect;
export type InsertPlanilhaLinha = typeof planilhaLinhasTable.$inferInsert;

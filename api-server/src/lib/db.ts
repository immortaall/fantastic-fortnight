import { db, pool, whitelistTable, queryHistoryTable, planilhaLinhasTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// Re-exporta as tabelas e tipos do schema central
export {
  whitelistTable,
  queryHistoryTable,
  planilhaLinhasTable,
};

// ── Tipo de linha da planilha (para uso interno) ───────────────────────────

export interface PlanilhaLinha {
  codigoMaterial: string;
  descricao: string;
  codigoOP: string;
  qtdEmpenho: number;
  dataPlanejada: string | null;
  statusSetor: string;
  saldoAtual: number;
  qtdPC: number;
  dataChegada: string | null;
  pedido: string | null;
  cliente: string | null;
  setor: string | null;
  pontoPedido: number | null;
  diferencaEstoque: number | null;
  compradora: string | null;
}

// ── Planilha DB ────────────────────────────────────────────────────────────

export async function salvarLinhasPlanilha(linhas: PlanilhaLinha[]): Promise<void> {
  await db.execute(sql`DELETE FROM planilha_linhas`);

  const BATCH = 500;
  for (let i = 0; i < linhas.length; i += BATCH) {
    const batch = linhas.slice(i, i + BATCH);
    await db.insert(planilhaLinhasTable).values(
      batch.map((l) => ({
        codigoMaterial: l.codigoMaterial,
        descricao: l.descricao || null,
        codigoOP: l.codigoOP || null,
        qtdEmpenho: l.qtdEmpenho.toString(),
        dataPlanejada: l.dataPlanejada,
        statusSetor: l.statusSetor || null,
        saldoAtual: l.saldoAtual.toString(),
        qtdPC: l.qtdPC.toString(),
        dataChegada: l.dataChegada,
        pedido: l.pedido,
        cliente: l.cliente,
        setor: l.setor,
        pontoPedido: l.pontoPedido != null ? l.pontoPedido.toString() : null,
        diferencaEstoque: l.diferencaEstoque != null ? l.diferencaEstoque.toString() : null,
        compradora: l.compradora,
      }))
    );
    await new Promise<void>((r) => setImmediate(r));
  }
}

export async function carregarLinhasPlanilha(): Promise<PlanilhaLinha[]> {
  const rows = await db.execute(sql`SELECT * FROM planilha_linhas ORDER BY id`);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    codigoMaterial: String(r["codigo_material"] ?? ""),
    descricao: String(r["descricao"] ?? ""),
    codigoOP: String(r["codigo_op"] ?? ""),
    qtdEmpenho: Number(r["qtd_empenho"] ?? 0),
    dataPlanejada: r["data_planejada"] ? String(r["data_planejada"]) : null,
    statusSetor: String(r["status_setor"] ?? ""),
    saldoAtual: Number(r["saldo_atual"] ?? 0),
    qtdPC: Number(r["qtd_pc"] ?? 0),
    dataChegada: r["data_chegada"] ? String(r["data_chegada"]) : null,
    pedido: r["pedido"] ? String(r["pedido"]) : null,
    cliente: r["cliente"] ? String(r["cliente"]) : null,
    setor: r["setor"] ? String(r["setor"]) : null,
    pontoPedido: r["ponto_pedido"] != null ? Number(r["ponto_pedido"]) : null,
    diferencaEstoque: r["diferenca_estoque"] != null ? Number(r["diferenca_estoque"]) : null,
    compradora: r["compradora"] ? String(r["compradora"]) : null,
  }));
}

export async function contarLinhasPlanilha(): Promise<number> {
  const r = await db.execute(sql`SELECT COUNT(*) as total FROM planilha_linhas`);
  return Number((r.rows[0] as Record<string, unknown>)?.["total"] ?? 0);
}

// ── Whitelist ──────────────────────────────────────────────────────────────

export async function getWhitelistByPhone(phone: string) {
  const rows = await db
    .select()
    .from(whitelistTable)
    .where(eq(whitelistTable.phone, phone))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllWhitelist() {
  return db.select().from(whitelistTable).orderBy(whitelistTable.createdAt);
}

export async function addToWhitelist(phone: string, name: string) {
  const result = await db
    .insert(whitelistTable)
    .values({ phone, name, active: true })
    .returning();
  return result[0];
}

export async function updateWhitelistStatus(id: number, active: boolean) {
  const result = await db
    .update(whitelistTable)
    .set({ active })
    .where(eq(whitelistTable.id, id))
    .returning();
  return result[0];
}

export async function removeFromWhitelist(id: number) {
  await db.delete(whitelistTable).where(eq(whitelistTable.id, id));
}

// ── Query History ──────────────────────────────────────────────────────────

export async function saveQueryHistory(data: {
  phone: string;
  type: string;
  query: string;
  found: boolean;
  response: string;
}) {
  await db.insert(queryHistoryTable).values(data);
}

export async function getQueryHistory(limit = 50) {
  return db
    .select()
    .from(queryHistoryTable)
    .orderBy(queryHistoryTable.createdAt)
    .limit(limit);
}

export { db, pool };

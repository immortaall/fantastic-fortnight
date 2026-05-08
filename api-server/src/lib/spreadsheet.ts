import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import {
  salvarLinhasPlanilha,
  carregarLinhasPlanilha,
  contarLinhasPlanilha,
  type PlanilhaLinha,
} from "./db.js";

const UPLOAD_DIR = path.resolve("./uploads");
const PLANILHA_PATH = path.join(UPLOAD_DIR, "planilha_atual.xlsx");

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface OpInfo {
  codigoOP: string;
  qtdEmpenho: number;
  dataPlanejada: string | null;
  pedido: string | null;
  cliente: string | null;
  setor: string | null;
}

export interface MaterialResumo {
  codigo: string;
  descricao: string;
  saldoAtual: number;
  qtdPC: number;
  dataChegada: string | null;
  qtdFalta: number;
  totalEmpenho: number;
  opCritica: string | null;
  ops: OpInfo[];
  // PLANO
  clientePrincipal: string | null;
  setorPrincipal: string | null;
  pedidoPrincipal: string | null;
  clientes: string[];
  // SOLICITAR
  pontoPedido: number | null;
  diferencaEstoque: number | null;
  precisaComprar: boolean;
  // MATR120
  compradora: string | null;
}

export interface OpResumo {
  op: string;
  dataPlanejada: string | null;
  pedido: string | null;
  cliente: string | null;
  setor: string | null;
  materials: MaterialResumo[];
}

// ── Status ignorados (coluna K do SD4) ────────────────────────────────────

const STATUSES_IGNORADOS = [
  "FINALIZADO",
  "FINALIZADA",
  "COMERCIAL",
  "EXPEDICAO",
  "LOGISTICA",
  "QUALIDADE",
];

function normStr(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function deveIgnorar(statusSetor: string): boolean {
  const n = normStr(statusSetor);
  if (n === "#N/D" || n.startsWith("#N/D")) return true;
  return STATUSES_IGNORADOS.some((s) => n === s || n.startsWith(s));
}

// ── In-memory indexes ──────────────────────────────────────────────────────

let materiaisIndex = new Map<string, MaterialResumo>();
let opsIndex = new Map<string, OpResumo>();
let faltasCount = 0;
let _filename: string | null = null;
let _uploadedAt: Date | null = null;
let _totalLinhas = 0;
let _processing = false;
let _abas: string[] = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toLocaleDateString("pt-BR");
  }
  const s = String(val).trim();
  if (!s) return null;
  const num = Number(s);
  if (!isNaN(num) && num > 1000) {
    const date = XLSX.SSF.parse_date_code(num);
    if (date) {
      return `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`;
    }
  }
  return s;
}

// Lê aba por nome (case-insensitive) e retorna linhas sem o cabeçalho
function lerAba(
  workbook: XLSX.WorkBook,
  nome: string,
  skipRows = 1
): Record<string, unknown>[] | null {
  // Busca case-insensitive
  const found = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase() === nome.toLowerCase()
  );
  if (!found) {
    console.log(`[Spreadsheet] ⚠️ Aba "${nome}" não encontrada — ignorada`);
    return null;
  }
  const sheet = workbook.Sheets[found];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: "A",
    defval: "",
  });
  return raw.slice(skipRows);
}

// ── Parsers das abas secundárias ───────────────────────────────────────────

interface PlanoInfo {
  pedido: string;
  cliente: string;
  setor: string;
}

/**
 * PLANO (nome real: "Plano")
 * A=Pedido, B=OP (chave), E=Cliente, F=Cod_Produto, G=Setor, H=Descrição
 * Join: SD4.F (CONCATENA/OP curta) = PLANO.B
 */
function parsePlano(rows: Record<string, unknown>[]): Map<string, PlanoInfo> {
  const map = new Map<string, PlanoInfo>();
  for (const row of rows) {
    const op = String(row["B"] ?? "").trim();
    if (!op) continue;
    map.set(op, {
      pedido: String(row["A"] ?? "").trim(),
      cliente: String(row["E"] ?? "").trim(),
      setor: String(row["G"] ?? "").trim(),
    });
  }
  console.log(`[Spreadsheet] 📋 Plano: ${map.size} OPs mapeadas`);
  return map;
}

interface SolicitarInfo {
  pontoPedido: number;
}

/**
 * SOLICITAR (nome real: "Solicitar")
 * Linha 1 = datas semanais (ignorar), Linha 2 = cabeçalhos reais → skipRows=2
 * A=Código, B=Descrição, C=Estoque, O=PP (Ponto de Pedido)
 * Join: SD4.A (código produto) = SOLICITAR.A
 */
function parseSolicitar(rows: Record<string, unknown>[]): Map<string, SolicitarInfo> {
  const map = new Map<string, SolicitarInfo>();
  // rows já chegam sem o cabeçalho (skipRows=2 no lerAba)
  for (const row of rows) {
    const codigo = String(row["A"] ?? "").trim();
    if (!codigo) continue;
    const pontoPedido = Number(row["O"]) || 0;
    if (pontoPedido > 0) map.set(codigo, { pontoPedido });
  }
  console.log(`[Spreadsheet] 📋 Solicitar: ${map.size} produtos com ponto de pedido`);
  return map;
}

interface Matr120Info {
  compradora: string;
}

/**
 * MATR120
 * A=Num.PC, I=Produto (código — chave), Y=Comprador2 (comprador)
 * Join: SD4.A (código produto) = MATR120.I
 * Um produto pode ter múltiplos registros; usamos o mais recente.
 */
function parseMatr120(rows: Record<string, unknown>[]): Map<string, Matr120Info> {
  const map = new Map<string, Matr120Info>();
  for (const row of rows) {
    const codigo = String(row["I"] ?? "").trim();
    if (!codigo || codigo === "SINDICATO" || codigo === "SERVICO") continue;
    const compradora = String(row["Y"] ?? "").trim();
    if (compradora) map.set(codigo, { compradora });
  }
  console.log(`[Spreadsheet] 📋 MATR120: ${map.size} produtos com comprador`);
  return map;
}

// ── Parse SD4 + cruzamento ─────────────────────────────────────────────────

async function parseSd4ComCruzamento(
  dataRows: Record<string, unknown>[],
  planoMap: Map<string, PlanoInfo>,
  solicitarMap: Map<string, SolicitarInfo>,
  matr120Map: Map<string, Matr120Info>
): Promise<{ parsed: PlanilhaLinha[]; ignoradas: number }> {
  const parsed: PlanilhaLinha[] = [];
  let ignoradas = 0;
  const BATCH = 500;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH);

    for (const row of batch) {
      // Col A = PRODUTO (com espaços), col B = ARRUMAR (trimmed)
      const codigoMaterial =
        String(row["A"] ?? "").trim() || String(row["B"] ?? "").trim();

      // Col K = status/setor (coluna chamada "Coluna1" no header)
      const statusSetor = String(row["K"] ?? "").trim();

      if (!codigoMaterial) { ignoradas++; continue; }
      if (deveIgnorar(statusSetor)) { ignoradas++; continue; }

      // Col F = CONCATENA (OP curta, ex: "04740201") ← chave para PLANO
      const codigoOP = String(row["F"] ?? "").trim();
      const saldoAtual = Number(row["N"]) || 0;

      // Cruzamento PLANO (por OP curta — col F)
      const plano = planoMap.get(codigoOP);

      // Cruzamento SOLICITAR (por código do produto)
      const solicitar = solicitarMap.get(codigoMaterial);
      const pontoPedido = solicitar?.pontoPedido ?? null;
      const diferencaEstoque =
        pontoPedido != null ? pontoPedido - saldoAtual : null;

      // Cruzamento MATR120 (por código do produto — col I do MATR120)
      const matr120 = matr120Map.get(codigoMaterial);

      parsed.push({
        codigoMaterial,
        descricao: String(row["D"] ?? "").trim(),
        codigoOP,
        qtdEmpenho: Number(row["G"]) || 0,
        dataPlanejada: formatDate(row["H"]),
        statusSetor,
        saldoAtual,
        qtdPC: Number(row["O"]) || 0,
        dataChegada: formatDate(row["P"]),
        pedido: plano?.pedido ?? null,
        cliente: plano?.cliente ?? null,
        setor: plano?.setor ?? null,
        pontoPedido,
        diferencaEstoque,
        compradora: matr120?.compradora ?? null,
      });
    }

    if (i + BATCH < dataRows.length) {
      await new Promise<void>((r) => setImmediate(r));
    }
  }

  return { parsed, ignoradas };
}

// ── Build indexes ──────────────────────────────────────────────────────────

function buildIndexes(rows: PlanilhaLinha[]): void {
  materiaisIndex.clear();
  opsIndex.clear();
  faltasCount = 0;

  const byMaterial = new Map<string, PlanilhaLinha[]>();
  for (const row of rows) {
    if (!byMaterial.has(row.codigoMaterial)) byMaterial.set(row.codigoMaterial, []);
    byMaterial.get(row.codigoMaterial)!.push(row);
  }

  for (const [codigo, linhas] of byMaterial) {
    const primeiro = linhas[0];
    const saldoAtual = primeiro.saldoAtual;
    const qtdPC = primeiro.qtdPC;
    const dataChegada = primeiro.dataChegada;
    const descricao = primeiro.descricao;
    const compradora = primeiro.compradora;
    const pontoPedido = primeiro.pontoPedido;
    const diferencaEstoque = pontoPedido != null ? pontoPedido - saldoAtual : null;
    const precisaComprar = diferencaEstoque != null ? diferencaEstoque > 0 : false;
    const totalDisponivel = saldoAtual + qtdPC;

    const ops = linhas
      .filter((l) => l.codigoOP)
      .sort((a, b) => {
        if (!a.dataPlanejada) return 1;
        if (!b.dataPlanejada) return -1;
        return a.dataPlanejada.localeCompare(b.dataPlanejada);
      });

    const totalEmpenho = ops.reduce((s, o) => s + o.qtdEmpenho, 0);
    const qtdFalta = Math.max(0, totalEmpenho - totalDisponivel);

    let acumulado = 0;
    let opCritica: string | null = null;
    for (const op of ops) {
      acumulado += op.qtdEmpenho;
      if (acumulado > totalDisponivel && !opCritica) opCritica = op.codigoOP;
    }

    if (qtdFalta > 0) faltasCount++;

    const clientesSet = new Set<string>();
    for (const op of ops) {
      if (op.cliente) clientesSet.add(op.cliente.trim());
    }
    const clientes = Array.from(clientesSet).filter(Boolean);
    const opPrincipal = ops[0];

    const resumo: MaterialResumo = {
      codigo,
      descricao,
      saldoAtual,
      qtdPC,
      dataChegada,
      qtdFalta,
      totalEmpenho,
      opCritica,
      ops: ops.map((o) => ({
        codigoOP: o.codigoOP,
        qtdEmpenho: o.qtdEmpenho,
        dataPlanejada: o.dataPlanejada,
        pedido: o.pedido,
        cliente: o.cliente,
        setor: o.setor,
      })),
      clientePrincipal: opPrincipal?.cliente ?? null,
      setorPrincipal: opPrincipal?.setor ?? null,
      pedidoPrincipal: opPrincipal?.pedido ?? null,
      clientes,
      pontoPedido,
      diferencaEstoque,
      precisaComprar,
      compradora,
    };

    materiaisIndex.set(codigo, resumo);

    for (const op of ops) {
      if (!opsIndex.has(op.codigoOP)) {
        opsIndex.set(op.codigoOP, {
          op: op.codigoOP,
          dataPlanejada: op.dataPlanejada,
          pedido: op.pedido,
          cliente: op.cliente,
          setor: op.setor,
          materials: [],
        });
      }
      if (qtdFalta > 0) opsIndex.get(op.codigoOP)!.materials.push(resumo);
    }
  }

  _totalLinhas = rows.length;
  console.log(
    `[Spreadsheet] ✅ Índices: ${materiaisIndex.size} materiais, ${opsIndex.size} OPs | ${faltasCount} com falta`
  );
}

// ── Backup em disco ────────────────────────────────────────────────────────

function saveToDisk(buffer: Buffer): void {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(PLANILHA_PATH, buffer);
    console.log(`[Spreadsheet] 💾 Backup em disco: ${PLANILHA_PATH}`);
  } catch (err) {
    console.error("[Spreadsheet] ⚠️ Erro ao salvar backup:", err);
  }
}

// ── Upload de nova planilha ────────────────────────────────────────────────

export async function processSpreadsheet(buffer: Buffer, filename: string) {
  if (_processing) {
    throw Object.assign(new Error("Processamento em andamento, aguarde"), { status: 409 });
  }
  _processing = true;

  try {
    console.log(`[Spreadsheet] 📥 Lendo: ${filename} (${Math.round(buffer.length / 1024)}KB)`);

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    _abas = workbook.SheetNames;
    console.log(`[Spreadsheet] Abas: ${_abas.join(", ")}`);

    if (!_abas.map((n) => n.toLowerCase()).includes("sd4")) {
      throw Object.assign(new Error("Aba SD4 não encontrada na planilha"), { status: 400 });
    }

    // SD4: 1 linha de cabeçalho
    const rawSd4 = lerAba(workbook, "SD4", 1)!;
    console.log(`[Spreadsheet] SD4: ${rawSd4.length} linhas brutas`);

    // Plano: 1 linha de cabeçalho
    const rawPlano = lerAba(workbook, "Plano", 1);

    // Solicitar: 2 linhas de cabeçalho (linha 1=datas, linha 2=nomes das colunas)
    const rawSolicitar = lerAba(workbook, "Solicitar", 2);

    // MATR120: 1 linha de cabeçalho
    const rawMatr120 = lerAba(workbook, "MATR120", 1);

    await new Promise<void>((r) => setImmediate(r));

    const planoMap = rawPlano ? parsePlano(rawPlano) : new Map<string, PlanoInfo>();
    const solicitarMap = rawSolicitar ? parseSolicitar(rawSolicitar) : new Map<string, SolicitarInfo>();
    const matr120Map = rawMatr120 ? parseMatr120(rawMatr120) : new Map<string, Matr120Info>();

    const { parsed, ignoradas } = await parseSd4ComCruzamento(
      rawSd4,
      planoMap,
      solicitarMap,
      matr120Map
    );
    console.log(`[Spreadsheet] SD4 válidas: ${parsed.length} | Ignoradas (col K): ${ignoradas}`);

    console.log("[Spreadsheet] 💾 Salvando no banco de dados...");
    await salvarLinhasPlanilha(parsed);
    console.log(`[Spreadsheet] ✅ ${parsed.length} linhas salvas no PostgreSQL`);

    buildIndexes(parsed);
    _filename = filename;
    _uploadedAt = new Date();

    saveToDisk(buffer);

    return {
      ok: true,
      materiais: materiaisIndex.size,
      ops: opsIndex.size,
      faltas: faltasCount,
      ignoradas,
      totalLinhas: parsed.length,
      abas: {
        sd4: true,
        plano: rawPlano != null,
        solicitar: rawSolicitar != null,
        matr120: rawMatr120 != null,
      },
    };
  } finally {
    _processing = false;
  }
}

// ── Inicialização ──────────────────────────────────────────────────────────

export async function initSpreadsheetFromDisk(): Promise<void> {
  try {
    const total = await contarLinhasPlanilha();
    if (total > 0) {
      console.log(`[Spreadsheet] 📂 Carregando ${total} linhas do banco de dados...`);
      const linhas = await carregarLinhasPlanilha();
      buildIndexes(linhas);
      _filename = "banco_de_dados";
      _uploadedAt = new Date();
      console.log(`[Spreadsheet] ✅ Restaurado do DB: ${materiaisIndex.size} materiais`);
      return;
    }

    if (fs.existsSync(PLANILHA_PATH)) {
      const buffer = fs.readFileSync(PLANILHA_PATH);
      console.log(`[Spreadsheet] 📂 Fallback disco (${Math.round(buffer.length / 1024)}KB)...`);
      await processSpreadsheet(buffer, "planilha_atual.xlsx");
      return;
    }

    console.log("[Spreadsheet] Nenhuma planilha encontrada. Aguardando upload.");
  } catch (err) {
    console.error("[Spreadsheet] ❌ Erro ao inicializar:", err);
  }
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

setInterval(() => {
  if (materiaisIndex.size > 0) {
    console.log(`[Spreadsheet] ✅ ${materiaisIndex.size} materiais, ${opsIndex.size} OPs em memória`);
  } else {
    console.warn("[Spreadsheet] ⚠️ Nenhuma planilha em memória");
  }
}, 10 * 60 * 1000);

// ── API de consulta ────────────────────────────────────────────────────────

export function getMaterialResumo(termo: string): MaterialResumo | undefined {
  const t = termo.trim();
  if (materiaisIndex.has(t)) return materiaisIndex.get(t);
  const tLow = t.toLowerCase();
  return Array.from(materiaisIndex.values()).find(
    (m) => m.codigo.toLowerCase().includes(tLow)
  );
}

export function buscarPorDescricao(termo: string): MaterialResumo[] {
  const palavras = termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 2);

  if (palavras.length === 0) return [];

  return Array.from(materiaisIndex.values())
    .filter((m) => {
      const desc = m.descricao
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return palavras.every((p) => desc.includes(p));
    })
    .slice(0, 8);
}

export function buscarPorCliente(termo: string): MaterialResumo[] {
  const t = termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return Array.from(materiaisIndex.values())
    .filter((m) =>
      m.clientes.some((c) =>
        c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(t)
      )
    )
    .slice(0, 10);
}

export function buscarPorCompradora(termo: string): MaterialResumo[] {
  const t = termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return Array.from(materiaisIndex.values())
    .filter((m) => {
      if (!m.compradora) return false;
      return m.compradora
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(t);
    })
    .slice(0, 10);
}

export function getOpResumo(codigoOP: string): OpResumo | undefined {
  const t = codigoOP.trim();
  if (opsIndex.has(t)) return opsIndex.get(t);
  const tLow = t.toLowerCase();
  return Array.from(opsIndex.values()).find((o) => o.op.toLowerCase().includes(tLow));
}

export function getMaterialsComFalta() {
  return Array.from(materiaisIndex.values())
    .filter((m) => m.qtdFalta > 0)
    .map((m) => ({
      material: m.codigo,
      descricao: m.descricao,
      opCritica: m.opCritica ?? "—",
      qtdFalta: m.qtdFalta,
      saldoAtual: m.saldoAtual,
      qtdPC: m.qtdPC,
      dataChegada: m.dataChegada ?? "—",
      previsao: m.dataChegada ?? "—",
      compradora: m.compradora ?? "—",
      criticidade: m.qtdFalta > 100 ? "Crítico" : m.qtdFalta > 20 ? "Atenção" : "OK",
    }))
    .sort((a, b) => b.qtdFalta - a.qtdFalta);
}

export function getMaterialsComPCAberto(): MaterialResumo[] {
  return Array.from(materiaisIndex.values())
    .filter((m) => m.qtdPC > 0)
    .sort((a, b) => b.qtdPC - a.qtdPC);
}

export function getMaterialsSemEstoque(): MaterialResumo[] {
  return Array.from(materiaisIndex.values())
    .filter((m) => m.saldoAtual <= 0 && m.totalEmpenho > 0)
    .sort((a, b) => b.qtdFalta - a.qtdFalta);
}

export function getMaterialsAbaixoPontoPedido(): MaterialResumo[] {
  return Array.from(materiaisIndex.values())
    .filter((m) => m.precisaComprar)
    .sort((a, b) => (b.diferencaEstoque ?? 0) - (a.diferencaEstoque ?? 0));
}

export function getSpreadsheetStatus() {
  return {
    loaded: materiaisIndex.size > 0,
    filename: _filename,
    uploadedAt: _uploadedAt,
    materiais: materiaisIndex.size,
    ops: opsIndex.size,
    faltas: faltasCount,
    totalLinhas: _totalLinhas,
    processing: _processing,
    abas: _abas,
  };
}

export function getSpreadsheetStats() {
  return {
    loaded: materiaisIndex.size > 0,
    materiais: materiaisIndex.size,
    ops: opsIndex.size,
    faltas: faltasCount,
  };
}

export function getSpreadsheetPreview(limit = 20) {
  return Array.from(materiaisIndex.values()).slice(0, limit);
}

export function reloadLastSpreadsheet(): { ok: boolean } {
  if (materiaisIndex.size > 0) {
    console.log("[Spreadsheet] Índices já carregados.");
    return { ok: true };
  }
  initSpreadsheetFromDisk().catch((e) => console.error("[Spreadsheet] Erro reload:", e));
  return { ok: true };
}

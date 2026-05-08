import { Router, type IRouter } from "express";
import {
  getMaterialsComFalta,
  getMaterialResumo,
  getOpResumo,
  getSpreadsheetStatus,
  getSpreadsheetPreview,
  reloadLastSpreadsheet,
} from "../lib/spreadsheet.js";
import { getTelegramStatus, getTelegramConfig } from "../lib/telegram.js";
import { getQueryHistory as getHistoryFromDb } from "../lib/db.js";
import { debugState } from "../lib/debug.js";

const router: IRouter = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, pong: true, ts: Date.now() });
});

router.get("/status", (_req, res) => {
  const telegram = getTelegramStatus();
  const spreadsheet = getSpreadsheetStatus();
  res.json({ ok: true, telegram, spreadsheet, ts: Date.now() });
});

router.get("/query/history", async (_req, res) => {
  try {
    const history = await getHistoryFromDb(100);
    res.json(history);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/query/stats", async (_req, res) => {
  try {
    const history = await getHistoryFromDb(1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hoje = history.filter(
      (h) => h.createdAt && new Date(h.createdAt) >= today
    ).length;
    const faltas = getMaterialsComFalta();
    const criticas = faltas.filter(
      (f) => (f.status || "").toLowerCase().includes("crit")
    ).length;
    res.json({ ok: true, totalConsultas: history.length, hoje, totalFaltas: faltas.length, criticas });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/consultar", async (req, res) => {
  const { texto } = req.body as { texto?: string };
  if (!texto) {
    res.status(400).json({ ok: false, error: "texto é obrigatório" });
    return;
  }
  const t = texto.trim();
  const isOP = /^op\s*\d+/i.test(t) || /^\d{6,}$/.test(t.replace(/\s/g, ""));

  if (isOP) {
    const code = t.replace(/^op\s*/i, "").trim();
    const op = getOpResumo(code);
    if (op) {
      const mats = op.materials || [];
      const lines = mats.slice(0, 5).map((m) => `  • ${m.codigo}: falta ${m.qtdFalta} un`).join("\n");
      res.json({
        ok: true, tipo: "OP",
        resposta: `🏭 *OP ${code}*\n\nMateriais em falta:\n${lines || "Nenhuma falta identificada."}`,
        data: op,
      });
      return;
    }
  }

  const mat = getMaterialResumo(t);
  if (mat) {
    res.json({
      ok: true, tipo: "MATERIAL",
      resposta: `📦 *${mat.codigo}*\n${mat.descricao || ""}\n\nEstoque: ${mat.saldoAtual ?? "—"}\nFalta: ${mat.qtdFalta ?? "—"}\nOP Crítica: ${mat.opCritica || "—"}`,
      data: mat,
    });
    return;
  }

  res.json({
    ok: false,
    error: `Código "${t}" não encontrado na planilha`,
    resposta: `❌ *${t}* não encontrado na planilha.\n\nVerifique o código e tente novamente.`,
  });
});

router.get("/query/op/:op", (req, res) => {
  const { op } = req.params;
  const data = getOpResumo(op);
  if (!data) { res.status(404).json({ ok: false, error: "OP não encontrada" }); return; }
  res.json(data);
});

router.get("/query/material/:mat", (req, res) => {
  const { mat } = req.params;
  const data = getMaterialResumo(mat);
  if (!data) { res.status(404).json({ ok: false, error: "Material não encontrado" }); return; }
  res.json(data);
});

router.get("/planilha/preview", (req, res) => {
  const limit = Number(req.query["limit"]) || 20;
  res.json(getSpreadsheetPreview(limit));
});

router.post("/planilha/recarregar", (_req, res) => {
  try {
    const result = reloadLastSpreadsheet();
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/alertas", (_req, res) => { res.json([]); });

let botConfig = {
  maxOPs: 10,
  alertarDias: 3,
  campos: { estoque: true, pc: true, previsao: true, fornecedor: true, ops: true, cliente: true, prazoPC: true },
};

router.get("/config", (_req, res) => { res.json(botConfig); });
router.put("/config", (req, res) => {
  botConfig = { ...botConfig, ...(req.body as typeof botConfig) };
  res.json({ ok: true, config: botConfig });
});

router.get("/debug", (_req, res) => {
  const ss = getSpreadsheetStatus();
  const faltas = getMaterialsComFalta();
  const telegramConfig = getTelegramConfig();
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["REPLIT_DOMAINS"] ?? "desconhecido";
  res.json({
    planilhaCarregada: ss.loaded,
    totalMateriais: ss.materiais,
    totalFaltas: faltas.length,
    arquivo: ss.filename,
    carregadaEm: ss.uploadedAt,
    webhookUrl: `https://${domain}/api/telegram/webhook`,
    telegram: telegramConfig,
    totalWebhooksRecebidos: debugState.totalWebhooksRecebidos,
    totalMensagensProcessadas: debugState.totalMensagensProcessadas,
    ultimaMensagemRecebida: debugState.ultimaMensagemRecebida,
    ultimoErro: debugState.ultimoErro,
    uptime: Math.round(process.uptime()),
  });
});

export default router;

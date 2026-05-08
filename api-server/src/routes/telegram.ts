import { Router, type IRouter } from "express";
import {
  verificarConexao,
  getTelegramConfig,
  getTelegramStatus,
  enviarMensagem,
} from "../lib/telegram.js";

const router: IRouter = Router();

router.get("/status", async (_req, res) => {
  try {
    const status = await verificarConexao();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/config", (_req, res) => {
  res.json(getTelegramConfig());
});

router.get("/info", (_req, res) => {
  res.json(getTelegramStatus());
});

router.post("/send", async (req, res) => {
  const { numero, texto } = req.body as { numero?: string; texto?: string };
  if (!numero || !texto) {
    res.status(400).json({ ok: false, error: "numero (chat_id) e texto são obrigatórios" });
    return;
  }
  try {
    const result = await enviarMensagem(numero, texto);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;

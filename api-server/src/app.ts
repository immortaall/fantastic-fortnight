import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { processarWebhookUpdate } from "./lib/telegram.js";
import { debugState } from "./lib/debug.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint de webhook do Telegram (alternativa ao long polling)
app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
  res.status(200).json({ ok: true });
  debugState.totalWebhooksRecebidos++;
  try {
    await processarWebhookUpdate(req.body as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook] ❌ Erro:", msg);
    debugState.ultimoErro = `${new Date().toISOString()} — ${msg}`;
  }
});

app.use("/api", router);

export default app;

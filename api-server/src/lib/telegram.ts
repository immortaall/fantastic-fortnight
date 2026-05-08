import { getWhitelistByPhone, saveQueryHistory } from "./db.js";
import { interpretarTextoLivre } from "./query.js";
import { debugState } from "./debug.js";

const TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const API = `https://api.telegram.org/bot${TOKEN}`;

let _polling = false;
let _offset = 0;
let _botInfo: { id: number; username: string; first_name: string } | null = null;
let _pollingActive = false;

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function telegramCall<T = unknown>(
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`${API}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{ ok: boolean; result?: T; description?: string }>;
}

// ── Status ─────────────────────────────────────────────────────────────────

export async function verificarConexao() {
  try {
    if (!TOKEN) return { connected: false, status: "token_ausente", number: null };
    const r = await telegramCall<{ id: number; username: string; first_name: string }>("getMe");
    if (r.ok && r.result) {
      _botInfo = r.result;
      return { connected: true, status: "online", number: `@${r.result.username}` };
    }
    return { connected: false, status: r.description ?? "erro", number: null };
  } catch (err) {
    console.error("[Telegram] Erro getMe:", err);
    return { connected: false, status: "erro_rede", number: null };
  }
}

export function getTelegramStatus() {
  return {
    connected: _pollingActive,
    status: _pollingActive ? "polling" : "desconectado",
    number: _botInfo ? `@${_botInfo.username}` : null,
  };
}

export function getTelegramConfig() {
  return {
    token: TOKEN ? `${TOKEN.slice(0, 10)}****` : "(não configurado)",
    username: _botInfo ? `@${_botInfo.username}` : null,
    polling: _pollingActive,
  };
}

export async function getBotInfo() {
  return _botInfo;
}

// ── Envio de mensagem ──────────────────────────────────────────────────────

export async function enviarMensagem(chatId: string, texto: string) {
  return telegramCall("sendMessage", {
    chat_id: Number(chatId) || chatId,
    text: texto,
    parse_mode: "Markdown",
  });
}

// ── Processamento de mensagem ──────────────────────────────────────────────

function inferTipo(texto: string): "material" | "op" | "urgente" {
  const t = texto.trim();
  if (t.startsWith("!")) return "urgente";
  if (/^op\s*\d+/i.test(t) || /^\d{6,}$/.test(t.replace(/\s/g, ""))) return "op";
  return "material";
}

export async function processarMensagem(chatId: string, texto: string): Promise<void> {
  if (texto === "/start" || texto === "/id") {
    await enviarMensagem(
      chatId,
      `🤖 *ZapAuto Bot*\n\nSeu ID Telegram: \`${chatId}\`\n\nEnvie esse ID para o administrador para liberar seu acesso.`
    );
    return;
  }

  const tipo = inferTipo(texto);
  console.log(`🔍 Tipo detectado: ${tipo}`);

  const contato = await getWhitelistByPhone(chatId);
  const autorizado = !!(contato && contato.active);
  console.log(`✅ Autorizado: ${autorizado ? "SIM" : "NÃO"} (chatId: ${chatId})`);

  if (!autorizado) {
    await enviarMensagem(
      chatId,
      `⛔ Acesso não autorizado.\n\nSeu ID: \`${chatId}\`\nEnvie este ID ao administrador para liberar seu acesso.`
    );
    return;
  }

  if (!texto.trim()) return;

  try {
    const resultado = await interpretarTextoLivre(texto);
    console.log(`[Telegram] Resposta (${resultado.found ? "ok" : "não encontrado"}): "${resultado.resposta.slice(0, 80)}"`);
    await enviarMensagem(chatId, resultado.resposta);
    console.log(`[Telegram] ✅ Resposta enviada para ${chatId}`);
    await saveQueryHistory({
      phone: chatId,
      type: tipo,
      query: texto,
      found: resultado.found,
      response: resultado.resposta,
    });
  } catch (err) {
    console.error("[Telegram] ❌ Erro ao processar:", err);
  }
}

// ── Long polling ───────────────────────────────────────────────────────────

async function handleUpdate(update: Record<string, unknown>) {
  debugState.totalWebhooksRecebidos++;

  const message = (update["message"] ?? update["edited_message"]) as
    | Record<string, unknown>
    | undefined;

  if (!message) return;

  const chat = message["chat"] as Record<string, unknown> | undefined;
  const from = message["from"] as Record<string, unknown> | undefined;
  const text = (message["text"] as string) ?? "";
  const chatId = String(chat?.["id"] ?? from?.["id"] ?? "");

  if (!chatId || !text.trim()) return;

  console.log(`📩 [Telegram] chatId=${chatId} | texto="${text}"`);
  debugState.ultimaMensagemRecebida = { numero: chatId, texto: text, hora: new Date().toISOString() };
  debugState.totalMensagensProcessadas++;

  await processarMensagem(chatId, text);
}

async function pollLoop() {
  console.log("[Telegram] 🔄 Long polling iniciado");
  _pollingActive = true;
  _polling = true;

  while (_polling) {
    try {
      const r = await telegramCall<unknown[]>("getUpdates", {
        offset: _offset,
        timeout: 30,
        allowed_updates: ["message"],
      });

      if (r.ok && Array.isArray(r.result)) {
        for (const update of r.result as Record<string, unknown>[]) {
          const id = Number(update["update_id"] ?? 0);
          if (id >= _offset) _offset = id + 1;
          handleUpdate(update).catch((e) =>
            console.error("[Telegram] Erro no update:", e)
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("AbortError")) {
        console.error("[Telegram] Erro no polling:", msg);
        debugState.ultimoErro = `${new Date().toISOString()} — ${msg}`;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  _pollingActive = false;
}

// ── Webhook ────────────────────────────────────────────────────────────────

export async function processarWebhookUpdate(body: Record<string, unknown>) {
  await handleUpdate(body);
}

async function removerWebhook() {
  const r = await telegramCall("deleteWebhook", { drop_pending_updates: false });
  console.log("[Telegram] deleteWebhook:", JSON.stringify(r));
  return r;
}

// ── Inicialização ──────────────────────────────────────────────────────────

export async function startTelegramBot(): Promise<void> {
  if (!TOKEN) {
    console.error("[Telegram] ❌ TELEGRAM_BOT_TOKEN não configurado");
    return;
  }
  const info = await verificarConexao();
  console.log(`[Telegram] Bot: ${info.number ?? "desconhecido"} | Status: ${info.status}`);
  await removerWebhook();
  pollLoop().catch((e) => console.error("[Telegram] Polling encerrado com erro:", e));
}

export async function stopTelegramBot(): Promise<void> {
  _polling = false;
  console.log("[Telegram] Polling encerrado.");
}

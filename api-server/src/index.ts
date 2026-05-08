import app from "./app.js";
import { initSpreadsheetFromDisk } from "./lib/spreadsheet.js";
import { startTelegramBot } from "./lib/telegram.js";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await initSpreadsheetFromDisk();
    await startTelegramBot();
  } catch (err) {
    console.error("[Init] Erro na inicialização:", err);
  }
});

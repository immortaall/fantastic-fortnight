import { Router, type IRouter } from "express";
import multer from "multer";
import {
  processSpreadsheet,
  getSpreadsheetStatus,
  getSpreadsheetPreview,
  reloadLastSpreadsheet,
  getMaterialResumo,
  getOpResumo,
} from "../lib/spreadsheet.js";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
});

router.post(
  "/upload",
  upload.fields([{ name: "file" }, { name: "spreadsheet" }]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const file = files["file"]?.[0] ?? files["spreadsheet"]?.[0];

      if (!file) {
        res.status(400).json({ ok: false, error: "Nenhum arquivo enviado" });
        return;
      }

      if (!file.originalname.match(/\.(xlsx|xls|xlsm)$/i)) {
        res.status(400).json({ ok: false, error: "Arquivo deve ser .xlsx, .xls ou .xlsm" });
        return;
      }

      const result = await processSpreadsheet(file.buffer, file.originalname);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ ok: false, error: msg });
    }
  }
);

router.get("/status", (_req, res) => {
  res.json(getSpreadsheetStatus());
});

router.get("/preview", (req, res) => {
  const limit = Number(req.query["limit"]) || 20;
  res.json(getSpreadsheetPreview(limit));
});

router.post("/reload", (_req, res) => {
  try {
    const result = reloadLastSpreadsheet();
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, error: msg });
  }
});

router.get("/material/:codigo", (req, res) => {
  const { codigo } = req.params;
  const m = getMaterialResumo(codigo);
  if (!m) {
    res.status(404).json({ ok: false, error: "Material não encontrado" });
    return;
  }
  res.json(m);
});

router.get("/op/:codigo", (req, res) => {
  const { codigo } = req.params;
  const op = getOpResumo(codigo);
  if (!op) {
    res.status(404).json({ ok: false, error: "OP não encontrada" });
    return;
  }
  res.json(op);
});

export default router;

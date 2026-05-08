import { Router, type IRouter } from "express";
import { db } from "../lib/db.js";
import {
  whitelistTable,
  getAllWhitelist,
  addToWhitelist,
  updateWhitelistStatus,
  removeFromWhitelist,
} from "../lib/db.js";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const list = await getAllWhitelist();
    res.json(list);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

router.post("/", async (req, res) => {
  const { phone, name } = req.body as { phone?: string; name?: string };
  if (!phone || !name) {
    res.status(400).json({ ok: false, error: "phone e name são obrigatórios" });
    return;
  }
  try {
    const item = await addToWhitelist(phone.trim(), name.trim());
    res.json({ ok: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "id inválido" });
    return;
  }
  const body = req.body as {
    phone?: string;
    name?: string;
    active?: boolean;
  };
  try {
    const updates: Record<string, unknown> = {};
    if (body.phone !== undefined) updates["phone"] = body.phone.trim();
    if (body.name !== undefined) updates["name"] = body.name.trim();
    if (body.active !== undefined) updates["active"] = body.active;
    const result = await db
      .update(whitelistTable)
      .set(updates)
      .where(eq(whitelistTable.id, id))
      .returning();
    res.json({ ok: true, item: result[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "id inválido" });
    return;
  }
  try {
    const current = await db
      .select()
      .from(whitelistTable)
      .where(eq(whitelistTable.id, id))
      .limit(1);
    if (!current[0]) {
      res.status(404).json({ ok: false, error: "Número não encontrado" });
      return;
    }
    const newActive = !current[0].active;
    const item = await updateWhitelistStatus(id, newActive);
    res.json({ ok: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { active } = req.body as { active?: boolean };
  if (isNaN(id) || active === undefined) {
    res.status(400).json({ ok: false, error: "id e active são obrigatórios" });
    return;
  }
  try {
    const item = await updateWhitelistStatus(id, active);
    res.json({ ok: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "id inválido" });
    return;
  }
  try {
    await removeFromWhitelist(id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;

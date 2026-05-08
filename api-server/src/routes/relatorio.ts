import { Router, type IRouter } from "express";
import { getMaterialsComFalta } from "../lib/spreadsheet.js";

const router: IRouter = Router();

router.get("/faltas", (req, res) => {
  const { status } = req.query as Record<string, string>;
  let items = getMaterialsComFalta();
  if (status) {
    items = items.filter((i) => i.status === status);
  }
  res.json(items);
});

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import telegramRouter from "./telegram.js";
import spreadsheetRouter from "./spreadsheet.js";
import relatorioRouter from "./relatorio.js";
import whitelistRouter from "./whitelist.js";
import extraRouter from "./extra.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(extraRouter);
router.use("/telegram", telegramRouter);
router.use("/spreadsheet", spreadsheetRouter);
router.use("/relatorio", relatorioRouter);
router.use("/whitelist", whitelistRouter);

export default router;

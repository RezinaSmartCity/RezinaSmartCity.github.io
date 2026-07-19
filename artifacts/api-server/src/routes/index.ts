import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/reports", reportsRouter);

export default router;

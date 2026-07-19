import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports/index";
import adminRouter from "./admin/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/reports", reportsRouter);
router.use("/admin", adminRouter);

export default router;

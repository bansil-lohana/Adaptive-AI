import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import subjectsRouter from "./subjects";
import timetableRouter from "./timetable";
import remindersRouter from "./reminders";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import mcqRouter from "./mcq";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/profile", profileRouter);
router.use("/subjects", subjectsRouter);
router.use("/timetable", timetableRouter);
router.use("/reminders", remindersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/ai", aiRouter);
router.use("/mcq", mcqRouter);

export default router;

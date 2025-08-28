import express from "express";
import { signin, signup } from "../../controller";
import { expenseRouter } from "./expense";
import { categoryRouter } from "./category";
import { adminRouter } from "./admin";
import { friendRouter } from "./friend";
import { meRouter } from "./me";

export const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);


router.use("/admin", adminRouter);

router.use("/expenses", expenseRouter);
router.use("/categories", categoryRouter);
router.use("/friends", friendRouter);
router.use("/me", meRouter);

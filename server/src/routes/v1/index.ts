import express from "express";
import { signin, signup } from "../../controller";
import { expenseRouter } from "./expense";
import { categoryRouter } from "./category";
import { adminRouter } from "./admin";
import { friendRouter } from "./friend";
import { meRouter } from "./me";
import { groupRouter } from "./group";
import { splitExpenseRouter } from "./splitExpense";
import { expenseSplitRouter } from "./expenseSplit";
import { settlementRouter } from "./settlement";
import { userRouter } from "./user";

export const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);

router.use("/admin", adminRouter);

router.use("/expenses", expenseRouter);
router.use("/categories", categoryRouter);
router.use("/friends", friendRouter);
router.use("/groups", groupRouter);
router.use("/split-expenses", splitExpenseRouter);
router.use("/expense-splits", expenseSplitRouter);
router.use("/settlements", settlementRouter);
router.use("/users", userRouter);
router.use("/me", meRouter);

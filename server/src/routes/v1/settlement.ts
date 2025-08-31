import express from "express";
import { userMiddleware } from "../../middleware/user";
import {
    getSettlements,
    getSettlementById,
    createSettlement,
    updateSettlement,
    deleteSettlement,
    getSettlementSummary,
    getSettlementsWith
} from "../../controller/settlement";

export const settlementRouter = express.Router();

settlementRouter.use(userMiddleware);

settlementRouter.get("/summary", getSettlementSummary);
settlementRouter.get("/with/:userId", getSettlementsWith);

settlementRouter.get("/", getSettlements);
settlementRouter.post("/", createSettlement);
settlementRouter.get("/:settlementId", getSettlementById);
settlementRouter.put("/:settlementId", updateSettlement);
settlementRouter.delete("/:settlementId", deleteSettlement);

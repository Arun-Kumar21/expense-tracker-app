import express from "express";
import { signin, signup } from "../../controller";

export const router = express.Router();


router.post("/signup", signup);
router.post("/signin", signin);

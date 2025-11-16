import express from "express";
import {
  createChallenge,
  joinChallenge,
  leaveChallenge,
  getChallenge,
  startStep
} from "../controllers/challengeController.js";

const router = express.Router();

router.post("/create", createChallenge);
router.post("/join", joinChallenge);
router.post("/leave", leaveChallenge);
router.get("/:id", getChallenge);
router.post("/:id/startStep", async (req, res) => {
  const { step, duration } = req.body;
  await startStep(req.params.id, step, duration);
  res.json({ message: "Step started" });
});

export default router;

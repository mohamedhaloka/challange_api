import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";
import Question from "../models/Question.js";

// Create Challenge
export const createChallenge = async (req, res) => {
  try {
    const challengesSnapshot = await db.collection("challenges")
      .where("status", "in", ["waiting", "in_progress"]).get();
    if (!challengesSnapshot.empty)
      return res.status(400).json({ message: "A challenge is already in progress." });

    const challengeId = uuidv4();
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    // const questions = await Question.aggregate([{ $sample: { size: 5 } }]);

    await db.collection("challenges").doc(challengeId).set({
      pin,
      status: "waiting",
      hostId: null,
      currentQuestionIndex: 0,
      currentStep: null,
      currentStepStartTime: null,
      currentStepDuration: null,
      createdAt: Date.now(),
    });

    return res.status(201).json({ message: "Challenge created", challengeId, pin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Join Challenge
export const joinChallenge = async (req, res) => {
  try {
    const { name, userId, pin } = req.body;
    if (!name || !userId || !pin) return res.status(400).json({ message: "Missing parameters" });

    const challengeQuery = await db.collection("challenges")
      .where("pin", "==", pin)
      .where("status", "!=", "finished")
      .get();
    if (challengeQuery.empty) return res.status(404).json({ message: "Invalid PIN" });

    const challengeDoc = challengeQuery.docs[0];
    const challengeId = challengeDoc.id;
    const challenge = challengeDoc.data();

    const playersSnapshot = await db.collection("challenges")
      .doc(challengeId).collection("players").get();
    const isHost = playersSnapshot.empty;

    await db.collection("challenges").doc(challengeId)
      .collection("players").doc(userId).set({
        name,
        score: 0,
        isHost
      });

    if (isHost) await db.collection("challenges").doc(challengeId).update({ hostId: userId });

    return res.json({ message: "Joined successfully", challengeId, isHost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Leave Challenge
export const leaveChallenge = async (req, res) => {
  try {
    const { userId, challengeId } = req.body;
    if (!userId || !challengeId) return res.status(400).json({ message: "Missing parameters" });

    const challengeDoc = await db.collection("challenges").doc(challengeId).get();
    if (!challengeDoc.exists) return res.status(404).json({ message: "Challenge not found" });

    const challenge = challengeDoc.data();
    if (challenge.hostId === userId) {
      await db.collection("challenges").doc(challengeId).update({ status: "finished" });
      return res.json({ message: "Host left. Challenge closed." });
    } else {
      await db.collection("challenges").doc(challengeId)
        .collection("players").doc(userId).delete();
      return res.json({ message: "Left challenge successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Challenge
export const getChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("challenges").doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Challenge not found" });
    res.json(doc.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Start Step (answer -> rank -> leaderboard)
export const startStep = async (challengeId, step, duration) => {
  const challengeRef = db.collection("challenges").doc(challengeId);
  const snapshot = await challengeRef.get();
  const challenge = snapshot.data();

  if (!challenge) return;

  // Fetch players
  const playersSnapshot = await challengeRef.collection("players").get();
  if (playersSnapshot.size < 2) {
    // Less than 2 players, cannot start
    throw new Error("Need at least 2 players to start the game");
  }

  const startTime = Date.now();
  await challengeRef.update({
    currentStep: step,
    currentStepStartTime: startTime,
    currentStepDuration: duration,
    status: "in_progress",
  });

  // Schedule next step
  setTimeout(async () => {
    const snapshot = await challengeRef.get();
    const challenge = snapshot.data();
    if (!challenge || challenge.status !== "in_progress") return;

    let nextStep = "";
    let nextDuration = 0;

    if (step === "answering") { nextStep = "show_rank"; nextDuration = 3; }
    else if (step === "show_rank") { nextStep = "leaderboard"; nextDuration = 3; }
    else if (step === "leaderboard") {
      const nextQ = (challenge.currentQuestionIndex || 0) + 1;
      if (nextQ < challenge.questions.length) {
        await challengeRef.update({ currentQuestionIndex: nextQ });
        return startStep(challengeId, "answering", 20);
      } else return challengeRef.update({ status: "finished" });
    }

    await startStep(challengeId, nextStep, nextDuration);
  }, duration * 1000);
};

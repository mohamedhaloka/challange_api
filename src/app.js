import express from "express";
import challengeRoutes from "./routes/challengeRoutes.js";

const app = express();
app.use(express.json());

app.use("/api/challenges", challengeRoutes);

export default app;

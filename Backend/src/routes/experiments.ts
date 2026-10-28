import express from "express";
import { getAssignments, listExperiments, setExperimentStatus } from "../controllers/experiments.js";
import { adminOnly } from "../middlewares/auth.js";

const app = express.Router();

// route - /api/v1/experiments/assignments?anonId=
app.get("/assignments", getAssignments);

// route - /api/v1/experiments
app.get("/", adminOnly, listExperiments);

// route - /api/v1/experiments/:key/status
app.put("/:key/status", adminOnly, setExperimentStatus);

export default app;

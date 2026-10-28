import express from "express";
import { ingestEvents } from "../controllers/events.js";

const app = express.Router();

// route - /api/v1/events (public; beacons send text/plain)
app.post("/", express.text({ type: "text/plain", limit: "64kb" }), ingestEvents);

export default app;

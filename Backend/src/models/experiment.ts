import mongoose from "mongoose";

// Runtime on/off state for an experiment defined in analytics/experiments.ts.
// No document (or status "stopped") means everyone gets control.
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    status: { type: String, enum: ["running", "stopped"], default: "stopped" },
    startedAt: Date,
    stoppedAt: Date,
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Experiment = mongoose.model("Experiment", schema);

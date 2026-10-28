// Starts the API against the simulated analytics database (Ecommerce_sim).
// Usage: npm run start:sim
import { SIM_DB_NAME } from "./sim/world.js";

process.env.DB_NAME ||= SIM_DB_NAME;
console.log(`Using database "${process.env.DB_NAME}" (simulated data)`);
await import("../app.js");

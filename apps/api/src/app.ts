import { Hono } from "hono";
import { cors } from "hono/cors";
import { issuesRoute } from "./routes/issues.js";
import { agentsRoute } from "./routes/agents.js";
import { projectsRoute } from "./routes/projects.js";
import { companiesRoute } from "./routes/companies.js";
import { statsRoute } from "./routes/stats.js";
import { runsRoute } from "./routes/runs.js";

export const app = new Hono();

app.use("/*", cors({ origin: ["http://localhost:5173", "http://localhost:3200"] }));

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/companies", companiesRoute);
app.route("/api/issues", issuesRoute);
app.route("/api/agents", agentsRoute);
app.route("/api/projects", projectsRoute);
app.route("/api/stats", statsRoute);
app.route("/api/runs", runsRoute);

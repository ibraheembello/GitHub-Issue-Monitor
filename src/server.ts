import "./config.js"; // Load environment variables
import { createServer } from "http";
import { parse } from "url";

// Import Mastra instance
import { mastra } from "./mastra/index.js";

// Import monitoring service
import { checkGitHubIssues } from "./services/monitor-service.js";
import cron from "node-cron";

const PORT = process.env.PORT || 8080;
const CHECK_INTERVAL_MINUTES = parseInt(
  process.env.CHECK_INTERVAL_MINUTES || "30",
  10
);

console.log("GitHub Issue Monitor - Production Server Starting...\n");
console.log("Configuration:");
console.log(`- Port: ${PORT}`);
console.log(`- GitHub: ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`);
console.log(`- Check Interval: ${CHECK_INTERVAL_MINUTES} minutes\n`);

/**
 * Simple HTTP server that handles Mastra API requests
 */
const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || "", true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === "/" || pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "GitHub Issue Monitor",
        version: "1.0.0",
        endpoints: {
          health: "/",
          agent: "/api/agents/githubIssueMonitorAgent/generate",
        },
      })
    );
    return;
  }

  // Agent endpoint
  if (
    pathname === "/api/agents/githubIssueMonitorAgent/generate" &&
    req.method === "POST"
  ) {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const messages = data.messages || [];

        if (!messages.length) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No messages provided" }));
          return;
        }

        console.log(`[${new Date().toISOString()}] API Request received`);

        const agent = await mastra.getAgent("githubIssueMonitorAgent");

        if (!agent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Agent not found" }));
          return;
        }

        const response = await agent.generate(messages[messages.length - 1], {
          maxSteps: 5,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            text: response.text,
            steps: response.steps,
            finishReason: "stop",
          })
        );

        console.log(`[${new Date().toISOString()}] API Request completed`);
      } catch (error: any) {
        console.error("Error processing request:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal server error",
            message: error.message,
          })
        );
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Start HTTP server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(
    `📡 A2A Endpoint: http://localhost:${PORT}/api/agents/githubIssueMonitorAgent/generate`
  );
  console.log("");

  // Start monitoring service
  console.log("Starting GitHub monitoring service...");

  // Run initial check
  checkGitHubIssues().catch(console.error);

  // Schedule recurring checks
  const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
  cron.schedule(cronExpression, () => {
    checkGitHubIssues().catch(console.error);
  });

  console.log(
    `✅ Monitoring service started (every ${CHECK_INTERVAL_MINUTES} minutes)\n`
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

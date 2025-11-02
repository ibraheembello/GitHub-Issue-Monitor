import "./config.js"; // Load environment variables
import { createServer } from "http";
import { parse } from "url";

// Import Mastra instance
import { mastra } from "./mastra/index.js";

// Import simple agent as fallback
import { getGitHubIssuesSummary } from "./mastra/agents/simple-github-agent.js";

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
        console.log("[DEBUG] Received request:", JSON.stringify(data, null, 2));

        // Handle multiple message formats from different A2A clients
        let userMessage = "";

        // Check if it's JSON-RPC 2.0 format (Telex uses this)
        let messageData = data;
        if (data.jsonrpc === "2.0" && data.params) {
          messageData = data.params;
          console.log("[DEBUG] Detected JSON-RPC 2.0 format");
        }

        // Format 1: JSON-RPC with params.message.parts (Telex format)
        if (
          messageData.message?.parts &&
          Array.isArray(messageData.message.parts)
        ) {
          const textPart = messageData.message.parts.find(
            (p: any) => p.kind === "text"
          );
          if (textPart?.text) {
            userMessage = textPart.text;
          }
        }
        // Format 2: Standard Mastra format - messages array
        else if (
          messageData.messages &&
          Array.isArray(messageData.messages) &&
          messageData.messages.length > 0
        ) {
          userMessage = messageData.messages[messageData.messages.length - 1];
        }
        // Format 3: Direct message field
        else if (
          messageData.message &&
          typeof messageData.message === "string"
        ) {
          userMessage = messageData.message;
        }
        // Format 4: Text field
        else if (messageData.text) {
          userMessage = messageData.text;
        }
        // Format 5: Input field
        else if (messageData.input) {
          userMessage = messageData.input;
        }
        // Format 6: Parts array (direct)
        else if (messageData.parts && Array.isArray(messageData.parts)) {
          const textPart = messageData.parts.find(
            (p: any) => p.kind === "text"
          );
          if (textPart?.text) {
            userMessage = textPart.text;
          }
        }

        if (!userMessage) {
          console.error("[ERROR] No message found in request body");
          console.error(
            "[ERROR] Request structure:",
            JSON.stringify(data, null, 2)
          );

          // Return JSON-RPC error if request was JSON-RPC
          if (data.jsonrpc === "2.0") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: data.id,
                error: {
                  code: -32602,
                  message: "Invalid params: No message text found",
                  data: { received: data },
                },
              })
            );
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "No message provided",
                received: data,
              })
            );
          }
          return;
        }

        console.log(`[${new Date().toISOString()}] API Request received`);
        console.log(`[DEBUG] User message: "${userMessage}"`);

        // Check if message is about GitHub repository
        const githubRepoMatch = userMessage.match(/(\w+)\/(\w+)/);

        if (githubRepoMatch) {
          // Use simple direct approach for GitHub queries
          console.log("[DEBUG] Using simple GitHub agent");
          const [, owner, repo] = githubRepoMatch;

          try {
            const summaryText = await getGitHubIssuesSummary(owner, repo);

            console.log(
              "[DEBUG] Simple agent response:",
              summaryText.substring(0, 200)
            );

            // Return proper A2A response format
            const a2aResponse = {
              kind: "message",
              role: "assistant",
              parts: [
                {
                  kind: "text",
                  text: summaryText,
                },
              ],
            };

            // Return JSON-RPC response if request was JSON-RPC
            if (data.jsonrpc === "2.0") {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: data.id,
                  result: a2aResponse,
                })
              );
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  text: summaryText,
                  message: a2aResponse,
                  finishReason: "stop",
                })
              );
            }

            console.log(
              `[${new Date().toISOString()}] Simple agent request completed successfully`
            );
            return;
          } catch (error: any) {
            console.error("[ERROR] Simple agent failed:", error.message);
            console.error("[ERROR] Stack:", error.stack);
            // Fall through to use main agent
          }
        }

        // Use main Mastra agent
        console.log("[DEBUG] Using main Mastra agent");
        const agent = await mastra.getAgent("githubIssueMonitorAgent");

        if (!agent) {
          // Return JSON-RPC error if request was JSON-RPC
          if (data.jsonrpc === "2.0") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: data.id,
                error: {
                  code: -32603,
                  message: "Internal error: Agent not found",
                },
              })
            );
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Agent not found" }));
          }
          return;
        }

        const response = await agent.generate(userMessage, {
          maxSteps: 10,
          toolChoice: "required", // Force the agent to use a tool
          onStepFinish: (step) => {
            console.log(`[DEBUG] Step finished:`, {
              stepType: step.stepType,
              toolCalls: step.toolCalls?.length || 0,
              hasText: !!step.text,
              finishReason: step.finishReason,
            });
          },
        });

        console.log(
          "[DEBUG] Agent response text length:",
          response.text?.length || 0
        );
        console.log(
          "[DEBUG] Agent response preview:",
          response.text?.substring(0, 200) || "EMPTY"
        );

        // Create proper A2A response format
        const a2aResponse = {
          kind: "message",
          role: "assistant",
          parts: [
            {
              kind: "text",
              text: response.text || "No response generated. Please try again.",
            },
          ],
        };

        // Return JSON-RPC response if request was JSON-RPC
        if (data.jsonrpc === "2.0") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: data.id,
              result: a2aResponse,
            })
          );
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              text: response.text,
              message: a2aResponse,
              steps: response.steps,
              finishReason: "stop",
            })
          );
        }

        console.log(`[${new Date().toISOString()}] API Request completed`);
      } catch (error: any) {
        console.error("Error processing request:", error);

        // Return JSON-RPC error if request was JSON-RPC
        const requestData = body ? JSON.parse(body) : {};
        if (requestData.jsonrpc === "2.0") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: requestData.id,
              error: {
                code: -32603,
                message: "Internal error",
                data: { message: error.message },
              },
            })
          );
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Internal server error",
              message: error.message,
            })
          );
        }
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

import cron from "node-cron";
import { mastra } from "../mastra/index.js";

/**
 * Interval-based GitHub Issue Monitoring Service
 *
 * This service runs the GitHub Issue Monitor agent at regular intervals
 * (default: every 30 minutes) to automatically check for issue changes.
 */

const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";
const CHECK_INTERVAL_MINUTES = parseInt(
  process.env.CHECK_INTERVAL_MINUTES || "30",
  10
);

// Validate required environment variables
if (!GITHUB_OWNER || !GITHUB_REPO) {
  console.error("ERROR: GITHUB_OWNER and GITHUB_REPO must be set in .env file");
  process.exit(1);
}

if (!process.env.GITHUB_TOKEN) {
  console.error("ERROR: GITHUB_TOKEN must be set in .env file");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY must be set in .env file");
  process.exit(1);
}

/**
 * Perform a single check of GitHub issues
 */
export async function checkGitHubIssues(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Starting GitHub issue check...`);
    console.log(`Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`);

    const agent = await mastra.getAgent("githubIssueMonitorAgent");

    if (!agent) {
      throw new Error("GitHub Issue Monitor agent not found");
    }

    // Generate a response using the agent
    const response = await agent.generate(
      `Check for issue changes in the ${GITHUB_OWNER}/${GITHUB_REPO} repository. Use the githubIssueMonitorTool with owner="${GITHUB_OWNER}" and repo="${GITHUB_REPO}".`,
      {
        maxSteps: 5,
      }
    );

    console.log("\n=== Issue Monitor Report ===");
    console.log(response.text);
    console.log("===========================\n");

    // Log tool usage if available
    if (response.steps && response.steps.length > 0) {
      console.log("Tool calls made:");
      response.steps.forEach((step: any, index: number) => {
        if ("toolName" in step && step.toolName) {
          console.log(`  ${index + 1}. ${step.toolName}`);
        }
      });
    }
  } catch (error: any) {
    console.error("Error checking GitHub issues:", error.message);
    console.error("Full error:", error);
  }
}

/**
 * Start the interval-based monitoring service
 */
export function startMonitoringService(): void {
  console.log("=".repeat(60));
  console.log("GitHub Issue Monitor Service Starting");
  console.log("=".repeat(60));
  console.log(`Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`);
  console.log(`Check Interval: Every ${CHECK_INTERVAL_MINUTES} minutes`);
  console.log("=".repeat(60));
  console.log("");

  // Run initial check immediately
  console.log("Running initial check...\n");
  checkGitHubIssues();

  // Schedule recurring checks using cron
  // Format: '*/30 * * * *' means "every 30 minutes"
  const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;

  cron.schedule(cronExpression, () => {
    checkGitHubIssues();
  });

  console.log(
    `✅ Monitoring service started. Next check in ${CHECK_INTERVAL_MINUTES} minutes.`
  );
}

/**
 * Manually trigger a check (for testing)
 */
export async function manualCheck(): Promise<void> {
  await checkGitHubIssues();
}

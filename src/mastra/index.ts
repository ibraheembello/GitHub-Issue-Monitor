import { Mastra } from "@mastra/core/mastra";
import { githubIssueMonitorAgent } from "./agents/github-monitor-agent.js";

/**
 * Mastra Instance
 *
 * This is the main configuration for the Mastra framework,
 * registering all agents and configuring the A2A protocol endpoint.
 */
export const mastra = new Mastra({
  agents: {
    githubIssueMonitorAgent,
  },
});

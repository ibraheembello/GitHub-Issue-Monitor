import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Octokit } from "octokit";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

/**
 * Simple GitHub Issue Monitor Agent (without complex tools)
 *
 * This agent directly calls the GitHub API within its instructions
 * instead of using external tools.
 */
export const simpleGithubAgent = new Agent({
  name: "Simple GitHub Monitor",
  instructions: `
You are a GitHub Issue Monitor that provides quick summaries of repository issues.

When the user asks about a GitHub repository:
1. I will provide you with the issue data
2. You format it nicely with emojis and links
3. Keep responses under 2000 characters
4. Show maximum 5-10 issues

Format each issue as:
• #[num]: [title]
  By @[author] | [labels] 
  🔗 [url]
  `,
  model: openai("gpt-4o-mini"),
  tools: {}, // No tools - we'll handle GitHub API calls manually
});

/**
 * Fetch GitHub issues and generate response
 */
export async function getGitHubIssuesSummary(
  owner: string,
  repo: string
): Promise<string> {
  try {
    console.log(`[Simple Agent] Fetching issues for ${owner}/${repo}`);

    // Fetch issues from GitHub
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 10,
      sort: "created",
      direction: "desc",
    });

    console.log(`[Simple Agent] Fetched ${issues.length} issues`);

    if (issues.length === 0) {
      return `No open issues found in ${owner}/${repo}`;
    }

    // Format issues directly without OpenAI (more reliable)
    const recentIssues = issues.slice(0, 5);

    let summary = `📊 **GitHub Repository: ${owner}/${repo}**\n\n`;
    summary += `Total open issues: **${issues.length}**\n`;
    summary += `Showing 5 most recent:\n\n`;

    recentIssues.forEach((issue, index) => {
      const labels = issue.labels
        .slice(0, 2)
        .map((l: any) => (typeof l === "string" ? l : l.name))
        .join(", ");

      summary += `${index + 1}. **#${issue.number}**: ${issue.title}\n`;
      summary += `   👤 @${issue.user?.login || "unknown"}`;
      if (labels) {
        summary += ` | 🏷️ ${labels}`;
      }
      summary += `\n   🔗 ${issue.html_url}\n\n`;
    });

    summary += `\n💡 *Ask for specific labels or date ranges to filter results*`;

    console.log(`[Simple Agent] Formatted summary (${summary.length} chars)`);

    return summary;
  } catch (error: any) {
    console.error("[Simple Agent] ERROR:", error.message);
    console.error("[Simple Agent] Stack:", error.stack);
    return `Error fetching issues: ${error.message}`;
  }
}

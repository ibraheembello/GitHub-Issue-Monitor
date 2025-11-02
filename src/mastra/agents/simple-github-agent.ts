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
    // Fetch issues from GitHub
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 10,
      sort: "created",
      direction: "desc",
    });

    if (issues.length === 0) {
      return `No open issues found in ${owner}/${repo}`;
    }

    // Format issues data for the agent
    const issuesData = issues.slice(0, 5).map((issue) => ({
      number: issue.number,
      title: issue.title,
      author: issue.user?.login || "unknown",
      state: issue.state,
      labels: issue.labels
        .slice(0, 2)
        .map((l: any) => (typeof l === "string" ? l : l.name))
        .join(", "),
      url: issue.html_url,
      created: issue.created_at,
    }));

    // Create prompt with data
    const prompt = `Here are the 5 most recent issues from ${owner}/${repo}:

${JSON.stringify(issuesData, null, 2)}

Total open issues: ${issues.length}

Please format this into a nice, concise summary with emojis. Show each issue with its number, title, author, labels, and URL. Keep it under 2000 characters.`;

    // Generate response
    const response = await simpleGithubAgent.generate(prompt, {
      maxSteps: 1,
    });

    return response.text || "Unable to generate summary";
  } catch (error: any) {
    console.error("Error fetching GitHub issues:", error);
    return `Error: ${error.message}`;
  }
}

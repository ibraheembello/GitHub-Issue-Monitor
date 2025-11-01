import { createTool } from '@mastra/core';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Type definitions for issue comparison
export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  updated_at: string;
  created_at: string;
  html_url: string;
  user: {
    login: string;
  };
  labels: Array<{ name: string }>;
  body: string | null;
}

export interface IssueChange {
  type: 'new' | 'updated' | 'closed';
  issue: GitHubIssue;
  previousState?: Partial<GitHubIssue>;
}

export interface IssueMonitorResult {
  totalIssues: number;
  changes: IssueChange[];
  timestamp: string;
  hasChanges: boolean;
}

// In-memory cache for issue states
const issueCache = new Map<string, GitHubIssue[]>();

/**
 * Compare current issues with cached state to detect changes
 */
function detectChanges(
  currentIssues: GitHubIssue[],
  previousIssues: GitHubIssue[] | undefined,
  cacheKey: string
): IssueChange[] {
  const changes: IssueChange[] = [];

  if (!previousIssues || previousIssues.length === 0) {
    // First run - all issues are "new"
    currentIssues.forEach(issue => {
      changes.push({ type: 'new', issue });
    });
    return changes;
  }

  const previousMap = new Map(previousIssues.map(issue => [issue.number, issue]));
  const currentMap = new Map(currentIssues.map(issue => [issue.number, issue]));

  // Check for new and updated issues
  currentIssues.forEach(current => {
    const previous = previousMap.get(current.number);

    if (!previous) {
      // New issue
      changes.push({ type: 'new', issue: current });
    } else if (
      previous.updated_at !== current.updated_at ||
      previous.state !== current.state
    ) {
      // Updated issue
      changes.push({
        type: 'updated',
        issue: current,
        previousState: {
          state: previous.state,
          updated_at: previous.updated_at,
          title: previous.title,
        },
      });
    }
  });

  // Check for closed issues (issues that were open but are now closed)
  previousIssues.forEach(previous => {
    const current = currentMap.get(previous.number);
    if (current && previous.state === 'open' && current.state === 'closed') {
      // This is already caught in the updated check above, but we mark it explicitly
      const existingChange = changes.find(
        c => c.issue.number === current.number && c.type === 'updated'
      );
      if (existingChange) {
        existingChange.type = 'closed';
      }
    }
  });

  return changes;
}

/**
 * GitHub Issue Monitoring Tool
 * Fetches issues from a repository and detects changes
 */
export const githubIssueMonitorTool = createTool({
  id: 'github-issue-monitor',
  description:
    'Monitors GitHub repository issues and detects changes (new, updated, closed issues). Caches previous state to compare changes.',
  inputSchema: z.object({
    owner: z.string().describe('GitHub repository owner/organization'),
    repo: z.string().describe('GitHub repository name'),
    state: z
      .enum(['open', 'closed', 'all'])
      .default('all')
      .describe('Filter issues by state'),
    since: z
      .string()
      .optional()
      .describe('ISO 8601 timestamp to filter issues updated since this time'),
  }),
  outputSchema: z.object({
    totalIssues: z.number(),
    changes: z.array(
      z.object({
        type: z.enum(['new', 'updated', 'closed']),
        issue: z.object({
          number: z.number(),
          title: z.string(),
          state: z.enum(['open', 'closed']),
          updated_at: z.string(),
          created_at: z.string(),
          html_url: z.string(),
          user: z.object({ login: z.string() }),
          labels: z.array(z.object({ name: z.string() })),
          body: z.string().nullable(),
        }),
        previousState: z
          .object({
            state: z.enum(['open', 'closed']).optional(),
            updated_at: z.string().optional(),
            title: z.string().optional(),
          })
          .optional(),
      })
    ),
    timestamp: z.string(),
    hasChanges: z.boolean(),
  }),
  execute: async ({ context }) => {
    try {
      const { owner, repo, state, since } = context;
      const cacheKey = `${owner}/${repo}`;

      // Fetch issues from GitHub
      const response = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: state as 'open' | 'closed' | 'all',
        since,
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });

      const currentIssues: GitHubIssue[] = response.data.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        updated_at: issue.updated_at,
        created_at: issue.created_at,
        html_url: issue.html_url,
        user: {
          login: issue.user.login,
        },
        labels: issue.labels.map((label: any) => ({
          name: typeof label === 'string' ? label : label.name,
        })),
        body: issue.body,
      }));

      // Get cached issues for comparison
      const previousIssues = issueCache.get(cacheKey);

      // Detect changes
      const changes = detectChanges(currentIssues, previousIssues, cacheKey);

      // Update cache
      issueCache.set(cacheKey, currentIssues);

      const result: IssueMonitorResult = {
        totalIssues: currentIssues.length,
        changes,
        timestamp: new Date().toISOString(),
        hasChanges: changes.length > 0,
      };

      return result;
    } catch (error: any) {
      console.error('Error monitoring GitHub issues:', error);
      throw new Error(
        `Failed to monitor GitHub issues: ${error.message || 'Unknown error'}`
      );
    }
  },
});
# GitHub Issue Monitor - A2A Agent for Telex.im

An interval-based AI agent built with Mastra that monitors GitHub repository issues every 30 minutes, detects changes (new, updated, closed, reopened), and integrates seamlessly with Telex.im via the A2A protocol.

## 🎯 Features

- **Interval-Based Monitoring**: Automatically checks issues every 30 minutes
- **Smart Change Detection**: Identifies new, updated, closed, and reopened issues
- **In-Memory Caching**: Efficient state management without external dependencies
- **A2A Protocol Compliant**: Full JSON-RPC 2.0 implementation for Telex integration
- **Formatted Reports**: Clear, emoji-enhanced summaries for team communication
- **Mastra Framework**: Built on production-ready TypeScript agent framework

## 📋 Requirements

- Node.js >= 20.0.0
- GitHub Personal Access Token
- OpenAI API Key (or other LLM provider)
- Mastra CLI (installed automatically with dependencies)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or download the project
cd github-issue-monitor

# Install dependencies
npm install
```

### 2. Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# GitHub Configuration
GITHUB_TOKEN=ghp_your-github-token-here
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repository-name

# Server Configuration
PORT=3000
NODE_ENV=development

# Monitoring Interval (in minutes)
CHECK_INTERVAL_MINUTES=30
```

#### Getting Your GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Issue Monitor")
4. Select scopes:
   - For public repos: ✅ `public_repo`
   - For private repos: ✅ `repo` (full control)
5. Click "Generate token"
6. Copy the token (you won't see it again!)

### 3. Run Development Server

```bash
# Start the Mastra development server
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════╗
║   GitHub Issue Monitor - A2A Agent                     ║
╚════════════════════════════════════════════════════════╝

🚀 Server running on port 3000
🔗 A2A Endpoint: http://localhost:3000/a2a/agent/githubMonitor
📋 Agent Card: http://localhost:3000/.well-known/agent-card.json
🏥 Health Check: http://localhost:3000/health
🔧 Manual Trigger: http://localhost:3000/monitor

Repository: username/repo-name
Check Interval: 30 minutes

Ready to integrate with Telex.im! 🎉
```

### 4. Test Locally

#### Manual Test
```bash
# Trigger a manual check
curl http://localhost:3000/monitor
```

#### Test A2A Endpoint
```bash
curl -X POST http://localhost:3000/a2a/agent/githubMonitor \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "content": "Check for issue updates"
          }
        ]
      }
    },
    "id": "test-123"
  }'
```

Expected Response:
```json
{
  "jsonrpc": "2.0",
  "id": "test-123",
  "result": {
    "message": {
      "role": "agent",
      "parts": [
        {
          "type": "text",
          "content": "📊 GitHub Issue Report for owner/repo\n🔔 Changes Detected: 3 (2 new, 1 closed)\n\n🆕 New Issues: 2\n- #42: Add authentication feature (https://github.com/owner/repo/issues/42)\n- #43: Fix bug in login (https://github.com/owner/repo/issues/43)\n\n✅ Closed Issues: 1\n- #40: Update documentation (https://github.com/owner/repo/issues/40)"
        }
      ]
    },
    "status": "completed"
  }
}
```

## 📦 File Structure

```
github-issue-monitor/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── github-monitor-agent.ts    # Main agent logic
│   │   ├── tools/
│   │   │   └── github-tool.ts             # GitHub API integration
│   │   ├── utils/
│   │   │   └── issue-cache.ts             # State management
│   │   └── index.ts                        # Mastra configuration
│   └── index.ts                            # Express server + A2A endpoint
├── .env.example                            # Environment template
├── package.json                            # Dependencies
├── tsconfig.json                           # TypeScript config
├── telex-workflow.json                     # Telex integration config
└── README.md                               # This file
```

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TELEX.IM PLATFORM                        │
│              (Workflow Integration via A2A)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ A2A Protocol (JSON-RPC 2.0)
                         │ HTTP POST requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              MASTRA AGENT (Express Server)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  A2A Endpoint Handler (/a2a/agent/githubMonitor)    │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────▼──────────────────────────────────────┐   │
│  │         GitHub Monitor Agent                          │   │
│  │  - Check issues every 30 minutes                      │   │
│  │  - Detect new/updated/closed                          │   │
│  │  - Cache state in memory                              │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────▼──────────────────────────────────────┐   │
│  │         GitHub Tool (Octokit)                         │   │
│  │  - Fetch repository issues                            │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **GitHub Tool** (`src/mastra/tools/github-tool.ts`)
   - Uses Octokit to fetch issues from GitHub API
   - Transforms API response to standardized format
   - Handles authentication and error cases

2. **Issue Cache Manager** (`src/mastra/utils/issue-cache.ts`)
   - Maintains in-memory state of previous checks
   - Compares current state with cached state
   - Identifies new, updated, closed, and reopened issues

3. **GitHub Monitor Agent** (`src/mastra/agents/github-monitor-agent.ts`)
   - Coordinates tool usage and cache management
   - Formats detection results into readable reports
   - Provides LLM-guided intelligent responses

4. **Express Server** (`src/index.ts`)
   - Implements A2A protocol endpoint
   - Handles JSON-RPC 2.0 requests/responses
   - Manages 30-minute interval scheduling
   - Provides health check and manual trigger endpoints

5. **Mastra Configuration** (`src/mastra/index.ts`)
   - Registers agent with Mastra framework
   - Configures logging and observability

## 🌐 Deployment to Mastra Cloud

### Option 1: Mastra CLI Deployment

```bash
# Build the project
npm run build

# Deploy to Mastra Cloud
npm run deploy
```

Follow the CLI prompts to:
1. Authenticate with Mastra Cloud
2. Select deployment region
3. Configure environment variables
4. Deploy the agent

### Option 2: Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy `dist/` folder to your hosting provider (Vercel, Railway, Render, etc.)

3. Set environment variables on your hosting platform:
   - `OPENAI_API_KEY`
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `CHECK_INTERVAL_MINUTES`

4. Note your deployment URL (e.g., `https://your-app.mastra.cloud`)

## 📲 Telex.im Integration

### Step 1: Get Telex Access

Run this command to get invited to the Telex organization:
```bash
/telex-invite your-email@example.com
```

### Step 2: Update Workflow JSON

Edit `telex-workflow.json` and replace the URL with your deployed endpoint:

```json
{
  "nodes": [
    {
      "url": "https://your-deployment-url.mastra.cloud/a2a/agent/githubMonitor"
    }
  ]
}
```

### Step 3: Import Workflow to Telex

1. Go to Telex.im
2. Navigate to Workflows
3. Click "Import Workflow"
4. Upload or paste the contents of `telex-workflow.json`
5. Activate the workflow

### Step 4: View Agent Logs

Monitor your agent's interactions at:
```
https://api.telex.im/agent-logs/{channel-id}.txt
```

Where `{channel-id}` is the first UUID in your Telex.im channel URL:
```
https://telex.im/telex-im/home/colleagues/01989dec-0d08-71ee-9017-00e4556e1942/...
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                          This is your channel-id
```

Example:
```
https://api.telex.im/agent-logs/01989dec-0d08-71ee-9017-00e4556e1942.txt
```

## 🧪 Testing

### Test Cases

1. **First Run** - All issues should be marked as "new"
2. **No Changes** - Should report "No changes detected"
3. **New Issue** - Creates new issue on GitHub, wait for check
4. **Updated Issue** - Edit existing issue, wait for check
5. **Closed Issue** - Close an issue, wait for check
6. **Reopened Issue** - Reopen a closed issue, wait for check

### Manual Testing Script

```bash
# Test health check
curl http://localhost:3000/health

# Test agent card
curl http://localhost:3000/.well-known/agent-card.json

# Trigger manual check
curl http://localhost:3000/monitor

# Test A2A endpoint
curl -X POST http://localhost:3000/a2a/agent/githubMonitor \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "content": "Check now"}]
      }
    },
    "id": "manual-test"
  }'
```

## 🔍 Troubleshooting

### Issue: "Unable to fetch issues"
**Solution**: Check that your `GITHUB_TOKEN` has the correct permissions. For private repos, you need full `repo` scope.

### Issue: "No changes detected" on first run
**Expected**: First run initializes the cache, so all issues are marked as "new". Subsequent runs will detect actual changes.

### Issue: Server not starting
**Solution**: 
1. Ensure Node.js version is >= 20.0.0: `node --version`
2. Check that port 3000 is not already in use
3. Verify all dependencies are installed: `npm install`

### Issue: A2A endpoint returns 500 error
**Solution**: Check server logs for detailed error messages. Common causes:
- Missing environment variables
- Invalid GitHub token
- Repository doesn't exist or no access

### Issue: Interval monitoring not running
**Solution**: The interval is set to 30 minutes by default. To test faster, set `CHECK_INTERVAL_MINUTES=1` in `.env` for 1-minute intervals.

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for LLM access |
| `GITHUB_TOKEN` | Yes | - | GitHub personal access token |
| `GITHUB_OWNER` | Yes | - | Repository owner (username or org) |
| `GITHUB_REPO` | Yes | - | Repository name |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `CHECK_INTERVAL_MINUTES` | No | 30 | Monitoring interval in minutes |

## 📚 API Endpoints

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "GitHub Issue Monitor",
  "timestamp": "2025-11-01T12:00:00.000Z"
}
```

### `GET /.well-known/agent-card.json`
A2A agent discovery endpoint

**Response:** Agent metadata (capabilities, skills, authentication)

### `POST /a2a/agent/githubMonitor`
Main A2A protocol endpoint for Telex.im integration

**Request:** JSON-RPC 2.0 format
**Response:** Issue monitoring report

### `GET /monitor`
Manual trigger endpoint for testing

**Response:** Latest monitoring report

## 🎨 Customization

### Change Monitoring Interval

Edit `.env`:
```env
CHECK_INTERVAL_MINUTES=15  # Check every 15 minutes
```

### Monitor Multiple Repositories

Currently, the agent monitors one repository per deployment. To monitor multiple repos:

**Option 1:** Deploy multiple instances with different environment variables

**Option 2:** Modify the code to accept repository as a parameter in the A2A request

### Customize Report Format

Edit `src/mastra/agents/github-monitor-agent.ts`:
- Modify the `instructions` field to change LLM behavior
- Update the `monitorIssues()` function to change report formatting

## 🤝 Contributing

This is a submission project, but contributions are welcome:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [A2A Protocol Specification](https://a2aprotocol.ai)
- [Telex.im Documentation](https://docs.telex.im)
- [GitHub REST API](https://docs.github.com/en/rest)

## 🏆 Project Requirements Checklist

✅ **Working AI Agent**: Fully functional GitHub issue monitoring  
✅ **Telex.im Integration**: A2A protocol compliant endpoint  
✅ **Live Endpoint**: Deployable to Mastra Cloud  
✅ **Documentation**: Complete setup and usage instructions  
✅ **Mastra Framework**: Built using required framework  
✅ **A2A Protocol**: Proper JSON-RPC 2.0 implementation  
✅ **Error Handling**: Comprehensive error management  
✅ **Code Structure**: Modular, maintainable architecture  

## 📧 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review server logs for error details
3. Consult Mastra documentation
4. Join the Mastra Discord community

---

**Built with ❤️ using Mastra Framework**
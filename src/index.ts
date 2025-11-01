import './config.js'; // Load environment variables first
import { startMonitoringService } from './services/monitor-service.js';

/**
 * Main Application Entry Point
 * 
 * This starts the GitHub Issue Monitor service which runs the Mastra agent
 * at regular intervals to check for issue changes.
 * 
 * The Mastra dev server must be running separately to expose the A2A endpoint.
 * Run: npm run dev (in a separate terminal)
 */

async function main() {
  console.log('GitHub Issue Monitor - Starting...\n');

  // Display configuration
  console.log('Configuration:');
  console.log(`- GitHub Owner: ${process.env.GITHUB_OWNER}`);
  console.log(`- GitHub Repo: ${process.env.GITHUB_REPO}`);
  console.log(`- Check Interval: ${process.env.CHECK_INTERVAL_MINUTES || 30} minutes`);
  console.log(`- Port: ${process.env.PORT || 4111}`);
  console.log('');

  // Start the monitoring service
  startMonitoringService();

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });
}

// Start the application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
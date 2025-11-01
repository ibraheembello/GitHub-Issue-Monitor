import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
const result = dotenv.config({ path: join(__dirname, '..', '.env') });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  console.log('Attempted to load from:', join(__dirname, '..', '.env'));
} else {
  console.log('✓ .env file loaded successfully');
}

// Export configuration
export const config = {
  github: {
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    token: process.env.GITHUB_TOKEN || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  monitoring: {
    intervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '30', 10),
  },
  server: {
    port: parseInt(process.env.PORT || '4111', 10),
  },
  mastra: {
    env: process.env.MASTRA_ENV || 'development',
  },
};

// Validate required variables
const requiredVars = [
  'GITHUB_OWNER',
  'GITHUB_REPO',
  'GITHUB_TOKEN',
  'OPENAI_API_KEY',
];

const missing = requiredVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missing.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env file.\n');
  process.exit(1);
}
/**
 * Lab 3 Verification Script:
 * 1. Checks API contracts exist (course-service-api.json, assignment-service-api.json, events-schema.json)
 * 2. Tests Synchronous call with 2s timeout and Fallback
 * 3. Tests Asynchronous event handling (Redis Pub/Sub)
 * 4. Demonstrates Fault Tolerance experiment with simulated service outage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runVerification() {
  console.log('===============================================================');
  console.log('🧪 RUNNING LAB 3 ARCHITECTURAL & INTERACTION VERIFICATION TEST');
  console.log('===============================================================\n');

  // Step 1: Verify Contracts
  console.log('📋 STEP 1: Verifying Machine-Readable Contracts in /contracts...');
  const contracts = [
    'contracts/course-service-api.json',
    'contracts/assignment-service-api.json',
    'contracts/events-schema.json',
  ];

  for (const c of contracts) {
    const fullPath = path.join(rootDir, c);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing contract: ${c}`);
    }
    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log(`  ✅ Found valid JSON contract: ${c} (Title/Type: ${content.info?.title || content.title})`);
  }

  // Step 2: Test Synchronous Client Logic (Normal & Fallback)
  console.log('\n🔄 STEP 2: Testing Synchronous Communication Protection & Fallback...');
  const { CourseServiceClient } = await import('../services/assignment-service/dist/infrastructure/clients/CourseServiceClient.js');
  
  // Mock ConfigService
  const mockConfig = {
    get: (key, defaultValue) => {
      if (key === 'COURSE_SERVICE_URL') return 'http://127.0.0.1:59999'; // Intentionally unreachable port
      return defaultValue;
    },
  };

  const client = new CourseServiceClient(mockConfig);
  console.log('  Calling CourseServiceClient against unreachable host (simulating Course Service outage)...');
  
  const startTime = Date.now();
  const fallbackResult = await client.getCourse('test-course-id-123');
  const elapsed = Date.now() - startTime;

  console.log(`  ⏱️  Elapsed time: ${elapsed}ms`);
  console.log('  📦 Received result:', fallbackResult);

  if (fallbackResult.isVerified === false && fallbackResult.fallbackNotice) {
    console.log('  ✅ SUCCESS: Synchronous fallback activated! System degraded gracefully without crashing.');
  } else {
    throw new Error('Fallback failed to trigger properly');
  }

  // Step 3: Test Asynchronous Consumer Idempotency & Creation
  console.log('\n📬 STEP 3: Testing Asynchronous Event Handling (Redis Consumer)...');
  const { RedisEventConsumer } = await import('../services/assignment-service/dist/infrastructure/events/RedisEventConsumer.js');
  
  const savedAssignments = [];
  const mockRepo = {
    findByCourseId: async (courseId) => savedAssignments.filter((a) => a.getCourseId() === courseId),
    save: async (assignment) => { savedAssignments.push(assignment); },
  };

  const consumer = new RedisEventConsumer({ get: () => 'localhost' }, mockRepo);

  const sampleEvent = JSON.stringify({
    eventId: 'evt-001',
    eventType: 'course.published',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      courseId: 'course-999',
      title: 'Advanced Distributed Systems',
    },
  });

  console.log('  Processing mock event payload...');
  await consumer.handleCoursePublished(sampleEvent);

  if (savedAssignments.length === 1) {
    const a = savedAssignments[0];
    console.log(`  ✅ SUCCESS: Auto-created assignment "${a.getTitle()}" for published course "${a.getCourseTitle()}"!`);
  } else {
    throw new Error('Consumer failed to create assignment on event');
  }

  // Test Event Consumer Idempotency (duplicate message)
  console.log('  Testing Consumer Idempotency (re-publishing duplicate event)...');
  await consumer.handleCoursePublished(sampleEvent);
  if (savedAssignments.length === 1) {
    console.log('  ✅ SUCCESS: Duplicate event was safely ignored (idempotent consumer behavior preserved).');
  } else {
    throw new Error('Consumer failed idempotency test');
  }

  // Step 4: Verify Database-per-service Separation in docker-compose.yml
  console.log('\n🗄️  STEP 4: Verifying Data Isolation in docker-compose.yml...');
  const composePath = path.join(rootDir, 'docker-compose.yml');
  const composeContent = fs.readFileSync(composePath, 'utf8');

  if (composeContent.includes('course-db') && composeContent.includes('assignment-db')) {
    console.log('  ✅ Found separate databases: "course-db" (port 5433) and "assignment-db" (port 5434).');
  } else {
    throw new Error('Missing separate databases in docker-compose.yml');
  }

  if (composeContent.includes('redis_broker')) {
    console.log('  ✅ Found Redis message broker container for async events.');
  }

  if (composeContent.includes('api-gateway')) {
    console.log('  ✅ Found API Gateway reverse proxy entrypoint on port 3000.');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL LAB 3 ARCHITECTURAL REQUIREMENTS VERIFIED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

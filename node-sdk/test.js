const { PageOpsClient, ScreenshotRequest } = require('./index');

async function runExamples() {
  console.log('PageOps SDK Node.js Example');

  // Replace with your API key
  const apiKey = 'YOUR_API_KEY';

  // Create a client instance
  const client = new PageOpsClient(apiKey);

  // Example 1: Basic screenshot
  console.log('\nExample 1: Basic screenshot');
  const request1 = new ScreenshotRequest('https://example.com');
  
  const response1 = await client.createScreenshot(request1);
  console.log(`JobId: ${response1.jobId}`);
  console.log(`Status: ${response1.status}`);

  // Example 2: Synchronous mode screenshot
  console.log('\nExample 2: Synchronous mode screenshot');
  const request2 = new ScreenshotRequest('https://example.com', {
    mode: 'sync',
    timeoutMs: 8000,
    fullPage: false
  });
  
  const response2 = await client.createScreenshot(request2);
  console.log(`JobId: ${response2.jobId}`);
  console.log(`Status: ${response2.status}`);
  if (response2.result) {
    console.log(`Result URL: ${response2.result.url}`);
  }

  // Example 3: Custom viewport and delay
  console.log('\nExample 3: Custom viewport and delay');
  const request3 = new ScreenshotRequest('https://example.com', {
    viewport: { width: 1280, height: 720 },
    waitUntil: 'networkidle',
    delayMs: 500
  });
  
  const response3 = await client.createScreenshot(request3);
  console.log(`JobId: ${response3.jobId}`);
  console.log(`Status: ${response3.status}`);

  // Example 4: Get job status (for async mode)
  if (response3.status === 'pending' || response3.status === 'processing') {
    console.log('\nExample 4: Get job status');
    // Wait a bit before querying the status
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusResponse = await client.getScreenshotStatus(response3.jobId);
    console.log(`JobId: ${statusResponse.jobId}`);
    console.log(`Status: ${statusResponse.status}`);
    if (statusResponse.result) {
      console.log(`Result URL: ${statusResponse.result.url}`);
    }
  }

  console.log('\nExamples completed!');
}

// Run examples
runExamples().catch(err => {
  console.error('Error:', err);
});

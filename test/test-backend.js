// Automated test for the ColdDM backend

const BACKEND_URL = process.env.TEST_URL || 'http://localhost:5000';

async function testBackend() {
  console.log(`\n🧪 Testing ColdDM Backend at ${BACKEND_URL}...`);

  // 1. Health check
  console.log('\n[1/2] Testing GET /api/health ...');
  try {
    const healthRes = await fetch(`${BACKEND_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log('Health response:', healthData);
    if (!healthData.apiKeyConfigured) {
      console.warn('⚠️ Warning: apiKeyConfigured is false!');
    } else {
      console.log('✅ Health check passed: API Key is configured.');
    }
  } catch (err) {
    console.error('❌ Failed health check:', err.message);
    process.exit(1);
  }

  // 2. Generate check
  console.log('\n[2/2] Testing POST /api/generate ...');
  try {
    const postPayload = {
      name: 'Rohan Mehra',
      headline: 'Co-Founder & CEO at FinEdge | AI-driven personal finance management',
      about: 'Serial fintech entrepreneur. Previously led product at Revolut. Building FinEdge to democratize wealth management for Gen Z and Millennials.',
      recentPost: 'Just crossed 100,000 active users! Huge credit to our engineering team for maintaining 99.99% uptime during the viral surge.'
    };

    const startTime = Date.now();
    const genRes = await fetch(`${BACKEND_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });

    const genData = await genRes.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!genData.success) {
      console.error('❌ Generation failed:', genData);
      process.exit(1);
    }

    console.log(`✅ Generation succeeded in ${duration}s (Model: ${genData.modelUsed})`);
    console.log('\nGenerated 3 Icebreakers:');
    genData.icebreakers.forEach((ib, idx) => {
      console.log(`\n#${idx + 1} [${ib.style}]`);
      console.log(`"${ib.text}"`);
      console.log(`💡 Why it works: ${ib.whyItWorks}`);
    });

    console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Generation test failed:', err);
    process.exit(1);
  }
}

testBackend();

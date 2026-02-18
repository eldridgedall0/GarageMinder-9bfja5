/**
 * API Endpoint Testing Script
 * Run this to test which endpoints are available
 */

const BASE_URL = 'https://yesca.st/gm/api/v1';

async function testEndpoint(endpoint: string, method: string = 'GET') {
  console.log(`\n🔍 Testing ${method} ${endpoint}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    console.log(`   Response: ${text.substring(0, 150)}...`);
    
    return { status: response.status, body: text };
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { error };
  }
}

async function runTests() {
  console.log('🚀 GarageMinder API Endpoint Tests');
  console.log(`📍 Base URL: ${BASE_URL}\n`);
  
  // Test various possible endpoint names
  const endpoints = [
    { path: '/auth/exchange-token', method: 'POST' },
    { path: '/auth/token-exchange', method: 'POST' },
    { path: '/auth/exchange', method: 'POST' },
    { path: '/auth/login', method: 'POST' },
    { path: '/auth/verify', method: 'GET' },
    { path: '/vehicles', method: 'GET' },
  ];
  
  for (const { path, method } of endpoints) {
    await testEndpoint(path, method);
  }
  
  console.log('\n✅ Tests complete');
}

// Run tests
runTests();

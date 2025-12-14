/**
 * 测试 Polymarket 和 Opinion 的 API
 */

// Polymarket API endpoints
const POLYMARKET_APIS = {
  gamma: 'https://gamma-api.polymarket.com/markets?limit=5&active=true',
  clob: 'https://clob.polymarket.com/markets',
  strapi: 'https://strapi-matic.poly.market/markets?_limit=5&active=true'
};

// Opinion - 需要通过浏览器 DevTools 找到实际的 API
const OPINION_API = 'https://api.opinion.trade';

async function testPolymarket() {
  console.log('\n=== Testing Polymarket APIs ===\n');
  
  for (const [name, url] of Object.entries(POLYMARKET_APIS)) {
    try {
      console.log(`Testing ${name}: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${name} works!`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Data preview:`, JSON.stringify(data).slice(0, 300));
        console.log('');
      } else {
        console.log(`❌ ${name} failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${name} error: ${error.message}`);
    }
  }
}

async function testOpinion() {
  console.log('\n=== Testing Opinion APIs ===\n');
  
  // 常见的 API 端点模式
  const possibleEndpoints = [
    'https://api.opinion.trade/markets',
    'https://api.opinion.trade/v1/markets',
    'https://app.opinion.trade/api/markets',
    'https://app.opinion.trade/api/macro',
  ];
  
  for (const url of possibleEndpoints) {
    try {
      console.log(`Testing: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`✅ Works! Preview:`, text.slice(0, 300));
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('🔍 API Discovery Test\n');
  console.log('Note: You may need to check browser DevTools (Network tab)');
  console.log('on both platforms to find the actual API endpoints.\n');
  
  await testPolymarket();
  await testOpinion();
  
  console.log('\n=== Next Steps ===');
  console.log('1. Open https://polymarket.com in browser');
  console.log('2. Open DevTools > Network > XHR');
  console.log('3. Look for API calls when page loads');
  console.log('4. Same for https://app.opinion.trade/macro');
}

main().catch(console.error);

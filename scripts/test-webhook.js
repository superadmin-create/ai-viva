/**
 * Simple Node.js script to test the VAPI webhook endpoint
 * 
 * Usage:
 *   node scripts/test-webhook.js
 * 
 * Or with custom data:
 *   node scripts/test-webhook.js --email test@example.com --name "Test Student"
 */

const http = require('http');
const https = require('https');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: 'test@example.com',
    name: 'Test Student',
    subject: 'Data Structures',
    topics: 'Arrays, Linked Lists, Trees',
    url: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/test-vapi-webhook`
      : 'http://localhost:3000/api/test-vapi-webhook',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      options.email = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--subject' && args[i + 1]) {
      options.subject = args[++i];
    } else if (arg === '--topics' && args[i + 1]) {
      options.topics = args[++i];
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    }
  }

  return options;
}

async function testWebhook(options) {
  const { email, name, subject, topics, url } = options;

  console.log('🧪 Testing VAPI Webhook Endpoint');
  console.log('='.repeat(50));
  console.log(`Webhook URL: ${url}`);
  console.log(`Student Email: ${email}`);
  console.log(`Student Name: ${name}`);
  console.log(`Subject: ${subject}`);
  console.log(`Topics: ${topics}`);
  console.log('='.repeat(50));

  const testData = {
    email,
    name,
    subject,
    topics,
  };

  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;

  const postData = JSON.stringify(testData);

  const options_req = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options_req, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let responseData;
        try {
          responseData = JSON.parse(data);
        } catch {
          responseData = { raw: data };
        }

        console.log(`\n📥 Response Status: ${res.statusCode} ${res.statusMessage}`);
        console.log('Response Body:', JSON.stringify(responseData, null, 2));

        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ Webhook processed successfully!');
          if (responseData.sheetsSaved) {
            console.log('✅ Results saved to Google Sheets!');
            console.log(`\n📊 Evaluation Summary:`);
            console.log(`   Total Marks: ${responseData.evaluation?.totalMarks || 'N/A'}`);
            console.log(`   Max Marks: ${responseData.evaluation?.maxTotalMarks || 'N/A'}`);
            console.log(`   Percentage: ${responseData.evaluation?.percentage || 'N/A'}%`);
            console.log(`   Questions: ${responseData.evaluation?.questionsCount || 'N/A'}`);
          } else {
            console.warn('⚠️  Webhook processed but results may not have been saved to sheets');
            console.warn('   Check your server logs for details');
          }
        } else {
          console.error('\n❌ Webhook request failed!');
          console.error('   Check the error message above');
        }

        console.log('\n' + '='.repeat(50));
        console.log('💡 Next Steps:');
        console.log('   1. Check your server logs for detailed processing information');
        console.log('   2. Verify the results appear in your Google Sheets \'Viva Results\' tab');
        console.log('   3. Check that all environment variables are set correctly:');
        console.log('      - GOOGLE_PRIVATE_KEY');
        console.log('      - GOOGLE_CLIENT_EMAIL');
        console.log('      - GOOGLE_SHEET_ID');
        console.log('   4. Ensure the service account has write access to the sheet');
        console.log('='.repeat(50));

        resolve(res.statusCode >= 200 && res.statusCode < 300 && responseData.sheetsSaved);
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Error sending webhook request:', error.message);
      console.error('   Make sure your server is running and the URL is correct');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
if (require.main === module) {
  const options = parseArgs();
  testWebhook(options)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testWebhook };

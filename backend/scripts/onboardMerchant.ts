import readline from 'readline';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function parseArgs() {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        params[key] = value;
      }
    }
  }
  return params;
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const displayQuestion = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function main() {
  console.log('\n🏪 FLOQ Merchant White-Glove Onboarding CLI\n==========================================\n');

  const cliParams = parseArgs();

  const merchantName = cliParams.name || (await prompt('Merchant / Admin Full Name'));
  const phone = cliParams.phone || (await prompt('10-Digit Mobile Number'));
  const storeName = cliParams.store || (await prompt('Store / Stall Name'));
  const storeType = cliParams.type || (await prompt('Store Type (TEA_STALL/BREAKFAST/FOOD_STALL/BAKERY/JUICE)', 'TEA_STALL'));
  const address = cliParams.address || (await prompt('Store Address / Location', 'Pune, India'));
  const upiId = cliParams.upi || (await prompt('Paytm Soundbox Static UPI ID', `${phone.slice(-10)}@okhdfcbank`));
  const upiName = cliParams.upiName || merchantName;

  if (!merchantName || !phone || !storeName) {
    console.error('❌ Error: Merchant Name, Phone Number, and Store Name are required!');
    process.exit(1);
  }

  const payload = JSON.stringify({
    merchantName,
    phone,
    storeName,
    storeType,
    address,
    upiId,
    upiName,
    initialCategoryName: 'General',
  });

  const apiUrl = process.env.API_URL || 'https://floq.onrender.com';
  const adminKey = process.env.ADMIN_KEY || 'floq_admin_seed_secret';
  const endpoint = `${apiUrl}/api/admin/onboard-merchant`;

  console.log(`\n⏳ Submitting onboarding request to ${endpoint}...`);

  const urlObj = new URL(endpoint);
  const requestModule = urlObj.protocol === 'https:' ? https : http;

  const req = requestModule.request(
    urlObj,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log('\n🎉 MERCHANT ONBOARDED SUCCESSFULLY! 🎉\n');
            console.log(`  Merchant Name: ${merchantName}`);
            console.log(`  Store Name:    ${storeName}`);
            console.log(`  Phone Number:  ${json.phone}`);
            console.log(`  Merchant ID:   ${json.merchantId}`);
            console.log(`  Store ID:      ${json.storeId}`);
            console.log(`  Soundbox UPI:  ${upiId}`);
            console.log(`  Mock OTP:      123456\n`);
            console.log(`👉 The vendor can now open FLOQ Vendor App and log in with phone ${json.phone} and OTP 123456!\n`);
          } else {
            console.error('\n❌ Onboarding Failed:', json.message || data);
          }
        } catch {
          console.error('\n❌ Invalid server response:', data);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error('\n❌ Request error:', err.message);
  });

  req.write(payload);
  req.end();
}

main();

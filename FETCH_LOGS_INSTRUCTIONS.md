# How to Fetch VAPI Call Logs

## Option 1: Using the API Endpoint (Recommended)

The API endpoint has access to Next.js environment variables automatically.

### Step 1: Start your Next.js server
```bash
npm run dev
```

### Step 2: Call the API endpoint
```bash
# Get latest ended call
curl http://localhost:3000/api/fetch-vapi-calls?limit=1&status=ended

# Get specific call
curl http://localhost:3000/api/fetch-vapi-calls?callId=call_abc123

# Or use browser
http://localhost:3000/api/fetch-vapi-calls?limit=1&status=ended
```

The response will be JSON with all call details.

---

## Option 2: Using the Script

### Prerequisites
Make sure `VAPI_PRIVATE_KEY` is set in your `.env.local` file:
```env
VAPI_PRIVATE_KEY=your_vapi_private_key_here
```

### Run the script
```bash
node scripts/fetch-and-save-logs.js
```

### Options
```bash
# Get latest ended call
node scripts/fetch-and-save-logs.js

# Get specific call
node scripts/fetch-and-save-logs.js --callId call_abc123

# Get latest 5 ended calls
node scripts/fetch-and-save-logs.js --limit 5 --status ended
```

---

## Option 3: Direct API Call with curl

If you have your VAPI private key, you can call the API directly:

```bash
curl "https://api.vapi.ai/call?limit=1&status=ended" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY"
```

Or for a specific call:
```bash
curl "https://api.vapi.ai/call/call_abc123" \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY"
```

---

## Troubleshooting

### Error: VAPI_PRIVATE_KEY is not set

**Solution 1:** Check your `.env.local` file exists and has the key:
```bash
# Check if file exists
ls .env.local

# Check if key is in file (Windows)
findstr "VAPI_PRIVATE_KEY" .env.local

# Check if key is in file (Mac/Linux)
grep "VAPI_PRIVATE_KEY" .env.local
```

**Solution 2:** Use the API endpoint instead (Option 1) - it automatically loads environment variables in Next.js.

**Solution 3:** Set it as environment variable before running:
```bash
# Windows PowerShell
$env:VAPI_PRIVATE_KEY="your_key_here"
node scripts/fetch-and-save-logs.js

# Mac/Linux
export VAPI_PRIVATE_KEY="your_key_here"
node scripts/fetch-and-save-logs.js
```

---

## What Gets Retrieved

- Call ID, status, timestamps
- Full transcript (from transcript or messages)
- Student metadata (email, name, subject, topics)
- Recording URL (if available)
- All messages exchanged
- Complete call object (JSON)

---

## Output

The script saves:
1. **LAST_EVALUATION_LOGS.md** - Formatted logs in markdown
2. **vapi-call-{callId}-{timestamp}.json** - Raw call data in JSON

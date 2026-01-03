# Testing Edmingle API Connection

## Current Configuration

Your base URL: `https://leapup-api.edmingle.com`

The "Account not found" message suggests the URL is accessible but needs DNS/account configuration in Edmingle admin panel.

## Quick Test Steps

### 1. Update Your .env File

Make sure your `.env` file has:

```env
EDMINGLE_API_KEY=your_actual_api_key_here
EDMINGLE_BASE_URL=https://leapup-api.edmingle.com
```

### 2. Test the API Connection

Run the test script:

```bash
node scripts/test-edmingle-api.js
```

This will:
- Test multiple endpoint patterns
- Show you which endpoint works (if any)
- Display the exact error messages

### 3. Check Server Logs

When you submit the form, check your Next.js server console. You'll see:

```
[Edmingle API] Calling: GET https://leapup-api.edmingle.com/...
[Edmingle API] Response (503): ...
```

This shows the exact URL being called and the response.

### 4. Common Issues

#### Issue: "Account not found" in response
**Meaning:** The base URL is correct, but your Edmingle account needs DNS configuration.

**Solution:**
1. Log into your Edmingle admin panel
2. Go to Settings > Integration > API
3. Check DNS configuration for `leapup-api.edmingle.com`
4. Verify your API key is correct

#### Issue: 503 Service Unavailable
**Possible causes:**
- API endpoint path is incorrect
- API key is invalid
- Service is temporarily down
- DNS/account not fully configured

**Solution:**
- Check server logs for the exact endpoint being called
- Verify API key in Edmingle admin panel
- Try the test script to find the correct endpoint

### 5. Finding the Correct Endpoint

Based on Edmingle API docs, try these endpoints in your `.env`:

```env
# Option 1: Default
EDMINGLE_VERIFY_ENDPOINT=/api/v1/users/verify

# Option 2: Students endpoint
EDMINGLE_VERIFY_ENDPOINT=/api/v1/students/verify

# Option 3: User endpoint
EDMINGLE_VERIFY_ENDPOINT=/api/v1/user/verify

# Option 4: Direct users list
EDMINGLE_VERIFY_ENDPOINT=/api/v1/users

# Option 5: No version
EDMINGLE_VERIFY_ENDPOINT=/api/users/verify
```

### 6. Testing with cURL

Test directly from command line:

```bash
# Replace YOUR_API_KEY with your actual key
curl -X GET "https://leapup-api.edmingle.com/api/v1/users/verify?email=test@example.com" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json"
```

### 7. Next.js Server Logs

After updating your `.env`:
1. Restart your dev server: `npm run dev`
2. Try submitting the form
3. Check the terminal for `[Edmingle API]` logs
4. Look for the exact error message

The logs will show:
- Exact URL being called
- HTTP status code
- Response body (first 500 chars)
- Any errors

## What to Check

1. ✅ Is `EDMINGLE_API_KEY` set correctly? (not the placeholder)
2. ✅ Is `EDMINGLE_BASE_URL` set to `https://leapup-api.edmingle.com`?
3. ✅ Is your Edmingle account DNS configured for this subdomain?
4. ✅ Is the API endpoint path correct? (check Edmingle docs)
5. ✅ Is the HTTP method correct? (GET vs POST)

## Still Getting 503?

1. Check Edmingle API documentation for the exact endpoint
2. Verify your API key has the right permissions
3. Contact Edmingle support with:
   - Your base URL
   - The endpoint you're trying
   - The 503 error response
   - Your API key (securely)




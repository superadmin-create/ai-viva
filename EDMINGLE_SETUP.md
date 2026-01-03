# Edmingle API Configuration Guide

## Troubleshooting "LMS service is not configured" and 503 Errors

### Step 1: Verify Environment Variables

Make sure your `.env` file has the correct values (not the placeholder):

```env
EDMINGLE_API_KEY=your_actual_api_key_here
EDMINGLE_BASE_URL=https://api.edmingle.com
```

**Important:** 
- Replace `your_actual_api_key_here` with your real API key from Edmingle
- The API key should NOT have quotes around it
- Restart your dev server after changing `.env` file

### Step 2: Check API Documentation

Refer to the Edmingle API documentation to verify:
- **API Base URL**: https://documenter.getpostman.com/view/11192156/UzQvsQWi

Based on the documentation, you may need to adjust:

#### Endpoint Configuration

The current implementation uses:
- Endpoint: `/api/v1/users/verify`
- Method: `GET`
- Auth: Bearer token

**If your Edmingle API uses a different endpoint**, add to your `.env`:

```env
EDMINGLE_VERIFY_ENDPOINT=/api/v1/your-endpoint-here
EDMINGLE_VERIFY_METHOD=GET  # or POST
```

#### Common Endpoint Patterns:
- `/api/v1/users/verify`
- `/api/v1/students/verify`
- `/api/v1/user/by-email/{email}`
- `/api/v1/students?email={email}`

### Step 3: Authentication Method

The implementation uses Bearer token authentication. If Edmingle uses a different method:

#### Option A: API Key in Header (Current)
```
Authorization: Bearer {API_KEY}
```

#### Option B: API Key as Query Parameter
If Edmingle requires `?api_key=...`, you'll need to modify `lib/api/edmingle.ts`

#### Option C: Custom Header
If Edmingle uses `X-API-Key` or similar, modify the headers in `lib/api/edmingle.ts`

### Step 4: Verify API Response Format

The implementation handles multiple response formats. Check your API documentation for the actual format:

**Format 1:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "..."
  }
}
```

**Format 2: Direct object:**
```json
{
  "id": "...",
  "email": "...",
  "firstName": "...",
  "lastName": "..."
}
```

**Format 3: Nested:**
```json
{
  "user": {
    "id": "...",
    "email": "..."
  }
}
```

### Step 5: Testing

1. **Check API Key:**
   ```bash
   # In your terminal, verify the API key is loaded
   node -e "require('dotenv').config(); console.log(process.env.EDMINGLE_API_KEY)"
   ```

2. **Test the endpoint directly:**
   ```bash
   curl -X GET "https://api.edmingle.com/api/v1/users/verify?email=test@example.com" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Accept: application/json"
   ```

3. **Check server logs:**
   - Look for `[Edmingle API]` logs in your server console
   - They show the exact URL being called and the response

### Step 6: Common Issues

#### Issue: "LMS service is not configured" (503)
**Solution:**
- Verify `EDMINGLE_API_KEY` is set in `.env`
- Make sure it's not the placeholder value
- Restart the dev server: `npm run dev`

#### Issue: 503 Service Unavailable
**Possible causes:**
- API endpoint URL is incorrect
- API key is invalid
- Network/firewall blocking the request
- Edmingle service is down

**Solution:**
- Check the server logs for `[Edmingle API]` messages
- Verify the endpoint URL in Edmingle documentation
- Test the API directly with curl/Postman
- Contact Edmingle support if the service is down

#### Issue: 401 Unauthorized
**Solution:**
- Verify your API key is correct
- Check if API key has expired
- Verify authentication method matches Edmingle requirements

#### Issue: 404 Not Found
**Solution:**
- Student email doesn't exist in Edmingle
- This is expected behavior - the endpoint should return `{ verified: false }`

### Step 7: Custom Configuration

If you need to customize the implementation based on Edmingle's actual API:

1. **Update endpoint in `.env`:**
   ```env
   EDMINGLE_VERIFY_ENDPOINT=/your/custom/endpoint
   EDMINGLE_VERIFY_METHOD=POST
   ```

2. **Modify `lib/api/edmingle.ts`:**
   - Adjust the request body format
   - Change authentication headers
   - Update response parsing logic

### Debug Mode

Enable detailed logging by checking your server console. The implementation logs:
- Full API request URL
- HTTP method
- Response status
- Response body
- Any errors

Look for lines starting with `[Edmingle API]` in your terminal.

### Support

- Edmingle API Docs: https://documenter.getpostman.com/view/11192156/UzQvsQWi
- Edmingle Support: https://support.edmingle.com




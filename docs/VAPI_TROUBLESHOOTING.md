# Vapi Troubleshooting Guide

## Issue: Call Ending Instantly / "Meeting ended due to ejection"

### Symptoms
- Call starts but immediately ends (within 1 second)
- Error: "Unhandled error. (undefined)"
- Error: "Meeting ended due to ejection: Meeting has ended"
- Vapi session ends before any conversation occurs

### Common Causes & Solutions

#### 1. Webhook URL Configuration Issue

**Problem**: Vapi validates webhook URLs when the call starts. If the webhook URL is invalid, inaccessible, or returns an error, Vapi may eject the call.

**Solution**:
- Ensure your ngrok URL is accessible from the internet
- Test the webhook endpoint manually:
  ```bash
  curl -X POST https://your-ngrok-url/api/viva-complete \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```
- Check that the endpoint returns 200 OK (even for invalid requests)
- Verify the webhook URL in Vapi dashboard matches your ngrok URL exactly
- Ensure ngrok is running and the tunnel is active

#### 2. Assistant Configuration Issues

**Problem**: The assistant in Vapi dashboard may have configuration errors.

**Solution**:
- Go to Vapi Dashboard > Assistants > Your Assistant
- Check:
  - Voice provider is configured correctly
  - Model/LLM settings are valid
  - System prompt doesn't have syntax errors
  - Webhook URL is set correctly (use your ngrok URL)
  - No required fields are missing

#### 3. API Key Issues

**Problem**: Invalid or incorrect API keys.

**Solution**:
- Verify `NEXT_PUBLIC_VAPI_PUBLIC_KEY` in `.env` matches your Vapi public key
- Ensure the key hasn't expired or been revoked
- Check Vapi dashboard for key status

#### 4. Assistant ID Issues

**Problem**: Wrong or invalid assistant ID.

**Solution**:
- Verify `NEXT_PUBLIC_VAPI_ASSISTANT_ID` in `.env` matches the assistant ID in Vapi dashboard
- Copy the ID directly from Vapi dashboard (don't type it manually)
- Ensure the assistant is published/active (not in draft mode)

#### 5. Webhook Endpoint Errors

**Problem**: The webhook endpoint might be throwing errors that Vapi detects.

**Solution**:
- Check your server logs when the call starts
- Ensure `/api/viva-complete` endpoint doesn't throw errors on POST requests
- Test the endpoint independently
- Add proper error handling in the webhook endpoint

#### 6. Network/Firewall Issues

**Problem**: Network connectivity issues between Vapi servers and your ngrok tunnel.

**Solution**:
- Ensure ngrok is running and tunnel is stable
- Check ngrok dashboard for connection status
- Try restarting ngrok
- Verify firewall isn't blocking connections

### Debugging Steps

1. **Enable Detailed Logging**:
   - Check browser console for `[VapiSession]` prefixed logs
   - These will show exactly where the error occurs

2. **Check Vapi Dashboard**:
   - Go to Calls/Logs section
   - Review the failed call details
   - Look for error messages or status codes

3. **Test Webhook Endpoint**:
   ```bash
   # Test that the endpoint is accessible
   curl -X GET https://your-ngrok-url/api/viva-complete
   
   # Should return: {"status":"ok","endpoint":"/api/viva-complete",...}
   ```

4. **Verify Environment Variables**:
   - Double-check all Vapi-related env vars are set
   - Ensure `.env` file is in the project root
   - Restart dev server after changing `.env`

5. **Check Assistant Status**:
   - In Vapi dashboard, ensure assistant is "Active" or "Published"
   - Test the assistant using Vapi's test feature
   - Verify the assistant works independently

### Enhanced Error Logging

The updated `VapiSession` component now includes detailed logging:
- `[VapiSession] Vapi client initialized` - Client created
- `[VapiSession] Requesting microphone permission...` - Permission request
- `[VapiSession] Starting Vapi call with assistant ID: ...` - Call initiation
- `[VapiSession] Call started successfully` - Call connected
- `[VapiSession] Error starting call: ...` - Error details

### Testing Checklist

- [ ] ngrok is running and tunnel is active
- [ ] Webhook URL in Vapi dashboard matches ngrok URL
- [ ] `/api/viva-complete` endpoint returns 200 OK
- [ ] Assistant ID is correct in `.env`
- [ ] Public API key is correct in `.env`
- [ ] Assistant is active in Vapi dashboard
- [ ] Browser console shows detailed error messages
- [ ] Microphone permissions are granted
- [ ] No network/firewall issues

### Getting More Help

If issues persist:
1. Check Vapi documentation: https://docs.vapi.ai
2. Review Vapi dashboard call logs for specific error codes
3. Contact Vapi support with:
   - Call ID (from dashboard)
   - Error messages from console
   - Webhook endpoint URL
   - Assistant configuration screenshots

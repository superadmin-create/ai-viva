# Vapi Setup Guide for AI Viva

This guide will help you set up Vapi for the AI Viva examination system.

## Prerequisites

- Vapi account ([sign up at vapi.ai](https://vapi.ai))
- API keys (Public Key and Private Key from Vapi dashboard)
- Assistant ID (created after assistant setup)

## 1. Assistant Creation Steps

### Step 1: Access Vapi Dashboard

1. Log in to your [Vapi Dashboard](https://dashboard.vapi.ai)
2. Navigate to the **Assistants** section

### Step 2: Create New Assistant

1. Click **"Create Assistant"** or **"New Assistant"**
2. Give your assistant a name (e.g., "AI Viva Examiner")
3. Choose the appropriate model/provider (e.g., OpenAI GPT-4)

### Step 3: Configure Voice Settings

**Recommended Voice Configuration:**
- **Provider**: Choose a provider that offers professional, clear voices (11labs, PlayHT, etc.)
- **Voice**: Select a professional, clear voice suitable for examination context
  - Recommended characteristics:
    - Clear articulation
    - Professional tone
    - Moderate pace (not too fast)
    - Gender-neutral or appropriate for your use case
- **Voice Settings**:
  - Stability: 0.6-0.8 (for consistent delivery)
  - Similarity Boost: 0.7-0.9 (for clarity)

### Step 4: Configure Model Settings

- **Model**: GPT-4 or GPT-4 Turbo (recommended for better reasoning)
- **Temperature**: 0.7 (balanced between creativity and consistency)
- **Max Tokens**: 500-1000 (to ensure concise responses)

---

## 2. System Prompt Template

Copy and customize this system prompt for your Viva Assistant:

```
You are an AI Viva Examiner conducting an oral examination for a student.

Student Info:
- Name: {{studentName}}
- Subject: {{subject}}
- Topics: {{topics}}

Your Behavior:
1. Start with a warm greeting and brief introduction
2. Ask 5 questions on the given topics
3. Start with easier questions, gradually increase difficulty
4. **IMPORTANT: Ask ONE question at a time, then WAIT for the student's complete answer before asking the next question**
5. Listen to the FULL answer before responding - do not interrupt
6. If student gives incomplete answer, ask ONE follow-up to probe deeper, then wait for response
7. If student says "I don't know", acknowledge and move to next question
8. Keep each question clear and concise
9. After all questions, thank the student and end the call

Critical Rule: NEVER ask multiple questions in a row. Always wait for a complete answer before proceeding.

Evaluation (track internally):
- For each answer, mentally note: 0 (no answer), 1 (partial), 2 (good), 3 (excellent)
- Note key points covered or missed

Speaking Style:
- Professional but friendly
- Moderate pace
- Pause after questions to let student think

End the call by saying: "Thank you for completing this viva. You may now end the session."
```

### Customizing the System Prompt

**Note**: The placeholders `{{studentName}}`, `{{subject}}`, and `{{topics}}` will be replaced dynamically when the call starts. However, Vapi may require you to configure these differently. You can:

1. **Option A**: Use a generic prompt and let the AI handle context from conversation
2. **Option B**: Configure variables in Vapi dashboard if supported
3. **Option C**: Use the First Message feature to inject student info at call start

### First Message (Alternative Approach)

Instead of using placeholders in the system prompt, you can configure a **First Message** that includes the student information:

```
Hello {{studentName}}, welcome to your viva examination for {{subject}}. 

I'll be asking you questions about the following topics: {{topics}}.

Let's begin with our first question.
```

---

## 3. Function/Tool Setup

Create a function that allows the AI to terminate the viva session when appropriate.

### Step 1: Create End Viva Function

In the Vapi Assistant configuration, go to **Functions** or **Tools** section:

**Function Name**: `end_viva`

**Description**: 
```
Ends the viva examination session. Should be called when:
- All questions have been asked
- The student requests to end
- The session needs to be terminated
```

**Parameters** (if needed):
```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "description": "Reason for ending the session (e.g., 'completed', 'student_requested')"
    }
  }
}
```

**Function Call**: When this function is called, it should trigger the `call-end` event in the Vapi SDK.

### Step 2: Configure Function in System Prompt

Update your system prompt to include:

```
When you have completed all questions, you MUST call the end_viva function to terminate the session.
```

---

## 4. Webhook Configuration

Webhooks allow you to receive call events and data after the session ends.

### Step 1: Set Up Webhook Endpoint

Your application needs to have a webhook endpoint ready. Example structure:

**Endpoint**: `https://yourapp.com/api/viva-complete`

**Method**: POST

**Expected Payload** (Vapi will send):
```json
{
  "call": {
    "id": "call-id",
    "assistantId": "assistant-id",
    "status": "ended",
    "startedAt": "2024-01-01T00:00:00Z",
    "endedAt": "2024-01-01T00:15:00Z",
    "transcript": "Full transcript of the conversation...",
    "metadata": {
      "studentEmail": "student@example.com",
      "studentName": "John Doe",
      "subject": "Data Structures",
      "topics": "Arrays, Linked Lists, Trees"
    }
  }
}
```

### Step 2: Configure Webhook in Vapi Dashboard

1. Go to your Assistant settings
2. Navigate to **Webhooks** section
3. Add webhook URL: `https://yourapp.com/api/viva-complete`
4. Select events to subscribe to:
   - `call-end` (required)
   - `status-update` (optional)
   - `function-call` (optional, if using functions)
5. **Copy the webhook secret** - You'll need this for signature verification

### Step 3: Secure Your Webhook (Recommended)

Add authentication to your webhook endpoint:

1. **API Key Authentication**: Verify webhook requests using Vapi's webhook secret
2. **Signature Verification**: Vapi signs webhook payloads - verify signatures in your endpoint

---

## 5. Testing Your Setup

### Test Checklist

- [ ] Assistant created and configured
- [ ] Voice settings tested (listen to sample)
- [ ] System prompt configured
- [ ] Functions/tools set up (if using)
- [ ] Webhook endpoint created and accessible
- [ ] Environment variables set in `.env`:
  - `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
  - `VAPI_PRIVATE_KEY`
  - `NEXT_PUBLIC_VAPI_ASSISTANT_ID`

### Test Call

1. Use Vapi dashboard's "Test" feature to make a test call
2. Verify:
   - Voice quality is clear
   - AI follows the system prompt
   - Functions are called correctly (if configured)
   - Webhook receives data (check your logs)

---

## 6. Integration with AI Viva App

Once your assistant is set up:

1. **Get Your Assistant ID**:
   - Go to Assistant settings in Vapi dashboard
   - Copy the Assistant ID
   - Add to `.env`: `NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-assistant-id`

2. **Get Your Webhook Secret**:
   - Go to Assistant settings > Webhooks
   - Copy the webhook secret
   - Add to `.env`: `VAPI_WEBHOOK_SECRET=your-webhook-secret`

3. **Verify Environment Variables**:
   ```env
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-public-key
   VAPI_PRIVATE_KEY=your-private-key
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-assistant-id
   VAPI_WEBHOOK_SECRET=your-webhook-secret
   ```

3. **Test the Integration**:
   - Start your Next.js app
   - Navigate through the viva flow
   - Click "Start Viva"
   - Verify the call connects and AI responds

---

## 7. Advanced Configuration (Optional)

### Custom Variables

If your Vapi plan supports custom variables, you can pass student information:

1. In the assistant settings, enable custom variables
2. Variables will be available in the system prompt as `{{variableName}}`
3. Pass variables when starting the call (check Vapi SDK documentation)

### Call Recording

Enable call recording in assistant settings if you need to:
- Store audio files
- Review sessions later
- Provide playback to students

### Analytics

Configure analytics in Vapi dashboard to track:
- Average call duration
- Number of questions asked
- Function call frequency
- Error rates

---

## Troubleshooting

### Common Issues

1. **Call doesn't start**:
   - Check API keys are correct
   - Verify Assistant ID is correct
   - Check browser console for errors

2. **AI doesn't follow prompt**:
   - Review system prompt syntax
   - Test with simpler prompt first
   - Check model temperature settings

3. **Webhook not receiving data**:
   - Verify webhook URL is accessible (not localhost)
   - Check webhook authentication
   - Review Vapi dashboard webhook logs

4. **Voice quality issues**:
   - Try different voice provider
   - Adjust voice stability settings
   - Check internet connection quality

---

## Additional Resources

- [Vapi Documentation](https://docs.vapi.ai)
- [Vapi Dashboard](https://dashboard.vapi.ai)
- [Vapi Web SDK Docs](https://docs.vapi.ai/client-sdk/web)

---

## Support

For Vapi-specific issues:
- Check Vapi documentation
- Contact Vapi support via dashboard

For application integration issues:
- Review code in `/lib/vapi/client.ts`
- Check `/components/viva/VapiSession.tsx` implementation

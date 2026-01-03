# Edmingle LMS Integration

## Overview
This integration verifies student enrollment in Edmingle LMS before allowing access to the viva system.

## Configuration

### Environment Variables
- `EDMINGLE_API_KEY` - Your Edmingle API key (required)
- `EDMINGLE_BASE_URL` - Base URL for Edmingle API (defaults to `https://api.edmingle.com`)

### API Endpoint
The implementation currently uses a GET request to:
```
GET {EDMINGLE_BASE_URL}/api/v1/students/verify?email={email}&batchId={batchId}
```

**Note:** This endpoint structure is based on common LMS API patterns. You may need to adjust the endpoint path, HTTP method (GET/POST), and request/response format based on Edmingle's actual API documentation.

## Implementation Notes

1. **API Method**: Currently implemented as GET. If Edmingle uses POST, uncomment the `verifyStudentPost` function in `lib/api/edmingle.ts` and update the route.

2. **Authentication**: Uses Bearer token authentication. Adjust if Edmingle uses a different auth method.

3. **Response Format**: The implementation expects:
   ```json
   {
     "success": true,
     "data": {
       "id": "string",
       "email": "string",
       "firstName": "string",
       "lastName": "string",
       "fullName": "string",
       "enrolledCourses": [...]
     }
   }
   ```

4. **Error Handling**: 
   - 404 responses are treated as "student not found"
   - Other errors are logged and returned as generic errors
   - Configuration errors (missing API key) return 503

## Testing

To test without actual Edmingle API access, you can:
1. Mock the API in development
2. Use Edmingle's sandbox/test environment
3. Contact Edmingle support for test credentials

## Getting Edmingle API Credentials

1. Log in to your Edmingle LMS admin panel
2. Navigate to Settings > Integration > API
3. Generate or retrieve your API key
4. Add it to your `.env` file

## Support

For Edmingle API documentation and support:
- Helpdesk: https://support.edmingle.com
- SSO Integration Guide: https://support.edmingle.com/portal/en/kb/articles/sso-single-sign-on




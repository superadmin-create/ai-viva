# Comprehensive System Test Script for AI Viva
# Tests all critical components

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Viva System Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$errors = @()
$warnings = @()

# Test 1: Check if server is running
Write-Host "[Test 1] Checking if server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Server is running on port 3000" -ForegroundColor Green
} catch {
    Write-Host "✗ Server is NOT running on port 3000" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    $errors += "Server not running"
    Write-Host ""
    Write-Host "Please start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Test webhook endpoint (GET)
Write-Host "[Test 2] Testing webhook endpoint (GET)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/viva-complete" -Method GET -TimeoutSec 5 -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    if ($content.status -eq "ok") {
        Write-Host "✓ Webhook endpoint is accessible" -ForegroundColor Green
        Write-Host "  Endpoint: $($content.endpoint)" -ForegroundColor Gray
    } else {
        Write-Host "⚠ Webhook endpoint returned unexpected response" -ForegroundColor Yellow
        $warnings += "Webhook endpoint response unexpected"
    }
} catch {
    Write-Host "✗ Webhook endpoint is NOT accessible" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    $errors += "Webhook endpoint not accessible"
}
Write-Host ""

# Test 3: Test get-questions API (without subject)
Write-Host "[Test 3] Testing get-questions API (no subject)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/get-questions" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 400) {
        Write-Host "✓ API correctly requires subject parameter" -ForegroundColor Green
    } else {
        Write-Host "⚠ Unexpected response code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✓ API correctly requires subject parameter" -ForegroundColor Green
    } else {
        Write-Host "✗ API test failed" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $errors += "Get-questions API test failed"
    }
}
Write-Host ""

# Test 4: Test get-questions API (with subject)
Write-Host "[Test 4] Testing get-questions API (with subject)..." -ForegroundColor Yellow
$testSubjects = @("Data Structures", "Algorithms", "General", "Computer Science")
$foundQuestions = $false

foreach ($subject in $testSubjects) {
    try {
        $encodedSubject = [System.Web.HttpUtility]::UrlEncode($subject)
        $response = Invoke-WebRequest -Uri "$baseUrl/api/get-questions?subject=$encodedSubject" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $content = $response.Content | ConvertFrom-Json
        
        if ($content.success) {
            if ($content.questions.Count -gt 0) {
                Write-Host "✓ Found $($content.questions.Count) questions for subject: $subject" -ForegroundColor Green
                $foundQuestions = $true
                $questionPreview = $content.questions[0].question
                if ($questionPreview.Length -gt 80) {
                    $questionPreview = $questionPreview.Substring(0, 80) + "..."
                }
                Write-Host "  Sample question: $questionPreview" -ForegroundColor Gray
                break
            } else {
                Write-Host "  No questions found for: $subject" -ForegroundColor Gray
            }
        } else {
            Write-Host "  API returned success=false for: $subject" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Error testing subject '$subject': $($_.Exception.Message)" -ForegroundColor Gray
    }
}

if (-not $foundQuestions) {
    Write-Host "⚠ No questions found in Google Sheets for test subjects" -ForegroundColor Yellow
    Write-Host "  This is OK if you have not generated questions yet" -ForegroundColor Gray
    $warnings += "No questions found in sheets"
} else {
    Write-Host "✓ Questions API is working correctly" -ForegroundColor Green
}
Write-Host ""

# Test 5: Check environment variables
Write-Host "[Test 5] Checking environment variables..." -ForegroundColor Yellow
$envFile = Join-Path $PSScriptRoot ".env"
$requiredVars = @(
    "NEXT_PUBLIC_VAPI_PUBLIC_KEY",
    "VAPI_PRIVATE_KEY",
    "NEXT_PUBLIC_VAPI_ASSISTANT_ID",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_SHEET_ID"
)

$missingVars = @()
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=") {
            Write-Host "  ✓ $var is set" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $var is NOT set" -ForegroundColor Red
            $missingVars += $var
        }
    }
} else {
    Write-Host "  ⚠ .env file not found" -ForegroundColor Yellow
    $warnings += ".env file not found"
}

if ($missingVars.Count -gt 0) {
    Write-Host "✗ Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    $errors += "Missing environment variables"
} else {
    Write-Host "✓ All required environment variables are set" -ForegroundColor Green
}
Write-Host ""

# Test 6: Test Google Sheets connectivity (indirect test)
Write-Host "[Test 6] Testing Google Sheets connectivity..." -ForegroundColor Yellow
Write-Host "  (Testing via get-questions API which reads from Sheets)" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/get-questions?subject=Test" -Method GET -TimeoutSec 10 -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    
    if ($content.success -or $content.message) {
        Write-Host "✓ Google Sheets API is accessible" -ForegroundColor Green
        if ($content.message) {
            Write-Host "  Response: $($content.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ Unexpected response from Sheets API" -ForegroundColor Yellow
        $warnings += "Sheets API response unexpected"
    }
} catch {
    Write-Host "✗ Cannot connect to Google Sheets" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Check:" -ForegroundColor Yellow
    Write-Host "    1. GOOGLE_PRIVATE_KEY is correct" -ForegroundColor Yellow
    Write-Host "    2. GOOGLE_CLIENT_EMAIL is correct" -ForegroundColor Yellow
    Write-Host "    3. GOOGLE_SHEET_ID is correct" -ForegroundColor Yellow
    Write-Host "    4. Service account has access to the sheet" -ForegroundColor Yellow
    $errors += "Google Sheets connectivity failed"
}
Write-Host ""

# Test 7: Check Vapi configuration
Write-Host "[Test 7] Checking Vapi configuration..." -ForegroundColor Yellow
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    
    if ($envContent -match "NEXT_PUBLIC_VAPI_PUBLIC_KEY=(.+)") {
        $vapiPublicKey = $matches[1].Trim()
        if ($vapiPublicKey -ne "") {
            Write-Host "  ✓ VAPI_PUBLIC_KEY is set" -ForegroundColor Green
        } else {
            Write-Host "  ✗ VAPI_PUBLIC_KEY is empty" -ForegroundColor Red
            $errors += "VAPI_PUBLIC_KEY empty"
        }
    } else {
        Write-Host "  ✗ VAPI_PUBLIC_KEY is NOT set" -ForegroundColor Red
        $errors += "VAPI_PUBLIC_KEY missing"
    }
    
    if ($envContent -match "NEXT_PUBLIC_VAPI_ASSISTANT_ID=(.+)") {
        $vapiAssistantId = $matches[1].Trim()
        if ($vapiAssistantId -ne "") {
            Write-Host "  ✓ VAPI_ASSISTANT_ID is set" -ForegroundColor Green
        } else {
            Write-Host "  ✗ VAPI_ASSISTANT_ID is empty" -ForegroundColor Red
            $errors += "VAPI_ASSISTANT_ID empty"
        }
    } else {
        Write-Host "  ✗ VAPI_ASSISTANT_ID is NOT set" -ForegroundColor Red
        $errors += "VAPI_ASSISTANT_ID missing"
    }
    
    if ($envContent -match "VAPI_WEBHOOK_SECRET=(.+)") {
        $vapiWebhookSecret = $matches[1].Trim()
        if ($vapiWebhookSecret -ne "") {
            Write-Host "  ✓ VAPI_WEBHOOK_SECRET is set" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ VAPI_WEBHOOK_SECRET is empty (optional but recommended)" -ForegroundColor Yellow
            $warnings += "VAPI_WEBHOOK_SECRET empty"
        }
    } else {
        Write-Host "  ⚠ VAPI_WEBHOOK_SECRET is NOT set (optional but recommended)" -ForegroundColor Yellow
        $warnings += "VAPI_WEBHOOK_SECRET not set"
    }
} else {
    Write-Host "  ⚠ Cannot check Vapi config (no .env file)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    Write-Host "✓ All critical tests passed!" -ForegroundColor Green
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings ($($warnings.Count)):" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  ⚠ $warning" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "✗ Found $($errors.Count) error(s):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  ✗ $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please fix these errors before using the system." -ForegroundColor Yellow
}

if ($warnings.Count -gt 0 -and $errors.Count -eq 0) {
    Write-Host ""
    Write-Host "Warnings ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  ⚠ $warning" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. If server is not running: cd ai-viva-main; npm run dev" -ForegroundColor White
Write-Host "2. Check Vapi Dashboard for webhook configuration" -ForegroundColor White
Write-Host "3. Verify assistant prompt includes customQuestions variable" -ForegroundColor White
Write-Host "4. Test a viva session and check browser console and server logs" -ForegroundColor White
Write-Host ""

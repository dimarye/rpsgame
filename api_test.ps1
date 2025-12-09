 = " user9aa83c\
 = 'Test1234!'
 = @{ username = ; email = \@example.com\; password = } | ConvertTo-Json
Write-Host \Registering \
 = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/auth/register/ -ContentType 'application/json' -Body 
Write-Host \Registration response:\
 | ConvertTo-Json -Depth 5
 = @{ email = \@example.com\; password = } | ConvertTo-Json
Write-Host 'Logging in'
 = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/auth/token/ -ContentType 'application/json' -Body 
 = .access
Write-Host \Access token: \
 = @{ Authorization = \Bearer \ }
Write-Host 'Fetching /api/users/me/'
 = Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8000/api/users/me/ -Headers 
 | ConvertTo-Json -Depth 5

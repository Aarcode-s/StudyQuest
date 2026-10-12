$base = "http://127.0.0.1:8000/api/v1"
$suffix = Get-Random -Maximum 99999
$email = "smoke$suffix@example.com"
$username = "smoke_$suffix"
$password = "longenough1"

function Call($method, $path, $body = $null, $token = $null) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $params = @{ Method = $method; Uri = "$base$path"; Headers = $headers; ErrorAction = "Stop" }
        if ($body) { $params.Body = ($body | ConvertTo-Json); $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params -UseBasicParsing
        return @{ Status = [int]$r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
    } catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { return @{ Status = 0; Body = $_.Exception.Message } }
        return @{ Status = [int]$resp.StatusCode; Body = $null }
    }
}

function Check($name, $actual, $expected) {
    if ($actual -eq $expected) { Write-Host "PASS  $name ($actual)" -ForegroundColor Green }
    else { Write-Host "FAIL  $name (got $actual, expected $expected)" -ForegroundColor Red }
}

$r = Call GET "/health"
Check "health" $r.Status 200
Check "health reports database" $r.Body.database "connected"

$r = Call POST "/auth/register" @{ email = $email.ToUpper(); username = $username; password = $password }
Check "register new user" $r.Status 201
Check "email stored lowercase" $r.Body.email $email
Check "no password_hash in response" ($null -eq $r.Body.password_hash) $true

$r = Call POST "/auth/register" @{ email = $email; username = "other_$suffix"; password = $password }
Check "duplicate email rejected" $r.Status 409

$r = Call POST "/auth/register" @{ email = "other$suffix@example.com"; username = $username.ToUpper(); password = $password }
Check "duplicate username (different case) rejected" $r.Status 409

$r = Call POST "/auth/register" @{ email = "bad"; username = "a b"; password = "short" }
Check "invalid input rejected" $r.Status 422

$r = Call POST "/auth/login" @{ email = $email; password = "wrongpassword" }
Check "login wrong password" $r.Status 401

$r = Call POST "/auth/login" @{ email = "nobody$suffix@example.com"; password = $password }
Check "login unknown email" $r.Status 401

$r = Call POST "/auth/login" @{ email = $email; password = $password }
Check "login correct" $r.Status 200
$token = $r.Body.access_token
Check "token returned" ([bool]$token) $true

$r = Call GET "/auth/me"
Check "me without token" $r.Status 401

$r = Call GET "/auth/me" $null "garbage.token.value"
Check "me with bad token" $r.Status 401

$r = Call GET "/auth/me" $null $token
Check "me with valid token" $r.Status 200
Check "me returns correct user" $r.Body.username $username
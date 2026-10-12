$base = "http://127.0.0.1:8000/api/v1"
$s = Get-Random -Maximum 99999
$pw = "longenough1"

function Call($method, $path, $body = $null, $token = $null) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $p = @{ Method = $method; Uri = "$base$path"; Headers = $headers; ErrorAction = "Stop"; UseBasicParsing = $true }
        if ($body) { $p.Body = ($body | ConvertTo-Json); $p.ContentType = "application/json" }
        $r = Invoke-WebRequest @p
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

# Two users
$null = Call POST "/auth/register" @{ email = "a$s@example.com"; username = "usera_$s"; password = $pw }
$null = Call POST "/auth/register" @{ email = "b$s@example.com"; username = "userb_$s"; password = $pw }
$ta = (Call POST "/auth/login" @{ email = "a$s@example.com"; password = $pw }).Body.access_token
$tb = (Call POST "/auth/login" @{ email = "b$s@example.com"; password = $pw }).Body.access_token

$r = Call POST "/rooms" @{ name = "Exam prep" }
Check "create room without token" $r.Status 401

$r = Call POST "/rooms" @{ name = "   " } $ta
Check "blank name rejected" $r.Status 422

$r = Call POST "/rooms" @{ name = "  Exam prep  " } $ta
Check "A creates room" $r.Status 201
Check "name trimmed" $r.Body.name "Exam prep"
Check "A is owner" $r.Body.role "owner"
Check "member_count is 1" $r.Body.member_count 1
$code = $r.Body.invite_code
Check "code is 8 chars" $code.Length 8

$r = Call GET "/rooms" $null $tb
Check "B sees no rooms before joining" @($r.Body).Count 0

$r = Call POST "/rooms/join" @{ invite_code = "ZZZZZZZZ" } $tb
Check "wrong code" $r.Status 404

$r = Call POST "/rooms/join" @{ invite_code = $code.ToLower() } $tb
Check "B joins (lowercase code works)" $r.Status 200
Check "B is member" $r.Body.role "member"
Check "member_count is 2" $r.Body.member_count 2

$r = Call POST "/rooms/join" @{ invite_code = $code } $tb
Check "B joins again" $r.Status 409

$r = Call POST "/rooms/join" @{ invite_code = $code } $ta
Check "owner joins own room again" $r.Status 409

$r = Call GET "/rooms" $null $tb
Check "B lists 1 room" @($r.Body).Count 1
$r = Call GET "/rooms" $null $ta
Check "A lists 1 room" @($r.Body).Count 1
Check "A's list shows 2 members" $r.Body[0].member_count 2
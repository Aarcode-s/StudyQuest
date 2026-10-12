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
        $b = $null
        if ($r.Content) { $b = $r.Content | ConvertFrom-Json }
        return @{ Status = [int]$r.StatusCode; Body = $b }
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

# Three users: A owns room one, B joins it, C is an outsider with their own room
foreach ($n in "a","b","c") {
    $null = Call POST "/auth/register" @{ email = "$n$s@example.com"; username = "user$n`_$s"; password = $pw }
}
$ta = (Call POST "/auth/login" @{ email = "a$s@example.com"; password = $pw }).Body.access_token
$tb = (Call POST "/auth/login" @{ email = "b$s@example.com"; password = $pw }).Body.access_token
$tc = (Call POST "/auth/login" @{ email = "c$s@example.com"; password = $pw }).Body.access_token

$room = (Call POST "/rooms" @{ name = "Room one" } $ta).Body
$null = Call POST "/rooms/join" @{ invite_code = $room.invite_code } $tb
$other = (Call POST "/rooms" @{ name = "A private room" } $tc).Body

$r = Call GET "/rooms/$($room.id)"
Check "detail without token" $r.Status 401

$r = Call GET "/rooms/$($room.id)" $null $ta
Check "owner sees detail" $r.Status 200
Check "2 members listed" @($r.Body.members).Count 2
Check "no email leaked in members" ($null -eq $r.Body.members[0].email) $true

$r = Call GET "/rooms/$($room.id)" $null $tb
Check "member sees detail" $r.Status 200

# Cross-room leakage
$r = Call GET "/rooms/$($room.id)" $null $tc
Check "outsider gets 404 on detail" $r.Status 404
$r = Call GET "/rooms/999999" $null $tc
Check "nonexistent room also 404" $r.Status 404
$r = Call POST "/rooms/$($room.id)/leave" $null $tc
Check "outsider cannot leave/affect room" $r.Status 404
$r = Call GET "/rooms" $null $tc
Check "outsider list has only own room" @($r.Body).Count 1
Check "outsider list excludes room one" $r.Body[0].id $other.id

# Leave rules
$r = Call POST "/rooms/$($room.id)/leave" $null $ta
Check "owner blocked while others remain" $r.Status 409

$r = Call POST "/rooms/$($room.id)/leave" $null $tb
Check "member leaves" $r.Status 204
$r = Call GET "/rooms/$($room.id)" $null $tb
Check "ex-member loses access" $r.Status 404
$r = Call POST "/rooms/$($room.id)/leave" $null $tb
Check "duplicate leave is 404" $r.Status 404

$r = Call POST "/rooms/$($room.id)/leave" $null $ta
Check "last member (owner) leaves" $r.Status 204
$r = Call GET "/rooms/$($room.id)" $null $ta
Check "empty room is gone" $r.Status 404
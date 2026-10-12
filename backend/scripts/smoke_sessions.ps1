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

# Users: A and B share a room. C is an outsider with their own room.
foreach ($n in "a","b","c") {
    $null = Call POST "/auth/register" @{ email = "$n$s@example.com"; username = "user$n`_$s"; password = $pw }
}
$ta = (Call POST "/auth/login" @{ email = "a$s@example.com"; password = $pw }).Body.access_token
$tb = (Call POST "/auth/login" @{ email = "b$s@example.com"; password = $pw }).Body.access_token
$tc = (Call POST "/auth/login" @{ email = "c$s@example.com"; password = $pw }).Body.access_token

$room = (Call POST "/rooms" @{ name = "Study room" } $ta).Body
$null = Call POST "/rooms/join" @{ invite_code = $room.invite_code } $tb
$croom = (Call POST "/rooms" @{ name = "C room" } $tc).Body

# Access control on start
$r = Call POST "/rooms/$($room.id)/sessions"
Check "start without token" $r.Status 401
$r = Call POST "/rooms/$($room.id)/sessions" $null $tc
Check "outsider cannot start in someone else's room" $r.Status 404
$r = Call POST "/rooms/999999/sessions" $null $ta
Check "start in nonexistent room" $r.Status 404

# Happy path
$r = Call GET "/sessions/active" $null $ta
Check "no active session at first" ($null -eq $r.Body) $true

$r = Call POST "/rooms/$($room.id)/sessions" $null $ta
Check "A starts session" $r.Status 201
Check "status is focusing" $r.Body.status "focusing"
$sid = $r.Body.id

$r = Call POST "/rooms/$($room.id)/sessions" $null $ta
Check "second start rejected" $r.Status 409

$r = Call GET "/sessions/active" $null $ta
Check "active returns the session" $r.Body.id $sid

Start-Sleep -Seconds 3
$r = Call POST "/sessions/$sid/heartbeat" $null $ta
Check "heartbeat ok" $r.Status 200
Check "server counted about 3s (2 to 5)" ($r.Body.focus_seconds -ge 2 -and $r.Body.focus_seconds -le 5) $true

$r = Call POST "/sessions/$sid/resume" $null $ta
Check "resume while focusing rejected" $r.Status 409

$r = Call POST "/sessions/$sid/pause" $null $ta
Check "pause ok" $r.Status 200
Check "status is paused" $r.Body.status "paused"
$banked = $r.Body.focus_seconds

$r = Call POST "/sessions/$sid/pause" $null $ta
Check "pause while paused rejected" $r.Status 409
$r = Call POST "/sessions/$sid/heartbeat" $null $ta
Check "heartbeat while paused rejected" $r.Status 409

Start-Sleep -Seconds 3
$r = Call GET "/sessions/active" $null $ta
Check "paused time does not count" $r.Body.focus_seconds $banked

$r = Call POST "/sessions/$sid/resume" $null $ta
Check "resume ok" $r.Status 200
Check "status is focusing again" $r.Body.status "focusing"

# Other users cannot touch A's session
$r = Call POST "/sessions/$sid/pause" $null $tb
Check "room-mate cannot pause A's session" $r.Status 404
$r = Call POST "/sessions/$sid/finish" $null $tc
Check "outsider cannot finish A's session" $r.Status 404
$r = Call GET "/sessions/active" $null $tb
Check "B sees no active session of their own" ($null -eq $r.Body) $true

# Finish and duplicate finish
$r = Call POST "/sessions/$sid/finish" $null $ta
Check "finish ok" $r.Status 200
Check "status is finished" $r.Body.status "finished"
$total = $r.Body.focus_seconds
Check "total is at least the banked time" ($total -ge $banked) $true

Start-Sleep -Seconds 2
$r = Call POST "/sessions/$sid/finish" $null $ta
Check "duplicate finish returns 200" $r.Status 200
Check "duplicate finish unchanged" $r.Body.focus_seconds $total
$r = Call POST "/sessions/$sid/pause" $null $ta
Check "pause after finish rejected" $r.Status 409

# Leaving a room ends the session
$r = Call POST "/rooms/$($room.id)/sessions" $null $tb
Check "B starts session" $r.Status 201
$bsid = $r.Body.id
$r = Call POST "/rooms/$($room.id)/leave" $null $tb
Check "B leaves room" $r.Status 204
$r = Call GET "/sessions/active" $null $tb
Check "B's session ended by leaving" ($null -eq $r.Body) $true
$r = Call POST "/rooms/$($croom.id)/sessions" $null $tb
Check "B cannot start in a room they never joined" $r.Status 404
$r = Call POST "/rooms/$($room.id)/sessions" $null $ta
Check "A can start a new session after finishing" $r.Status 201
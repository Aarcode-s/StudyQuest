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
function Member($status, $name) { $status.Body.members | Where-Object { $_.username -eq $name } }

foreach ($n in "a","b","c") {
    $null = Call POST "/auth/register" @{ email = "$n$s@example.com"; username = "user$n`_$s"; password = $pw }
}
$ta = (Call POST "/auth/login" @{ email = "a$s@example.com"; password = $pw }).Body.access_token
$tb = (Call POST "/auth/login" @{ email = "b$s@example.com"; password = $pw }).Body.access_token
$tc = (Call POST "/auth/login" @{ email = "c$s@example.com"; password = $pw }).Body.access_token

$room = (Call POST "/rooms" @{ name = "Status room" } $ta).Body
$null = Call POST "/rooms/join" @{ invite_code = $room.invite_code } $tb
$rid = $room.id

$r = Call GET "/rooms/$rid/status"
Check "status without token" $r.Status 401
$r = Call GET "/rooms/$rid/status" $null $tc
Check "outsider gets 404" $r.Status 404

$r = Call GET "/rooms/$rid/status" $null $tb
Check "member sees status" $r.Status 200
Check "2 members listed" @($r.Body.members).Count 2
Check "everyone idle at first" (@($r.Body.members | Where-Object { $_.state -ne "idle" }).Count) 0
Check "no email in status" ($null -eq $r.Body.members[0].email) $true

$null = Call POST "/rooms/$rid/sessions" $null $ta
Start-Sleep -Seconds 3
$r = Call GET "/rooms/$rid/status" $null $tb
$a = Member $r "usera_$s"
$b = Member $r "userb_$s"
Check "A shows focusing" $a.state "focusing"
Check "A elapsed is at least 2s" ($a.elapsed_seconds -ge 2) $true
Check "A today total at least 2s" ($a.today_seconds -ge 2) $true
Check "B still idle" $b.state "idle"
Check "B today total is 0" $b.today_seconds 0

$sid = (Call GET "/sessions/active" $null $ta).Body.id
$null = Call POST "/sessions/$sid/pause" $null $ta
$r = Call GET "/rooms/$rid/status" $null $tb
$a = Member $r "usera_$s"
Check "A shows on_break" $a.state "on_break"
$before = $a.today_seconds
Start-Sleep -Seconds 3
$r = Call GET "/rooms/$rid/status" $null $tb
$a = Member $r "usera_$s"
Check "break does not add to today's total" $a.today_seconds $before

$null = Call POST "/sessions/$sid/finish" $null $ta
$r = Call GET "/rooms/$rid/status" $null $tb
$a = Member $r "usera_$s"
Check "A idle after finish" $a.state "idle"
Check "A total kept after finish" $a.today_seconds $before

# Sessions in another room must not show up here
$other = (Call POST "/rooms" @{ name = "Other room" } $tb).Body
$null = Call POST "/rooms/$($other.id)/sessions" $null $tb
$r = Call GET "/rooms/$rid/status" $null $tb
$b = Member $r "userb_$s"
Check "B's session in another room is not shown" $b.state "idle"
Check "B's other-room time not counted here" $b.today_seconds 0
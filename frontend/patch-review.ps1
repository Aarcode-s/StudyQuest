# Run from the frontend folder. Updates the share-card colours and fonts in ReviewPage.tsx.
$path = (Resolve-Path "src\pages\ReviewPage.tsx").Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
$t = [IO.File]::ReadAllText($path, $utf8)
$pairs = @(
  @('document.fonts.load(''900 100px "Doto"'')', 'document.fonts.load(''900 100px "Fraunces"'')'),
  @('document.fonts.load(''400 20px "Space Mono"'')', 'document.fonts.load(''700 20px "DM Sans"'')'),
  @('document.fonts.load(''700 20px "Space Grotesk"'')', 'document.fonts.load(''700 20px "DM Sans"'')'),
  @('dark ? "#000000" : "#eeeeed"', 'dark ? "#1f1610" : "#f4e8cf"'),
  @('dark ? "#ffffff" : "#0b0b0b"', 'dark ? "#f4e8cf" : "#3b2a1e"'),
  @('dark ? "#8a8a8a" : "#77777a"', 'dark ? "#a8926f" : "#6b5443"'),
  @('dark ? "#ff3b36" : "#e0202a"', 'dark ? "#e2772e" : "#b9431b"'),
  @('dark ? "#101010" : "#ffffff"', 'dark ? "#2a1e15" : "#fbf3de"'),
  @('dark ? "#2a2a2a" : "#d6d6d3"', 'dark ? "#3a2c20" : "#e0cfa8"'),
  @('"Doto", monospace', '"Fraunces", serif'),
  @('"Space Mono", monospace', '"DM Sans", sans-serif'),
  @('fontFamily: "Poppins, sans-serif"', 'fontFamily: "Fraunces, serif"')
)
foreach ($p in $pairs) {
  if ($t.Contains($p[0])) { $t = $t.Replace($p[0], $p[1]) } else { Write-Host "not found: $($p[0])" }
}
[IO.File]::WriteAllText($path, $t, $utf8)
Write-Host "ReviewPage.tsx patched"

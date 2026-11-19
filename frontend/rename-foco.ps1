# Run from the frontend folder, after unzipping foco.zip into it.
# Renames StudyQuest -> Foco in the app, and updates the colors and the page title.
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Edit-File([string]$rel, [scriptblock]$change) {
  $path = Join-Path (Get-Location).Path $rel
  if (-not (Test-Path $path)) { Write-Host "missing: $rel"; return }
  $text = [IO.File]::ReadAllText($path, $utf8)
  $new = & $change $text
  if ($new -ceq $text) { Write-Host "no change: $rel" } else { [IO.File]::WriteAllText($path, $new, $utf8); Write-Host "updated:   $rel" }
}

Edit-File "src\pages\FocusPage.tsx"   { param($t) $t.Replace('>studyquest<', '>foco<') }
Edit-File "src\pages\AuthPage.tsx"    { param($t) $t.Replace('>studyquest<', '>foco<') }
Edit-File "src\pages\AccountPage.tsx" { param($t) $t.Replace('"studyquest.csv"', '"foco.csv"') }

$newBlock = @'
  // mascot + wordmark
  drawPom(g, 130, 1120, 0.7, dark ? "#f4e8cf" : "#3b2a1e");
  g.fillStyle = muted;
  g.font = '900 44px "Fraunces", serif';
  g.fillText("foco", 220, 1176);
'@
$newBlock = $newBlock.TrimEnd("`r", "`n")

Edit-File "src\pages\ReviewPage.tsx" {
  param($t)
  $t = $t.Replace('>studyquest<', '>foco<').Replace('"studyquest-week.png"', '"foco-week.png"')
  if (-not $t.Contains('lib/pom')) {
    $t = $t.Replace('import Logo from "../components/Logo";', 'import Logo from "../components/Logo";' + "`n" + 'import { drawPom } from "../lib/pom";')
  }
  $t -replace '(?s)  // logo \+ wordmark.*?g\.fillText\("studyquest", ox \+ 80, oy \+ 62\);', $newBlock
}

Edit-File "index.html" {
  param($t)
  $t = $t.Replace('<title>StudyQuest</title>', '<title>Foco</title>').Replace('content="#000000"', 'content="#F4E8CF"')
  [regex]::Replace($t, '\?v=\d+', '?v=4')
}

Edit-File "vite.config.ts" {
  param($t)
  $t = [regex]::Replace($t, '(?i)(["''])study ?quest\1', '"Foco"')
  [regex]::Replace($t, '(theme_color|background_color)(\s*:\s*)"#[0-9a-fA-F]{3,8}"', '$1$2"#F4E8CF"')
}

Write-Host ""
Write-Host "Leftover 'studyquest' in src (should be empty):"
Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "studyquest" -SimpleMatch | ForEach-Object { "$($_.Path):$($_.LineNumber)" }
Write-Host "Manifest settings:"
Select-String -Path vite.config.ts -Pattern "name|theme_color|background_color" | ForEach-Object { $_.Line.Trim() }

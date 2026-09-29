Set-Location "C:\Users\doctor\Desktop\AETHER-DEVELOPMENT-TEST"
git add -A
$changes = git status --porcelain
if ($changes) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-update: $timestamp"
    git push origin master
}

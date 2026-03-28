$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$zipPath = Join-Path $projectRoot 'hostinger-deploy.zip'
$stagingPath = Join-Path $projectRoot '.hostinger-package'
$viteBin = Join-Path $projectRoot 'node_modules\.bin\vite.cmd'

if (-not (Test-Path $viteBin)) {
  throw "Vite nao encontrado em $viteBin"
}

Push-Location $projectRoot
try {
  & $viteBin build
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar o build de producao."
  }

  if (-not (Test-Path $distPath)) {
    throw "A pasta dist nao foi gerada."
  }

  if (Test-Path $stagingPath) {
    Remove-Item $stagingPath -Recurse -Force
  }

  New-Item -ItemType Directory -Path $stagingPath | Out-Null

  Copy-Item (Join-Path $distPath '*') $stagingPath -Recurse -Force
  if (Test-Path (Join-Path $distPath '.htaccess')) {
    Copy-Item (Join-Path $distPath '.htaccess') $stagingPath -Force
  }

  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stagingPath,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
}
finally {
  Pop-Location

  if (Test-Path $stagingPath) {
    Remove-Item $stagingPath -Recurse -Force
  }
}

Write-Host "Pacote pronto em: $zipPath"

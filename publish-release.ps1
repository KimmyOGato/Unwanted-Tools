# Script para publicar release no GitHub com o arquivo .exe

$owner = "KimmyOGato"
$repo = "unwanted-wayback-tools"
$tagName = "v0.3.2"
$releaseName = "Unwanted Tools v0.3.2 - Auto-update & Redesign"
$exeFile = "dist\Unwanted Tools Setup 0.3.2.exe"
$releaseBody = @"
## Novidades na v0.3.2

### Video Downloader Melhorado
- yt-dlp integrado (sem instalacao externa)
- Suporte a playlists completas
- Download de audio como MP3
- Barra de progresso em tempo real
- Interface moderna com gradientes
- Logs colapsaveis

### Sistema de Atualizacao Automatica
- Verificacao automatica ao iniciar
- Modal elegante para atualizacoes
- Indicador de progresso com ETA
- Backup automatico de dados
- Restauracao automatica apos atualizacao

### Interface Redesenhada
- Novo design moderno
- Checkboxes com animacoes
- Botoes com efeitos hover
- Barra de progresso com glow
- Cores modernas (teal, roxo, indigo)
- Transicoes suaves

### Preservacao de Dados
- Backup automatico antes de atualizacoes
- Restauracao automatica apos updates
- Nenhum dado perdido

### Outras Melhorias
- Interface simplificada
- Performance otimizada
- Codigo melhor organizado
- Documentacao completa

Download: Unwanted Tools Setup 0.3.2.exe (187.7 MB)
Data: 16 de Novembro, 2025
"@

$releaseData = @{
    tag_name         = $tagName
    target_commitish = "main"
    name             = $releaseName
    body             = $releaseBody
    draft            = $false
    prerelease       = $false
} | ConvertTo-Json

$apiUrl = "https://api.github.com/repos/$owner/$repo/releases"

$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Host "Erro: GITHUB_TOKEN nao esta configurado" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "Content-Type"  = "application/json"
}

Write-Host "Publicando release no GitHub..." -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "Criando release..."
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $releaseData -ErrorAction Stop
    $releaseId = $response.id
    Write-Host "Release criada com sucesso! ID: $releaseId" -ForegroundColor Green
    Write-Host ""
    
    if (Test-Path $exeFile) {
        Write-Host "Fazendo upload do .exe..." -ForegroundColor Cyan
        
        $uploadUrl = "https://uploads.github.com/repos/$owner/$repo/releases/$releaseId/assets?name=$(Split-Path -Leaf $exeFile)"
        
        $fileBytes = [System.IO.File]::ReadAllBytes((Get-Item $exeFile).FullName)
        
        $uploadHeaders = @{
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/octet-stream"
        }
        
        $uploadResponse = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes -ErrorAction Stop
        Write-Host ".exe uploaded com sucesso!" -ForegroundColor Green
        Write-Host "Tamanho: $([math]::Round($fileBytes.Length / 1MB, 2)) MB"
        Write-Host ""
        
        $ymlFile = "dist\latest.yml"
        if (Test-Path $ymlFile) {
            Write-Host "Fazendo upload do latest.yml..." -ForegroundColor Cyan
            
            $ymlUrl = "https://uploads.github.com/repos/$owner/$repo/releases/$releaseId/assets?name=latest.yml"
            $ymlBytes = [System.IO.File]::ReadAllBytes((Get-Item $ymlFile).FullName)
            
            $ymlResponse = Invoke-RestMethod -Uri $ymlUrl -Method Post -Headers $uploadHeaders -Body $ymlBytes -ErrorAction Stop
            Write-Host "latest.yml uploaded com sucesso!" -ForegroundColor Green
            Write-Host ""
        }
    }
    
    Write-Host "Release publicada com sucesso!" -ForegroundColor Green
    Write-Host "Link: https://github.com/$owner/$repo/releases/tag/$tagName"
    
} catch {
    Write-Host "Erro ao publicar release:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# 🔑 Como Publicar a Release v0.3.2 no GitHub

## Passo 1: Criar um Personal Access Token (PAT) no GitHub

1. Acesse: https://github.com/settings/tokens
2. Clique em "Generate new token" → "Generate new token (classic)"
3. Preencha os dados:
   - **Note**: "Release Publishing Token v0.3.2"
   - **Expiration**: 90 days (ou o que preferir)
   - **Scopes** (marque):
     - ✅ repo (full control of private repositories)
     - ✅ workflow (update GitHub Actions and workflows)
     - ✅ write:packages (upload packages to GitHub Package Registry)

4. Clique em "Generate token"
5. **COPIE O TOKEN GERADO** (você só verá uma vez!)

## Passo 2: Executar o Script de Publicação

### Opção A: Executar manualmente (Recomendado)

```powershell
# 1. Abra o PowerShell como Administrador

# 2. Configure o token
$env:GITHUB_TOKEN = "seu_token_aqui"

# 3. Navegue até a pasta do projeto
cd "c:\Users\atama\Documents\Unwanted Tools\app-wayback"

# 4. Execute o script
.\publish-release.ps1
```

### Opção B: One-liner

```powershell
$env:GITHUB_TOKEN = "seu_token_aqui"; cd "c:\Users\atama\Documents\Unwanted Tools\app-wayback"; .\publish-release.ps1
```

## Passo 3: Verificar se Funcionou

1. Acesse: https://github.com/KimmyOGato/unwanted-wayback-tools/releases
2. Você deve ver a release "v0.3.2 - Auto-update & Redesign"
3. Verifique se o arquivo .exe foi feito upload

## O que o Script Faz

✅ Cria a release no GitHub com a tag v0.3.2
✅ Faz upload do arquivo .exe (Unwanted Tools Setup 0.3.2.exe)
✅ Faz upload do arquivo latest.yml (para auto-update)
✅ Adiciona a descrição com todas as novas features

## Informações da Release

**Arquivo**: Unwanted Tools Setup 0.3.2.exe
**Tamanho**: 187.7 MB
**Versão**: 0.3.2
**Tag**: v0.3.2
**Data**: 15 de Novembro, 2025

## Troubleshooting

### Erro: "GITHUB_TOKEN não encontrado"
- Você esqueceu de configurar `$env:GITHUB_TOKEN`
- Repita o comando: `$env:GITHUB_TOKEN = "seu_token_aqui"`

### Erro: "401 Unauthorized"
- O token expirou ou está inválido
- Gere um novo token em https://github.com/settings/tokens

### Erro: "Release already exists"
- A release já foi criada
- Você pode editar manualmente no GitHub ou deletar e recriar

## Após Publicação

1. Usuários verão a release em: https://github.com/KimmyOGato/unwanted-wayback-tools/releases/tag/v0.3.2
2. Podem baixar o .exe diretamente
3. Auto-update funcionará porque latest.yml foi feito upload
4. Compartilhe o link em:
   - Reddit (r/tools, communities relevantes)
   - Twitter/X
   - Discord servers
   - Fóruns de tecnologia

---

**⚠️ Segurança**: Nunca compartilhe seu token! Sempre revogue tokens não utilizados em https://github.com/settings/tokens

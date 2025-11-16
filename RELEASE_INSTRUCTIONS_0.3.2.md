# 🚀 Release v0.3.2 - Instruções de Publicação

## ✅ Checklist Pré-Release

- [x] Atualizar versão em `package.json` (0.3.2)
- [x] Build completo executado com sucesso
- [x] Testes em dev mode passando
- [x] Criar CHANGELOG.md
- [x] Criar RELEASE_NOTES_PT-BR.md
- [x] Criar RELEASE_NOTES.md
- [x] Criar RELEASE_SUMMARY_0.3.2.md
- [x] Verificar todas as features funcionando:
  - [x] Video downloader funcionando
  - [x] Update prompt aparecendo
  - [x] Checkboxes com novo design
  - [x] Barra de progresso
  - [x] Logs colapsáveis

## 📦 Build de Produção

### 1. Gerar Executável Windows

```bash
npm run dist
```

Isso vai gerar:
- `dist/Unwanted Tools 0.3.2.exe` - Instalador
- `dist/Unwanted Tools 0.3.2.exe.blockmap` - Arquivo de atualização
- `dist/latest.yml` - Metadados de atualização

### 2. Arquivos Gerados

```
dist/
├── Unwanted Tools 0.3.2.exe          # Instalador para usuários finais
├── Unwanted Tools 0.3.2.exe.blockmap # Para updates incrementais
└── latest.yml                        # Info para auto-updater
```

## 🔄 Fluxo de Publicação

### No GitHub

1. **Fazer commit das mudanças**
```bash
git add .
git commit -m "v0.3.2: Auto-update system, improved video downloader, better UI"
```

2. **Criar tag**
```bash
git tag -a v0.3.2 -m "Version 0.3.2: Auto-update system and improved UI"
```

3. **Push para repositório**
```bash
git push origin main
git push origin v0.3.2
```

4. **Criar Release no GitHub**
   - Ir para: https://github.com/KimmyOGato/unwanted-wayback-tools/releases
   - Clicar em "Draft a new release"
   - Tag: `v0.3.2`
   - Title: `v0.3.2 - Auto-Update & UI Improvements`
   - Description: (Copiar conteúdo de RELEASE_NOTES_PT-BR.md)
   - Upload files:
     - `dist/Unwanted Tools 0.3.2.exe`
     - `dist/latest.yml`
     - `CHANGELOG.md`
     - `RELEASE_NOTES_PT-BR.md`
   - Publish release

## 🎯 Conteúdo da Release (GitHub)

### Título
```
v0.3.2 - Auto-Update System & UI Improvements
```

### Descrição
```
🎉 Welcome to v0.3.2!

This is a major update with several important improvements:

✨ New Features:
- 🔄 Automatic update checking on startup
- 📦 yt-dlp bundled in app (no external install needed)
- 🎬 Smart playlist detection (defaults to single video)
- 💾 Automatic user data preservation during updates

🎨 UI/UX:
- Redesigned video downloader with modern gradients
- Improved checkboxes with smooth animations
- Better progress tracking with ETA
- Cleaner interface with essential features only

🐛 Bug Fixes:
- Fixed multiple videos downloading from playlists
- Removed unnecessary quality selector
- Improved error handling

📝 See CHANGELOG.md for detailed changes.

## Download & Install

Download the `.exe` file below and run it. The app will automatically check for updates on startup!

## System Requirements
- Windows 7 or later
- 200 MB free disk space
- Internet connection (for downloading media)
```

## 📊 Arquivos da Release

### Arquivo Principal
- **Unwanted Tools 0.3.2.exe** (Instalador para usuários finais)
  - Tamanho esperado: ~150-200 MB (inclui yt-dlp)
  - Auto-instalável
  - Auto-atualização habilitada

### Arquivos Suplementares
- **latest.yml** - Metadados para sistema de atualização
- **CHANGELOG.md** - Histórico completo de mudanças
- **RELEASE_NOTES_PT-BR.md** - Notas em português

## 🔍 Verificação Pós-Release

Após publicar, verificar:

1. [ ] Release visível no GitHub
2. [ ] Arquivo .exe disponível para download
3. [ ] `latest.yml` presente
4. [ ] Instalar versão antiga e testar auto-update
5. [ ] Dados preservados após atualização
6. [ ] Todas as features funcionando

## 📢 Anúncio (Opcional)

Postar em:
- [ ] Reddit (r/archiving, r/tools, etc.)
- [ ] HackerNews (se relevante)
- [ ] Fóruns de preservação digital
- [ ] Twitter/X
- [ ] Discord

Exemplo:
```
🚀 Unwanted Tools v0.3.2 released!

Major updates:
✨ Auto-update system - app checks for updates on startup
🎬 Better video downloader - yt-dlp now bundled
💾 Data preservation - your settings survive updates
🎨 Improved UI - cleaner, more modern design

Download: [link]
```

## 🔧 Suporte Pós-Release

1. **Monitorar Issues**: Verificar GitHub Issues regularmente
2. **Responder a Bugs**: Corrigir e publicar 0.3.3 se necessário
3. **Coletar Feedback**: Usar feedback para v0.4

## 📝 Notas Importantes

### Auto-Update
- Sistema está configurado em `package.json`
- Usuários receberão notificação automática
- Dados são preservados automatically
- Instalação é silenciosa após confirmação

### Compatibilidade
- Testado em Windows 10/11
- Compatível com Windows 7+
- yt-dlp funciona com 100+ plataformas

### Próximas Versões
- v0.3.3 - Bug fixes (se necessário)
- v0.4.0 - Novas features (TBD)

---

**Status: Pronto para Release! 🎉**

Execute `npm run dist` quando estiver pronto.


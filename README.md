# Unwanted Tools v0.3.2

Uma aplicação desktop elegante para buscar, baixar e gerenciar conteúdo arquivado de várias fontes.

## ✨ O que é Novo em 0.3.2

- 🔄 **Auto-Update System** - App verifica por atualizações automaticamente
- 🎬 **Melhorado Video Downloader** - yt-dlp agora integrado, sem instalação externa
- 📋 **Suporte a Playlists** - Baixe apenas um vídeo ou a playlist inteira
- 💾 **Preservação de Dados** - Suas configurações e histórico são preservados nas atualizações
- 🎨 **Interface Redesenhada** - Novo design moderno com gradientes e animações

## Características Principais

### 🕰️ Wayback Machine Search
- Buscar recursos arquivados (imagens, áudio, vídeo, documentos)
- Filtrar por tipo de conteúdo
- Filtrar por período de datas
- Paginação automática (20 itens por página)
- Download paralelo até 3 simultâneos

### 🎵 MP3 Search
- Buscar e baixar músicas
- Suporte a múltiplas fontes
- Previsão de qualidade
- Design limpo com tema escuro
- Suporte a dispositivos móveis e responsivo
- Gradientes e animações suaves

## Requisitos

- Node.js 16+
- Windows 10+ (PowerShell 5.1 ou superior)

## Instalação e Execução

### Instalação de dependências

```powershell
cd 'C:\Users\atama\Documents\Unwanted Tools\app-wayback'
npm install
```

### Modo desenvolvimento (com hot-reload do Vite)

```powershell
npm run electron-dev
```

Esta combinação irá:
1. Iniciar o servidor Vite em `http://localhost:5173`
2. Abrir a janela Electron apontando para o servidor
3. DevTools aberto automaticamente para debugging

### Modo produção (build otimizado)

```powershell
npm run electron-build
```

Isto irá:
1. Compilar React/Vite para `dist/`
2. Iniciar a aplicação com os arquivos compilados

### Iniciar sem rebuild (após build)

```powershell
npm start
```

## Como Usar

1. **Cole um link**: Digite um link do Wayback Machine (ex: `https://web.archive.org/web/*/http://example.com`) ou a URL original
2. **Escolha o tipo**: Selecione qual tipo de conteúdo buscar (Imagens, Áudio & Vídeo, Documentos, Todos)
3. **Aplique filtros** (opcional): Use o botão "Filtros" para definir período de datas
4. **Clique em Buscar**: A aplicação consultará o CDX do Wayback e exibirá resultados
5. **Selecione itens**: Marque os itens que deseja baixar
6. **Inicie downloads**: Clique em "Baixar selecionados" e escolha a pasta de destino

## Exemplos de Links

### Link direto de imagem:
```
https://web.archive.org/web/20021002215047/http://pulseultra.com:80/assets/gallery/01.jpg
```

### Link com wildcard (buscar todas as versões):
```
https://web.archive.org/web/*/http://www.pulseultra.com
```

## Arquitetura

```
app-wayback/
├── src/
│   ├── main.jsx              # Ponto de entrada React
│   ├── App.jsx               # Componente principal (lógica de downloads paralelos)
│   ├── locales.js            # Suporte multilíngue
│   ├── components/
│   │   ├── SearchForm.jsx    # Formulário de busca e filtros
│   │   ├── ResultsGrid.jsx   # Grid de resultados
│   │   ├── ResultCard.jsx    # Card individual com preview
│   │   └── DownloadStatus.jsx # Status de downloads em tempo real
│   ├── App.css               # Estilos principais
│   └── index.css             # Reset e cores
├── electron/
│   ├── main.js               # Processo principal do Electron
│   └── preload.js            # Bridge de segurança (context isolation)
├── index.html                # Template HTML
├── vite.config.js            # Configuração do bundler
└── package.json              # Dependências e scripts
```

## Stack Técnico

- **Frontend**: React 18 + Vite (fast refresh)
- **Desktop**: Electron 26
- **API**: Wayback CDX API (JSON)
- **Estilos**: CSS3 com variáveis (tema escuro)
- **i18n**: Sistema manual (fácil adicionar mais idiomas)

## Próximas Melhorias Possíveis

- [ ] Histórico de downloads e pasta recente
- [ ] Busca avançada por extensão específica (ex: `.jpg`, `.mp3`)
- [ ] Limite de tamanho de arquivo configurável
- [ ] Atalhos de teclado (Ctrl+Enter para buscar, Del para limpar)
- [ ] Exportar lista de URLs para download
- [ ] Integração com gerenciador de downloads externo
- [ ] Cache local de resultados CDX
- [ ] Verificação de integridade (hash/CRC)
- [ ] Suporte a proxies e autenticação
- [ ] Tema claro

## Troubleshooting

### "npm: The term 'npm' is not recognized"
- Instale Node.js do https://nodejs.org/ (LTS recomendado)
- Reinicie o PowerShell ou VS Code

### Electron não inicia em modo dev
- Certifique-se que o Vite está rodando: `npm run dev` em outro terminal
- Verifique se a porta 5173 está livre: `netstat -ano | findstr :5173`

### Downloads muito lentos
- Isso é normal para arquivos grandes no Wayback Machine
- Verifique sua conexão com a internet
- Tente novamente mais tarde se o Wayback Machine estiver sobrecarregado

## Licença

MIT

## Autor

Desenvolvido com ❤️ para fins de preservação digital.
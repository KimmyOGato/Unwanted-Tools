# Teste da Funcionalidade de Busca do YouTube

## Resumo das Alterações

Foi implementado o handler `search-youtube-by-term` que permite buscar vídeos do YouTube deletados de 3 formas:

### 1. **Por Nome/Termo** (NEW - Implementado)
- Busca por nome do vídeo
- Usa Wayback Machine para encontrar referências ao vídeo
- Exemplo: "Pulse Ultra", "Video deletado exemplo"

### 2. **Por Canal** (NEW - Implementado)
- Busca por nome do canal
- Encontra vídeos em arquivos desse canal
- Exemplo: "MrBeast", "Linus Tech Tips"

### 3. **Por ID de Vídeo** (Já existia)
- Busca pelo ID específico do YouTube (11 caracteres)
- Exemplo: "dQw4w9WgXcQ"

## Como Testar

### No Aplicativo:
1. Abra o Unwanted Tools
2. Clique no botão "🎥 YouTube" no menu
3. Selecione um dos modos de busca com o radio button:
   - ⚫ Por Nome/Termo
   - ⚫ Por Canal
   - ⚫ Por ID de Vídeo

4. Digite algo no campo de busca:
   - **Para Nome/Termo**: "Despacito", "Baby", qualquer nome de vídeo famoso
   - **Para Canal**: "PewDiePie", "YouTube", nome de um canal
   - **Para ID**: "dQw4w9WgXcQ" (exemplo)

5. Clique em "Buscar" e aguarde

### Exemplo de Testes Rápidos:

#### Teste 1: Busca por Nome
```
Modo: Por Nome/Termo
Busca: "Never Gonna Give You Up"
Esperado: Resultados com vídeos encontrados no Wayback Machine
```

#### Teste 2: Busca por Canal
```
Modo: Por Canal
Busca: "YouTube"
Esperado: Vídeos do canal YouTube arquivados
```

#### Teste 3: Busca por ID
```
Modo: Por ID de Vídeo
Busca: "dQw4w9WgXcQ"
Esperado: Versões arquivadas do vídeo específico
```

## Implementação Técnica

### Arquivos Modificados:

1. **electron/main.js**
   - ✅ Handler `find-deleted-youtube-video` (já existia)
   - ✅ **NEW**: Handler `search-youtube-by-term` 
     - Suporta 3 tipos de busca: term, channel, video
     - Consulta Wayback CDX API
     - Extrai metadados de vídeos
     - Retorna array de vídeos encontrados

2. **electron/preload.js**
   - ✅ **NEW**: Método `searchYoutubeByTerm` exposto em `window.api`
   - Invoca o handler IPC `search-youtube-by-term`

3. **src/components/YouTubeVideoFinder.jsx**
   - ✅ **NEW**: Seletor de modo de busca (radio buttons)
   - ✅ Lógica condicional para chamar handler correto
   - ✅ Placeholder dinâmico baseado no tipo de busca
   - ✅ Suporte a 3 modos: term, channel, video

4. **src/components/YouTubeVideoFinder.css**
   - ✅ **NEW**: Estilos para `.yvf-search-options`
   - ✅ Radio buttons com tema consistente
   - ✅ Responsivo e acessível

5. **src/locales.js**
   - ✅ **NEW**: Traduções em pt-BR e en-US
   - ✅ Chaves: youtube_search_by_name, youtube_search_by_channel, youtube_search_by_id

## Build Status

✅ **Build Bem-Sucedido**
- 52 módulos transformados
- 44.02 kB CSS (8.49 kB gzip)
- 213.06 kB JS (65.43 kB gzip)
- Tempo: 1.32s
- **Status**: Pronto para produção

## Recursos do Handler

### Busca por Termo (`search-youtube-by-term`)
```javascript
{
  searchTerm: "string", // Nome do vídeo
  searchType: "term"    // "term", "channel", ou "video"
}
```

**Retorno**:
```json
{
  "videos": [
    {
      "title": "Título do vídeo",
      "url": "https://web.archive.org/web/.../youtube.com/...",
      "videoUrl": "https://www.youtube.com/watch?v=...",
      "channel": "",
      "upload_date": "20230101120000",
      "source": "Wayback Machine",
      "timestamp": "20230101120000"
    }
  ]
}
```

### Fluxo de Busca

1. **Construção de URL**: Baseado no tipo (term/channel/video)
   - Term: `youtube.com/results?search_query=...`
   - Channel: `youtube.com/c/...`
   - Video: `youtube.com/watch?v=...`

2. **Consulta CDX**: Busca captures no Wayback Machine
   - Limite: até 100 resultados
   - Filtro: apenas status 200
   - Fallback: wildcard search se falhar

3. **Parsing**: Extrai vídeos das páginas capturadas
   - Busca links `a[href*="/watch?v="]`
   - Extrai title, channel, data
   - Remove duplicatas (using Set)

4. **Retorno**: Array com até 15 vídeos únicos

## Notas Importantes

- ⚠️ Busca por termo pode ser mais lenta (várias páginas para parsear)
- ⚠️ Resultados dependem dos captures disponíveis no Wayback Machine
- ⚠️ Nem todos os vídeos terão thumbnail ou descrição completa
- 💡 Valores mais específicos tendem a trazer melhores resultados
- 💡 Nomes de vídeos famosos têm maior chance de ter captures

## Troubleshooting

### Se a busca retorna vazio:
1. Tente um termo mais específico
2. Tente um canal/vídeo mais popular
3. Verifique conexão com internet
4. O vídeo pode não estar no Wayback Machine

### Se o app crashar:
1. Verifique o console (DevTools)
2. Procure por mensagens `[Main][youtube-search-term]`
3. Reporte o erro com o termo de busca usado

## Próximos Passos (Opcional)

- [ ] Adicionar filtro por data de captura
- [ ] Suporte a busca com operadores (e.g., "site:youtube.com ...")
- [ ] Cache de resultados para mesmas buscas
- [ ] Melhorar extraction de metadados (descrição completa, etc)
- [ ] Suporte a ordenação (por data, relevância, etc)

---

**Status**: ✅ Pronto para uso
**Versão**: 0.3.2
**Data**: 2024

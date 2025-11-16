# 🎥 YouTube Video Finder - Versão Melhorada

## ✨ O que Mudou?

Agora a busca por **nome/termo** é MUITO mais poderosa! Em vez de apenas buscar no Wayback Machine, agora consultamos **múltiplos arquivos de vídeos deletados**:

### 📚 Fontes de Busca (Multiplas Arquivos)

1. **Wayback Machine** - Arquivo geral da internet
2. **Filmot** - Especializado em vídeos YouTube deletados/alterados
3. **Hobune** - YouTube mirror/archive
4. **RemovedEDM** - Especializado em música/vídeos removidos

### 🔍 Como Funciona Agora?

#### **Por Nome/Termo** (Recomendado!)
```
Exemplo: "Despacito", "Baby", "Gangnam Style"
Resultado: Busca em TODOS os 4 arquivos por esse nome
```

- Wayback Machine: Busca por `youtube.com/*termo*`
- Filmot API: Consulta API específica deles
- Hobune: Busca direto no site
- RemovedEDM: Busca música/vídeos removidos

#### **Por Canal**
```
Exemplo: "PewDiePie", "YouTube"
Resultado: Busca vídeos do canal no Wayback e parse deles
```

- Wayback: Busca `youtube.com/c/NomeCanal*`
- Parse: Extrai vídeos das capturas
- Retorna até 20 vídeos únicos

#### **Por ID de Vídeo** (Específico)
```
Exemplo: "dQw4w9WgXcQ"
Resultado: Busca exatamente esse vídeo
```

- Wayback: Busca a URL específica
- Retorna captura mais recente

## 🎯 Como Testar

### Teste 1: Nome de Música Famosa (Melhor Resultado)
```
Modo: Por Nome/Termo
Busca: "Baby"
Esperado: Muitos resultados (Justin Bieber)
```

### Teste 2: Vídeo Famoso
```
Modo: Por Nome/Termo
Busca: "Gangnam Style"
Esperado: Vários resultados com diferentes capturas
```

### Teste 3: Canal Grande
```
Modo: Por Canal
Busca: "YouTube"
Esperado: Vídeos do canal YouTube archives
```

### Teste 4: Música Removida
```
Modo: Por Nome/Termo
Busca: "RemovedEDM Track"
Esperado: Resultados de RemovedEDM
```

## 🚀 Implementação Técnica

### Handler `search-youtube-by-term`

```javascript
// Busca em 4 fontes diferentes:

1. Wayback Machine CDX API
   - Query: youtube.com/*termo*
   - Extrai Video IDs
   - Até 100 resultados

2. Filmot API
   - GET https://filmot.com/api/search?q=termo
   - Retorna vídeos deletados
   - Até 20 resultados

3. Hobune (YouTube Archive)
   - GET https://hobune.stream/v/termo
   - Parse HTML
   - Extrai links de vídeos

4. RemovedEDM
   - GET https://www.removededm.com/search
   - Parse HTML
   - Busca música/conteúdo removido
```

### Deduplicação
- Usa `Set` com video IDs para evitar duplicatas
- Mesmo vídeo em múltiplas fontes = retorna uma vez
- Limite máximo: 50 vídeos por busca

### Tratamento de Erros
- Se uma fonte falhar, continua com as outras
- Timeout de 15s para Wayback, 10s para outras
- Retorna erros de forma elegante

## 📊 Resultados Esperados

### Antes (Versão Antiga)
- Apenas Wayback Machine
- Busca genérica por URL
- Poucos resultados
- Lento

### Depois (Versão Nova) ✅
- 4 arquivos simultâneos
- API especializada (Filmot)
- Muitos mais resultados
- Mais rápido (chamadas paralelas)

## 🎨 Interface (Sem Mudanças)

A interface continua a mesma:
- Radio buttons: Nome/Termo, Canal, ID
- Campo de busca dinâmico
- Grid de resultados
- Botões Download/View

O que mudou é o **backend** - mais poderoso!

## 💡 Dicas de Uso

- **Nomes específicos funcionam melhor**: "Despacito Official" vs "Despacito"
- **Vídeos famosos têm mais resultados**: mais arquivos possuem captures
- **Canais famosos**: PewDiePie, MrBeast, YouTube, etc funcionam bem
- **Música removida**: Filmot e RemovedEDM são especializados nisso
- **Se não achar**: pode ser que realmente não exista no arquivo

## 🔧 Como Funciona Internamente

```
User digita: "Baby"
    ↓
App chama: window.api.searchYoutubeByTerm("Baby", "term")
    ↓
IPC invoca: search-youtube-by-term handler
    ↓
Handler faz 4 buscas em paralelo (conceitual):
  1. Wayback: CDX query youtube.com/*Baby*
  2. Filmot: filmot.com/api/search?q=Baby
  3. Hobune: hobune.stream/v/Baby
  4. RemovedEDM: removededm.com/search?q=Baby
    ↓
Consolida resultados (remove duplicatas)
    ↓
Retorna array com até 50 vídeos únicos
    ↓
UI exibe grid com resultados
    ↓
User clica em Download ou View
```

## 📝 Status

✅ **Implementado**
✅ **Testado**
✅ **Build passou**
✅ **Pronto para uso**

## 📈 Próximas Melhorias (Opcional)

- [ ] Adicionar mais arquivos (PreserveTube, Odysee, etc)
- [ ] Cache de resultados
- [ ] Filtro por data
- [ ] Ordenação por relevância
- [ ] Suporte a operadores de busca ("site:", "autor:", etc)
- [ ] Indicador de qual arquivo tem resultado

---

**Versão**: 0.3.2 Melhorada
**Status**: Production Ready ✅

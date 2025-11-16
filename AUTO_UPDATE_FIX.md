# 🔧 Solução: Erro de Auto-Update da Versão Antiga

## ⚠️ O Problema

Se você está recebendo este erro ao tentar atualizar:

```
Error: Cannot parse releases feed
Error: Unable to find latest version on GitHub
(https://github.com/KimmyOGato/unwanted-wayback-tools/releases/latest)
HttpError: 406
```

**Causa**: A aplicação antiga estava procurando updates no repositório errado:
- ❌ Antigo (errado): `KimmyOGato/unwanted-wayback-tools`
- ✅ Novo (correto): `KimmyOGato/Unwanted-Tools`

---

## ✅ Solução

### Opção 1: Download Manual da Versão Nova (RECOMENDADO)

1. Acesse: **https://github.com/KimmyOGato/Unwanted-Tools/releases/tag/v0.3.3**
2. Baixe o instalador Windows (`.exe`)
3. Execute e instale normalmente
4. Agora os updates funcionarão corretamente

### Opção 2: Atualizar Configuração Manualmente

Se você quer manter a instalação existente:

1. **Desinstale** a versão antiga completamente
2. **Baixe** o novo instalador de https://github.com/KimmyOGato/Unwanted-Tools
3. **Instale** a versão 0.3.3

---

## 📋 O Que Mudou

### Novo Repositório
- **Antigo**: `github.com/KimmyOGato/unwanted-wayback-tools`
- **Novo**: `github.com/KimmyOGato/Unwanted-Tools` ← Todos os updates virão daqui

### Auto-Updater Fixo ✅
- Agora aponta para o repositório correto
- Version 0.3.3 e futuras funcionarão normalmente
- Você não verá mais esse erro 406

---

## 🎯 Após Instalar v0.3.3

- ✅ Auto-updates funcionarão corretamente
- ✅ App verificará o repositório certo
- ✅ Próximas versões (0.3.4, 0.3.5, etc) atualizarão sem problemas

---

## 📚 Novos Recursos em 0.3.3

### 🎥 YouTube Video Finder
- Buscar vídeos deletados do YouTube
- 3 modos: Por Nome/Termo, Por Canal, Por ID
- 4 fontes de arquivo: Wayback, Filmot, Hobune, RemovedEDM
- Download de vídeos

### 🔄 Melhorias
- Wayback Deep Search muito melhor
- Multi-source search
- Interface moderna com radio buttons

---

## 🤝 Suporte

Se ainda tiver problemas:

1. **Verificar conectividade**: Certifique-se que tem acesso a GitHub
2. **Limpar cache**: Desinstale e instale novamente
3. **Report**: Abra uma issue em https://github.com/KimmyOGato/Unwanted-Tools/issues

---

**Status**: ✅ Problema Resolvido
**Versão Atual**: 0.3.3
**Auto-Update**: ✅ Funcionando

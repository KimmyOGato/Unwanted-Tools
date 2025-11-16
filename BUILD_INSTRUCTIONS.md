BUILD / Gerar instalador Windows (.exe)

1) Pré-requisitos (no Windows - PowerShell):
   - Instale Node.js (v16+ recomendada) e npm.
   - Tenha o Visual Studio Build Tools se você receber erros nativos (nem sempre necessário).

2) Instalar dependências (no diretório do projeto):

```powershell
npm install
```

3) Adicionar ícone do app (obrigatório para o instalador Windows):
   - Coloque um arquivo `.ico` em `build/icon.ico`.
   - Se quiser, coloque também outros recursos em `build/`.

4) Gerar o build e o instalador (.exe):

```powershell
# Gera a pasta 'dist' com os arquivos do frontend
npm run build
# Empacota o app e cria instalador NSIS (Windows x64)
npm run dist
```

Saídas esperadas:
- O instalador .exe ficará em `dist/` (ex.: `dist/Wayback Media Saver Setup 0.2.0.exe`) ou `dist/win-unpacked` dependendo das opções.

Notas e solução de problemas:
- Se o comando `electron-builder` não for encontrado localmente, verifique se o `node_modules/.bin` está presente e se `npm install` terminou sem erro.
 - Antes de gerar o instalador localmente, gere o ícone `.ico` com um destes métodos:

```powershell
# (Opção A) Usar o SVG já presente em `build/icon.svg` (recomendado):
# Requer ImageMagick (local) — o CI já possui o `magick` no runner Windows
magick build\icon.svg -resize 256x256 build\icon.png
npx png-to-ico build\icon.png > build\icon.ico

# (Opção B) Usar o script placeholder que grava um PNG base64 e converte para ICO:
npm run generate-icon
```

 - O workflow do GitHub Actions em `.github/workflows/build.yml` agora:
    - Converte `build/icon.svg` -> `build/icon.png` via ImageMagick no runner (se `icon.svg` existir).
    - Converte `build/icon.png` -> `build/icon.ico` usando `png-to-ico`.
    - Executa `npm run dist` e publica o instalador `.exe` como artefato.
    - Se o workflow for disparado por uma tag (`v*`), ele também cria uma Release e tenta anexar o instalador.
- Para builds assinados (code signing) é necessário configurar certificados — fora do escopo deste conjunto inicial.
- Se quiser distribuir apenas um .zip sem instalador, altere `build.win.target` para `zip`.

Se quiser, eu executo mais passos: criar um ícone genérico, configurar pipeline (GitHub Actions) ou integrar uma UI de instalação personalizada.
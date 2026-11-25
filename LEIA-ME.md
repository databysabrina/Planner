# Meu Planner — como publicar e instalar no Android

> **Já publicou a versão anterior?** Pule para "Atualizações", no fim deste arquivo.

Tempo total: uns 10 minutos. Faça os passos 1 a 3 no computador e o passo 4 no celular.

## 1. Criar o repositório no GitHub
1. Entre em https://github.com e clique em **New** (ou no **+** no canto superior → *New repository*).
2. Em **Repository name**, escreva `planner`.
3. Deixe marcado **Public**. O GitHub Pages gratuito exige isso. Só o código fica público; **suas tarefas e notas ficam apenas no seu celular** e nunca vão para o GitHub.
4. Clique em **Create repository**.

## 2. Enviar os arquivos
1. Descompacte o arquivo `planner.zip` no computador.
2. Na página do repositório recém-criado, clique no link **uploading an existing file**.
3. Abra a pasta descompactada, selecione **tudo o que está dentro dela** (`index.html`, `sw.js`, `manifest.webmanifest`, `LEIA-ME.md` e as pastas `css`, `js` e `icons`) e arraste para a página do GitHub.
   - Arraste o **conteúdo** da pasta, não a pasta `planner` inteira. O `index.html` precisa ficar na raiz do repositório.
4. Espere terminar o envio e clique em **Commit changes**.

## 3. Ligar o GitHub Pages
1. No repositório, vá em **Settings** → **Pages** (menu da esquerda).
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique em **Save**.
4. Espere 1 ou 2 minutos e recarregue a página. Vai aparecer o endereço do app, algo como:
   `https://SEU-USUARIO.github.io/planner/`

## 4. Instalar no celular (Android)
1. Abra esse endereço no **Chrome** do celular.
2. Toque no menu **⋮** (canto superior direito) → **Instalar app** (em alguns aparelhos aparece **Adicionar à tela inicial** → **Instalar**).
3. Pronto: o ícone do Planner aparece na tela inicial e abre em tela cheia, como um app.

> Use sempre o ícone da tela inicial. Os dados ficam guardados dentro do Chrome deste celular.
> Não limpe os "dados do site" do Chrome para esse endereço, porque isso apaga as tarefas.

## Backup (importante)
- Na aba **Hoje**, toque na engrenagem → **Baixar backup agora**. Guarde o arquivo `.json` no Google Drive ou envie para o seu e-mail.
- Para recuperar (celular novo, por exemplo): instale o app e use **Restaurar de um backup**.
- O app avisa na aba Hoje quando faz mais de 14 dias desde o último backup.

## Atualizações (próximas fases)
Quando eu te mandar uma versão nova, repita o **passo 2** (enviar os arquivos novos por cima dos antigos e clicar em *Commit changes*). Seus dados não são apagados. O app se atualiza sozinho na próxima vez que você abrir com internet. Às vezes é preciso fechar e abrir de novo.

### Como atualizar, passo a passo
1. No GitHub, abra o repositório `planner` → **Add file** → **Upload files**.
2. Arraste **todo o conteúdo** da pasta nova (arquivos e as pastas `css`, `js`, `icons`). Os arquivos com o mesmo nome são substituídos.
3. Clique em **Commit changes** e espere 1 ou 2 minutos.
4. No celular, abra o app com internet, feche e abra de novo. Em **Hoje → engrenagem**, o rodapé mostra a versão (agora **1.1**).

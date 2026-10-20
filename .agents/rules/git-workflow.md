---
trigger: always_on
description: Regra para versionamento automático via Git a cada alteração solicitada pelo usuário
---

# Git Workflow Automático

Sempre que você concluir qualquer alteração, correção ou nova funcionalidade solicitada pelo usuário:
1. Valide a compilação rodando `cmd.exe /c "npm run build"`.
2. Adicione os arquivos ao Git com `git add .`.
3. Crie um commit com mensagem clara e objetiva em português resumindo a alteração: `git commit -m "tipo: mensagem"`.
4. Envie as alterações para o repositório remoto: `git push origin main`.

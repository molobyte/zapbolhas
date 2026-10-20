# Diretrizes do Projeto - zapbolhas

## Git Workflow Automático
Sempre que concluir qualquer atualização, correção ou nova funcionalidade solicitada pelo usuário:
1. Valide a compilação com sucesso usando `cmd.exe /c "npm run build"`.
2. Adicione os arquivos modificados ao Git (`git add .`).
3. Crie um commit com mensagem clara e objetiva em português resumindo as alterações (`git commit -m "feat/fix: ..."`).
4. Envie o commit para o repositório remoto (`git push origin main`).

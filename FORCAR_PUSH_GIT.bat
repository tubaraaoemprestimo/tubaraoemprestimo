@echo off
echo ========================================================
echo TENTANDO CORRIGIR O PUSH DO GITHUB...
echo ========================================================
echo.
echo Atualmente voce esta logado como 'jefferson22gs' que nao tem permissao.
echo Vamos mudar a configuracao para forcar o login como 'tubaraaoemprestimo'.
echo.
echo Quando a janela de login abrir, use a conta 'tubaraaoemprestimo'.
echo.

git remote set-url origin https://tubaraaoemprestimo@github.com/tubaraaoemprestimo/tubaraoemprestimo.git

echo Configuração atualizada. Tentando enviar agora...
echo.

git push origin main

echo.
echo Se funcionou, apareceu 'Everything up-to-date' ou similar.
echo Se falhar, voce precisa da SENHA ou TOKEN da conta tubaraaoemprestimo.
echo.
pause

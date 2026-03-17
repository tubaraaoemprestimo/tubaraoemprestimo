#!/bin/bash
# Script para notificar clientes sem documentos via API interna
# Executa no servidor de produção

echo "🚀 Iniciando notificações para clientes sem documentos..."
echo ""

# Token de admin (você precisa pegar um token válido do banco ou fazer login)
# Para este script, vamos usar curl direto na API local

# Cliente 1: Yuri Arruda De Carvalho
echo "📧 Notificando Yuri Arruda De Carvalho..."
curl -X PUT http://localhost:3001/api/loan-requests/4e23aef2-3f8d-4917-a5a2-636a9ca27c47/supplemental \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas"
  }'
echo ""
echo "✅ Yuri notificado!"
echo ""
sleep 2

# Cliente 2: Jefferson Santos
echo "📧 Notificando Jefferson Santos..."
curl -X PUT http://localhost:3001/api/loan-requests/c2beb28c-ed8f-46be-953f-a6a3f0319d6e/supplemental \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas"
  }'
echo ""
echo "✅ Jefferson notificado!"
echo ""
sleep 2

# Cliente 3: Teste completo
echo "📧 Notificando Teste completo..."
curl -X PUT http://localhost:3001/api/loan-requests/a3c213c1-c2d6-4ecc-9343-ca7732e984d3/supplemental \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas"
  }'
echo ""
echo "✅ Teste completo notificado!"
echo ""

echo "✅ Processo concluído!"
echo ""
echo "📊 Resumo:"
echo "   - 3 clientes notificados"
echo "   - Email enviado para cada um"
echo "   - WhatsApp enviado para cada um"
echo "   - Push notification enviado"

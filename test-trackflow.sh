#!/bin/bash

# Script de Teste TrackFlow
# Requer: Token JWT válido do admin

echo "=== TESTE TRACKFLOW APIs ==="
echo ""

# Solicitar token
read -p "Cole o token JWT do admin (faça login em https://www.tubaraoemprestimo.com.br): " TOKEN

if [ -z "$TOKEN" ]; then
    echo "❌ Token não fornecido"
    exit 1
fi

API_URL="https://api.tubaraoemprestimo.com.br"

echo ""
echo "🧪 Teste 1: Consulta CPF"
echo "------------------------"
curl -X POST "$API_URL/trackflow/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apiType":"cpf","queryParams":{"cpf":"12345678900"}}' \
  2>/dev/null | jq '.'

echo ""
echo "🧪 Teste 2: Consulta CNPJ"
echo "------------------------"
curl -X POST "$API_URL/trackflow/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apiType":"cnpj","queryParams":{"cnpj":"33478572000130"}}' \
  2>/dev/null | jq '.'

echo ""
echo "🧪 Teste 3: Consulta Contatos"
echo "------------------------"
curl -X POST "$API_URL/trackflow/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apiType":"contatos","queryParams":{"telefone":"11999998888"}}' \
  2>/dev/null | jq '.'

echo ""
echo "🧪 Teste 4: Consulta Nome/Endereço"
echo "------------------------"
curl -X POST "$API_URL/trackflow/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apiType":"nome-endereco","queryParams":{"nome":"João Silva","uf":"SP"}}' \
  2>/dev/null | jq '.'

echo ""
echo "🧪 Teste 5: Histórico Veicular"
echo "------------------------"
curl -X POST "$API_URL/trackflow/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"apiType":"historico-veicular","queryParams":{"tvalue":"placa","value":"ABC1234"}}' \
  2>/dev/null | jq '.'

echo ""
echo "📊 Histórico de Consultas"
echo "------------------------"
curl -X GET "$API_URL/trackflow/history?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  2>/dev/null | jq '.'

echo ""
echo "✅ Testes concluídos!"

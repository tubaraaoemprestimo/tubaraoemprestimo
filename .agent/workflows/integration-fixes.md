---
description: Plano de integração e correções completas pós-migração
---

# Plano de Implementação — Integração Completa

## 1. ✅ Clientes cadastrados não aparecem para admin
- **Causa**: apiService.getCustomers() busca /customers mas precisa mapear campos Prisma→Frontend
- **Fix**: Verificar mapeamento no backend e frontend

## 2. 📍 Geolocalização funcional
- Capturar localização TODA VEZ que cliente acessar o app
- Salvar no backend (latitude, longitude, cidade, device info)
- Mostrar celular + última localização no admin (mapa)
- Integrar com locationTrackingService.captureAndSave()

## 3. 📧 Emails automáticos em todos processos
- Cadastro → email boas-vindas
- Solicitação enviada → email confirmação
- Aprovação → email (JÁ FEITO)
- Rejeição → email (JÁ FEITO)
- 3 dias antes do vencimento → email lembrete
- No dia do vencimento → email alerta

## 4. 📱 WhatsApp integrado em todos processos
- Mesmos triggers do email + WhatsApp via Evolution API
- Já parcialmente implementado no autoNotificationService

## 5. 🔔 Push Notifications
- Usar Web Push API (VAPID) para notificações
- Push em todos os processos (cadastro, aprovação, vencimento)

## 6. 🛡️ Antifraude 100% funcional
- Bloquear quando >2 dispositivos diferentes
- Capturar localização + IP em cada acesso
- Bloquear atividade suspeita automaticamente
- Logging de todos acessos

## 7. 📋 WhatsApp Status agendado
- Endpoints já existem no backend (whatsappStatus.ts)
- Verificar integração frontend (StatusScheduler.tsx)

## 8. 🎁 Gamificação de Indicações
- Campo de código de indicação no cadastro/wizard
- Pontos para quem indicou
- Descontos automáticos

## 9. ✅ Todos campos obrigatórios
- Validação rigorosa em todos os fluxos do Wizard

## 10. 💰 PIX QR Code
- Admin cadastra chave PIX em configurações
- Sistema gera QR Code PIX para cliente
- Mostrar QR na área do cliente nos dias de pagamento
- Enviar QR por WhatsApp/email

## 11. 📄 Comprovante de pagamento
- Cliente anexa comprovante 
- Admin confirma/rejeita (JÁ EXISTE em finance.ts)

## 12. 🏦 Open Finance
- Pesquisar API oficial Open Finance Brasil
- Implementar consulta se disponível

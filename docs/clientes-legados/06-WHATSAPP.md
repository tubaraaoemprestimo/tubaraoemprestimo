# 06 — WhatsApp

- **Convite:** texto fixo no backend (`inviteText`), só com o primeiro nome. O envio automático só acontece com `LEGACY_WHATSAPP_ENABLED=true` **e** o clique do admin; sem isso, o admin recebe o texto e o link `wa.me` para mandar manualmente. Nada é enviado em massa: um convite por clique.
- **Cobrança:** a mesma régua e os mesmos templates dos clientes atuais. O aviso de 5 dias fica desligado até `COLLECTION_DUE_5_DAYS_ENABLED=true`.
- **Opt-out:** com `whatsapp_opt_out=true`, a régua não manda WhatsApp.
- **Não envia** nada a familiares, empregadores ou referências.
- **Durante os testes** nenhum WhatsApp real foi enviado (flags ausentes; o teste de integração confirma `simulation: true`).

Para ligar depois de homologar, no `.env` do backend coloque `LEGACY_WHATSAPP_ENABLED=true` e/ou `COLLECTION_DUE_5_DAYS_ENABLED=true` e rode `pm2 restart tubarao-backend --update-env`.

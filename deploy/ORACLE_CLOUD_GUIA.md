# Guia Completo: Oracle Cloud Always Free

## Passo a Passo para Criar a VM ARM

### 1. Criar Conta Oracle Cloud
1. Acesse: https://cloud.oracle.com
2. Clique em "Sign Up for Free"
3. Preencha seus dados (precisa de cartao, mas NAO cobra)
4. Selecione a regiao: **sa-saopaulo-1** (Sao Paulo) ou **us-ashburn-1**
5. Aguarde a ativacao (pode levar ate 24h)

### 2. Criar a VM ARM (Always Free)
1. No Console Oracle Cloud, va em: **Compute > Instances > Create Instance**
2. Configure:
   - **Name:** tubarao-backend
   - **Image:** Oracle Linux 8 (ou Ubuntu 22.04)
   - **Shape:** VM.Standard.A1.Flex (ARM - Ampere)
     - OCPU: **4** (maximo free)
     - RAM: **24 GB** (maximo free)
   - **Boot Volume:** 200 GB (maximo free)
   - **VCN:** Crie uma nova VCN ou use existente
   - **Subnet:** Public Subnet
   - **SSH Key:** Cole sua chave publica SSH

3. Clique "Create" e aguarde a VM iniciar

### 3. Configurar Security List (Firewall Oracle)
**IMPORTANTE:** A Oracle Cloud tem firewall proprio alem do iptables.

1. Va em: **Networking > Virtual Cloud Networks > Sua VCN**
2. Clique na **Subnet Publica** > **Security Lists** > **Default Security List**
3. Adicione **Ingress Rules**:

| Source CIDR | Protocol | Port Range | Description |
|-------------|----------|------------|-------------|
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | TCP | 3001 | API (temporario) |
| 0.0.0.0/0 | TCP | 8080 | Evolution API |

### 4. Conectar via SSH
```bash
ssh -i ~/.ssh/sua_chave opc@IP_PUBLICO_DA_VM
```

### 5. Executar Setup
```bash
# Enviar script de setup
scp deploy/setup-oracle-vm.sh opc@IP_PUBLICO:~/

# Executar na VM
ssh opc@IP_PUBLICO 'bash ~/setup-oracle-vm.sh'
```

### 6. Configurar DNS
No Registro.br ou seu provedor DNS:
- Crie um registro **A** para `api.tubaraoemprestimo.com.br` apontando para o **IP Publico da VM**

### 7. Deploy do Backend
```bash
# Na sua maquina local:
./deploy/deploy.sh opc@IP_PUBLICO
```

### 8. Gerar SSL
```bash
# Na VM:
sudo certbot --nginx -d api.tubaraoemprestimo.com.br
```

### 9. Atualizar Frontend (.env)
No Vercel, atualize a variavel de ambiente:
```
VITE_API_URL=https://api.tubaraoemprestimo.com.br/api
```

---

## Recursos Always Free (Permanentes)

| Recurso | Limite Free |
|---------|-------------|
| ARM VM (A1) | 4 OCPU, 24 GB RAM |
| Block Storage | 200 GB total |
| Object Storage | 20 GB |
| Outbound Data | 10 TB/mes |
| Load Balancer | 1 (10 Mbps) |
| ATP Database | 2 DBs, 20 GB cada (NAO usamos) |

---

## Custos Estimados

| Item | Custo |
|------|-------|
| VM ARM 4 OCPU, 24GB | **R$ 0** (Always Free) |
| 200 GB Storage | **R$ 0** (Always Free) |
| 10 TB transferencia | **R$ 0** (Always Free) |
| Dominio .com.br | R$ 40/ano |
| **TOTAL** | **R$ 3,33/mes** |

Comparado com Supabase Pro ($25/mes = ~R$ 150/mes), a economia e de **R$ 147/mes**.

---

## Comandos Uteis

```bash
# Status dos servicos
pm2 status
sudo systemctl status postgresql
sudo systemctl status nginx

# Logs
pm2 logs tubarao-api
sudo tail -f /var/log/nginx/tubarao_error.log

# Backup manual
~/tubarao-backend/backup.sh

# Restart
pm2 restart tubarao-api
sudo systemctl restart nginx
sudo systemctl restart postgresql

# Atualizar SSL
sudo certbot renew

# Monitorar recursos
htop
df -h
free -m
```

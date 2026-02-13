import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../services/prisma';
import { authenticate, generateAccessToken, generateRefreshToken } from '../middleware/auth';
import { emailService } from '../services/email';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { sendPushToRole } from './push';

export const authRouter = Router();

// ============================================
// POST /api/auth/register — Criar conta
// Login fix applied (v2)
// ============================================
authRouter.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name, phone, role, referralCode } = req.body;

        if (!email || !password || !name) {
            res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
            return;
        }

        // Verifica se email já existe
        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            res.status(400).json({ error: 'Este email já está cadastrado' });
            return;
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 12);

        // Em produção pós-migração, ativamos conta imediatamente
        // para manter compatibilidade com o fluxo atual do app.
        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: role || 'CLIENT',
                phone: phone || null,
                authId: null
            }
        });

        // Garante cliente vinculado para aparecer em Clientes/Acessos/Antifraude
        if ((user.role || 'CLIENT') === 'CLIENT') {
            try {
                const existingCustomer = await prisma.customer.findFirst({ where: { OR: [{ userId: user.id }, { email: user.email }] } });
                let customerId = existingCustomer?.id;

                if (!existingCustomer) {
                    const refCode = `${user.name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
                    const newCustomer = await prisma.customer.create({
                        data: {
                            userId: user.id,
                            name: user.name,
                            email: user.email,
                            phone: user.phone || '',
                            cpf: `REG_${user.id.substring(0, 8)}_${Date.now().toString().slice(-4)}`,
                            status: 'ACTIVE',
                            source: 'MANUAL',
                            referralCode: refCode
                        }
                    });
                    customerId = newCustomer.id;

                    // Notify Admins about new client via WhatsApp + Email + Push
                    try {
                        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
                        for (const admin of admins) {
                            if (admin.phone) {
                                await sendWhatsAppMessage(admin.phone, `🦈 *Novo Cliente Cadastrado!*\nNome: ${user.name}\nEmail: ${user.email}\nTelefone: ${user.phone || 'Não informado'}\nData: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
                            }
                            // Notificação interna para admin
                            await prisma.notification.create({
                                data: {
                                    title: '👤 Novo Cliente Cadastrado',
                                    message: `${user.name} (${user.email}) acabou de se cadastrar na plataforma.`,
                                    type: 'INFO'
                                }
                            }).catch(() => {});
                        }
                    } catch (e) { console.error('Error notifying admins:', e); }
                } else {
                    await prisma.customer.update({
                        where: { id: existingCustomer.id },
                        data: { userId: user.id }
                    });
                }

                // Handle Referral Code if provided
                if (referralCode && customerId) {
                    try {
                        const referrer = await prisma.customer.findFirst({
                            where: { referralCode: referralCode }
                        });

                        if (referrer) {
                            await prisma.referral.create({
                                data: {
                                    referrerCustomerId: referrer.id,
                                    referrerCode: referralCode,
                                    referredCustomerId: customerId,
                                    referredName: user.name,
                                    referredPhone: user.phone || '',
                                    status: 'PENDING'
                                }
                            });
                            // Notificar quem indicou
                            if (referrer.phone) {
                                await sendWhatsAppMessage(referrer.phone,
                                    `🎉 *Indicação recebida!*\n\n${user.name} se cadastrou usando seu código de indicação!\n\nQuando o empréstimo for aprovado, você receberá pontos e bônus. 🦈`
                                );
                            }
                            if (referrer.email) {
                                await emailService.send(referrer.email, '🎉 Alguém usou seu código de indicação!',
                                    `<div style="font-family:Arial;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
                                    <h1 style="color:#D4AF37;text-align:center;">🦈 Tubarão Empréstimos</h1>
                                    <h2 style="color:#4CAF50;">Nova Indicação!</h2>
                                    <p style="color:#ccc;">${user.name} se cadastrou usando seu código <strong style="color:#D4AF37;">${referralCode}</strong>.</p>
                                    <p style="color:#ccc;">Quando o empréstimo for aprovado, você receberá pontos e bônus!</p>
                                    </div>`
                                );
                            }
                        }
                    } catch (refErr) {
                        console.error('Failed to process referral:', refErr);
                    }
                }

            } catch (err) {
                console.error('Failed to link customer in register:', err);
            }
        }

        // ====== EMAIL DE BOAS-VINDAS ======
        try {
            await emailService.send(user.email, '🦈 Bem-vindo ao Tubarão Empréstimos!',
                `<div style="font-family:Arial;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
                <div style="text-align:center;margin-bottom:20px;">
                    <h1 style="color:#D4AF37;font-size:28px;">🦈 Tubarão Empréstimos</h1>
                </div>
                <h2 style="color:#fff;">Olá, ${user.name}! 👋</h2>
                <p style="color:#ccc;font-size:16px;line-height:1.6;">
                    Sua conta foi criada com sucesso! Agora você pode solicitar empréstimos, acompanhar pagamentos e muito mais.
                </p>
                <div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                    <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Email:</strong> ${user.email}</p>
                    <p style="margin:5px 0;color:#ccc;"><strong style="color:#D4AF37;">Telefone:</strong> ${user.phone || 'Não informado'}</p>
                </div>
                <div style="text-align:center;margin:25px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background:#D4AF37;color:#000;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">Acessar Plataforma</a>
                </div>
                <hr style="border-color:#333;margin:20px 0;" />
                <p style="color:#666;font-size:12px;text-align:center;">Tubarão Empréstimos — Plataforma de Crédito Premium</p>
                </div>`
            );
        } catch (emailErr) {
            console.error('Welcome email failed:', emailErr);
        }

        // Push notification para admins
        sendPushToRole('ADMIN', '👤 Novo Cliente', `${user.name} acabou de se cadastrar`).catch(() => {});

        // WhatsApp de boas-vindas
        if (phone) {
            try {
                const cleanPhone = phone.replace(/\D/g, '');
                await sendWhatsAppMessage(cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`,
                    `🦈 *Bem-vindo ao Tubarão Empréstimos!*\n\nOlá, ${user.name}! Sua conta foi criada com sucesso.\n\nAcesse a plataforma para solicitar empréstimos e serviços:\nhttps://www.tubaraoemprestimo.com.br\n\n_Tubarão Empréstimos — Crédito Premium_`
                );
            } catch (waErr) {
                console.error('Welcome WhatsApp failed:', waErr);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Erro ao criar conta' });
    }
});

// ============================================
// POST /api/auth/login — Login
// ============================================
authRouter.post('/login', async (req: Request, res: Response) => {
    try {
        const { identifier, email: emailFromBody, password } = req.body;
        const rawIdentifier = String(identifier || emailFromBody || '').trim();

        if (!rawIdentifier || !password) {
            res.status(400).json({ error: 'Email e senha são obrigatórios' });
            return;
        }

        // Busca user por email
        const email = rawIdentifier.toLowerCase();
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        // Verifica senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        // Backfill de customer para contas antigas migradas sem registro em customers
        if ((user.role || '').toUpperCase() === 'CLIENT') {
            try {
                const existingCustomer = await prisma.customer.findFirst({ where: { OR: [{ userId: user.id }, { email: user.email }] } });
                if (!existingCustomer) {
                    await prisma.customer.create({
                        data: {
                            userId: user.id,
                            name: user.name,
                            email: user.email,
                            phone: user.phone || '',
                            // Fix: Add random suffix
                            cpf: `MIG_${user.id.substring(0, 8)}_${Date.now().toString().slice(-4)}`,
                            status: 'ACTIVE',
                            source: 'MANUAL'
                        }
                    });
                } else if (!existingCustomer.userId || existingCustomer.userId !== user.id) {
                    // Link correct userId if missing or different
                    await prisma.customer.update({ where: { id: existingCustomer.id }, data: { userId: user.id } });
                }
            } catch (err) {
                console.error('Failed to backfill customer in login:', err);
                // Continue login even if backfill fails
            }
        }

        // Gera tokens
        const authUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        const accessToken = generateAccessToken(authUser);
        const refreshToken = generateRefreshToken(authUser);

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                avatarUrl: user.avatarUrl
            },
            accessToken,
            refreshToken
        });

    } catch (error: any) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// ============================================
// POST /api/auth/confirm-email — Confirmar email
// ============================================
authRouter.post('/confirm-email', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            res.status(400).json({ error: 'Token de confirmação não fornecido' });
            return;
        }

        // Busca user com esse token
        const user = await prisma.user.findFirst({
            where: { authId: token }
        });

        if (!user) {
            res.status(400).json({ error: 'Token inválido ou já utilizado' });
            return;
        }

        // Marca como confirmado (limpa authId)
        await prisma.user.update({
            where: { id: user.id },
            data: { authId: null }
        });

        // Cria customer associado automaticamente
        const existingCustomer = await prisma.customer.findFirst({
            where: { email: user.email }
        });

        if (!existingCustomer) {
            await prisma.customer.create({
                data: {
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || '',
                    cpf: `AUTO_${user.id.substring(0, 8)}`,
                    status: 'ACTIVE'
                }
            });
        }

        res.json({ success: true, message: 'Email confirmado com sucesso!' });

    } catch (error: any) {
        console.error('[Auth] Confirm email error:', error);
        res.status(500).json({ error: 'Erro ao confirmar email' });
    }
});

// ============================================
// POST /api/auth/forgot-password — Solicitar reset
// ============================================
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email é obrigatório' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        // Sempre retorna sucesso (segurança — não revela se email existe)
        if (!user) {
            res.json({ success: true, message: 'Se o email existir, enviaremos um link de recuperação.' });
            return;
        }

        // Gera token de reset (expira em 1h)
        const resetToken = jwt.sign(
            { userId: user.id, type: 'password_reset' },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '1h' }
        );

        // Envia email
        await emailService.sendPasswordReset(user.email, user.name, resetToken);

        res.json({ success: true, message: 'Se o email existir, enviaremos um link de recuperação.' });

    } catch (error: any) {
        console.error('[Auth] Forgot password error:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
});

// ============================================
// POST /api/auth/reset-password — Redefinir senha
// ============================================
authRouter.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
            return;
        }

        // Verifica token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'default-secret'
        ) as { userId: string; type: string };

        if (decoded.type !== 'password_reset') {
            res.status(400).json({ error: 'Token inválido' });
            return;
        }

        // Atualiza senha
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { password: hashedPassword }
        });

        res.json({ success: true, message: 'Senha redefinida com sucesso!' });

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(400).json({ error: 'Link expirado. Solicite um novo.' });
            return;
        }
        console.error('[Auth] Reset password error:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
});

// ============================================
// PUT /api/auth/change-password — Alterar senha (logado)
// ============================================
authRouter.put('/change-password', authenticate, async (req: Request, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        const validOld = await bcrypt.compare(oldPassword, user.password);
        if (!validOld) {
            res.status(400).json({ error: 'Senha atual incorreta' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ success: true });

    } catch (error: any) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// ============================================
// POST /api/auth/refresh — Renovar token
// ============================================
authRouter.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Refresh token é obrigatório' });
            return;
        }

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET || 'default-refresh-secret'
        ) as { id: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, name: true, role: true }
        });

        if (!user) {
            res.status(401).json({ error: 'Usuário não encontrado' });
            return;
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

    } catch (error: any) {
        res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }
});

// ============================================
// GET /api/auth/me — Dados do usuário logado
// ============================================
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: {
                id: true, name: true, email: true, role: true,
                phone: true, avatarUrl: true, address: true,
                city: true, neighborhood: true, createdAt: true
            }
        });

        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }

        res.json({ user });

    } catch (error: any) {
        console.error('[Auth] Me error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// ============================================
// PUT /api/auth/avatar — Atualizar avatar
// ============================================
authRouter.put('/avatar', authenticate, async (req: Request, res: Response) => {
    try {
        const { avatarUrl } = req.body;

        await prisma.user.update({
            where: { id: req.user!.id },
            data: { avatarUrl }
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao atualizar avatar' });
    }
});

// ============================================
// PUT /api/auth/me — Atualizar dados do perfil
// ============================================
authRouter.put('/me', authenticate, async (req: Request, res: Response) => {
    try {
        const { avatarUrl, name, phone, address, city, neighborhood } = req.body;
        const data: any = {};
        if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
        if (name !== undefined) data.name = name;
        if (phone !== undefined) data.phone = phone;
        if (address !== undefined) data.address = address;
        if (city !== undefined) data.city = city;
        if (neighborhood !== undefined) data.neighborhood = neighborhood;

        await prisma.user.update({ where: { id: req.user!.id }, data });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// ============================================
// PUT /api/auth/update-password — Alterar senha
// ============================================
authRouter.put('/update-password', authenticate, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
            return;
        }
        const bcryptjs = require('bcryptjs');
        const hashedPassword = await bcryptjs.hash(password, 12);
        await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashedPassword } });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao atualizar senha' });
    }
});

// ============================================
// GET /api/auth/managed-access — Verificar acesso gerenciado
// ============================================
authRouter.get('/managed-access', async (req: Request, res: Response) => {
    try {
        const email = (req.query.email as string || '').toLowerCase().trim();
        if (!email) { res.json({ hasAccess: false }); return; }
        const user = await prisma.user.findFirst({ where: { email } });
        res.json({ hasAccess: !!user });
    } catch {
        res.json({ hasAccess: false });
    }
});

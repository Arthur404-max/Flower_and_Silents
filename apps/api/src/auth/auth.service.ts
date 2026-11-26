import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'argon2';
import type { AdminRequest } from './admin-auth.guard';
import { hashToken } from '../common/domain';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ChangePasswordDto, LoginDto } from './dto';
import { TokenService, type AdminIdentity } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  async login(dto: LoginDto, ip: string): Promise<{ user: AdminIdentity; accessToken: string; refreshToken: string; csrfToken: string }> {
    const email = dto.email.toLowerCase();
    const rateKey = `auth:login:${ip}:${email}`;
    if (!(await this.redis.rateLimit(rateKey, 5, 900))) {
      throw new UnauthorizedException('Слишком много попыток входа. Повторите через 15 минут');
    }
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    const valid = user?.isActive && (await verify(user.passwordHash, dto.password).catch(() => false));
    if (!user || !valid) throw new UnauthorizedException('Неверная почта или пароль');
    await this.redis.deleteKey(rateKey);
    const refreshToken = this.tokens.createRefreshToken();
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    await this.prisma.adminAuditLog.create({ data: { adminId: user.id, action: 'LOGIN', entity: 'AdminUser', entityId: user.id } });
    const identity = { id: user.id, email: user.email, name: user.name };
    return {
      user: identity,
      accessToken: await this.tokens.signAccess(identity),
      refreshToken,
      csrfToken: this.tokens.createCsrfToken(),
    };
  }

  async refresh(refreshToken: string | undefined): Promise<{ user: AdminIdentity; accessToken: string; refreshToken: string; csrfToken: string }> {
    if (!refreshToken) throw new UnauthorizedException('Сессия истекла');
    const tokenHash = hashToken(refreshToken);
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!existing || existing.revokedAt || existing.expiresAt <= new Date() || !existing.user.isActive) {
        throw new UnauthorizedException('Сессия истекла');
      }
      const revoked = await tx.refreshToken.deleteMany({ where: { id: existing.id, revokedAt: null } });
      if (revoked.count !== 1) throw new UnauthorizedException('Сессия уже использована');
      const nextToken = this.tokens.createRefreshToken();
      await tx.refreshToken.create({
        data: { userId: existing.userId, tokenHash: hashToken(nextToken), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      });
      return {
        user: { id: existing.user.id, email: existing.user.email, name: existing.user.name },
        refreshToken: nextToken,
      };
    });
    return { ...result, accessToken: await this.tokens.signAccess(result.user), csrfToken: this.tokens.createCsrfToken() };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(request: AdminRequest, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: request.admin.id } });
    if (!(await verify(user.passwordHash, dto.currentPassword).catch(() => false))) {
      throw new UnauthorizedException('Текущий пароль неверен');
    }
    if (dto.currentPassword === dto.newPassword) throw new ConflictException('Новый пароль должен отличаться');
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(dto.newPassword) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.adminAuditLog.create({ data: { adminId: user.id, action: 'CHANGE_PASSWORD', entity: 'AdminUser', entityId: user.id } }),
    ]);
  }
}

async function hashPassword(password: string): Promise<string> {
  const argon2 = await import('argon2');
  return argon2.hash(password, { type: argon2.argon2id });
}

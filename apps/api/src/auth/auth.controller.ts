import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AdminAuthGuard, type AdminRequest } from './admin-auth.guard';
import { AdminMutationGuard } from './admin-mutation.guard';
import { ChangePasswordDto, LoginDto } from './dto';
import { AppConfigService } from '../common/app-config.service';
import { TokenService } from './token.service';

@Controller('api/v1/admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto, request.ip ?? 'unknown');
    this.setSession(response, result.accessToken, result.refreshToken, result.csrfToken);
    return { user: result.user, csrfToken: result.csrfToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.ct_refresh);
    this.setSession(response, result.accessToken, result.refreshToken, result.csrfToken);
    return { user: result.user, csrfToken: result.csrfToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.ct_refresh);
    response.clearCookie('ct_access', this.cookieOptions('/'));
    response.clearCookie('ct_refresh', this.cookieOptions('/api/v1/admin/auth'));
    response.clearCookie('ct_csrf', this.cookieOptions('/'));
  }

  @Get('me')
  @UseGuards(AdminAuthGuard, AdminMutationGuard)
  me(@Req() request: AdminRequest, @Res({ passthrough: true }) response: Response) {
    const csrfToken = this.tokens.createCsrfToken();
    response.cookie('ct_csrf', csrfToken, this.cookieOptions('/'));
    return { user: request.admin, csrfToken };
  }

  @Post('change-password')
  @HttpCode(204)
  @UseGuards(AdminAuthGuard, AdminMutationGuard)
  async changePassword(@Req() request: AdminRequest, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    await this.auth.changePassword(request, dto);
    response.clearCookie('ct_refresh', this.cookieOptions('/api/v1/admin/auth'));
  }

  private setSession(response: Response, accessToken: string, refreshToken: string, csrfToken: string): void {
    response.cookie('ct_access', accessToken, this.cookieOptions('/', 15 * 60));
    response.cookie('ct_refresh', refreshToken, this.cookieOptions('/api/v1/admin/auth', 7 * 86_400));
    response.cookie('ct_csrf', csrfToken, this.cookieOptions('/', 7 * 86_400));
  }

  private cookieOptions(path: string, maxAge?: number): CookieOptions {
    return {
      httpOnly: path !== '/',
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path,
      ...(maxAge ? { maxAge: maxAge * 1000 } : {}),
    };
  }
}

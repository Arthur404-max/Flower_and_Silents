import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminMutationGuard } from './admin-mutation.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, AdminAuthGuard, AdminMutationGuard],
  exports: [TokenService, AdminAuthGuard, AdminMutationGuard],
})
export class AuthModule {}

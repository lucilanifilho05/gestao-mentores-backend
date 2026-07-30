import { Module } from '@nestjs/common';
import {
  APP_GUARD,
} from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PapeisGuard } from './guards/papeis.guard';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PapeisGuard,
    },
  ],
  exports: [
    AuthService,
  ],
})
export class AuthModule {}
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveService } from './google-drive.service';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    GoogleDriveController,
  ],

  providers: [
    GoogleDriveService,
  ],

  exports: [
    GoogleDriveService,
  ],
})
export class GoogleDriveModule {}
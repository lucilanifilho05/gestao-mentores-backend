import { Module } from '@nestjs/common';

import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    PrismaModule,
    GoogleDriveModule,
  ],

  controllers: [
    TasksController,
  ],

  providers: [
    TasksService,
  ],

  exports: [
    TasksService,
  ],
})
export class TasksModule {}
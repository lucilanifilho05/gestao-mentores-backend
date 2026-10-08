import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';

@Module({
  imports: [PrismaModule, GoogleCalendarModule],

  controllers: [TasksController],

  providers: [TasksService],

  exports: [TasksService],
})
export class TasksModule {}

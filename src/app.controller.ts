import { Controller, Get } from '@nestjs/common';

import { Publico } from './common/decorators/publico.decorator';
import { AppService } from './app.service';

@Publico()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
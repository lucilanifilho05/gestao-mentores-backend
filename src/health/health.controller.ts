import { Controller, Get } from '@nestjs/common';

import { Publico } from '../common/decorators/publico.decorator';
import { HealthService } from './health.service';

@Publico()
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
  ) {}

  @Get()
  check() {
    return this.healthService.check();
  }
}
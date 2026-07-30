import { Test, type TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  const healthServiceMock = {
    verificar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [
          HealthController,
        ],
        providers: [
          {
            provide: HealthService,
            useValue: healthServiceMock,
          },
        ],
      }).compile();

    controller =
      module.get<HealthController>(
        HealthController,
      );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
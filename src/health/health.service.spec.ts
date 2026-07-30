import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const prismaServiceMock = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          HealthService,
          {
            provide: PrismaService,
            useValue: prismaServiceMock,
          },
        ],
      }).compile();

    service =
      module.get<HealthService>(
        HealthService,
      );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
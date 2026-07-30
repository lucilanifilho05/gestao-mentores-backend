import { Module } from '@nestjs/common';

import { AcademicService } from './academic.service';
import { ModulosController } from './modulos.controller';
import { TurmasController } from './turmas.controller';
import { UnidadesCurricularesController } from './unidades-curriculares.controller';

@Module({
  controllers: [
    TurmasController,
    ModulosController,
    UnidadesCurricularesController,
  ],
  providers: [
    AcademicService,
  ],
  exports: [
    AcademicService,
  ],
})
export class AcademicModule {}
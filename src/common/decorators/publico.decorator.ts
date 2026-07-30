import { SetMetadata } from '@nestjs/common';

export const PUBLICO_KEY = 'rotaPublica';

export const Publico = () =>
  SetMetadata(PUBLICO_KEY, true);
import { SetMetadata } from '@nestjs/common';

import type { Papel } from '../../generated/prisma/client';

export const PAPEIS_KEY = 'papeisPermitidos';

export const Papeis = (...papeis: Papel[]) =>
  SetMetadata(PAPEIS_KEY, papeis);
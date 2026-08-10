import type {
  INestApplication,
} from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

export function configurarSwagger(
  app: INestApplication,
): void {
  const configuracao =
    new DocumentBuilder()
      .setTitle(
        'Gestão de Mentores API',
      )
      .setDescription(
        'API de gestão acadêmica, mentores, tarefas, links e relatórios.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Informe somente o accessToken retornado pelo login.',
        },
        'access-token',
      )
      .build();

  const documento =
    SwaggerModule.createDocument(
      app,
      configuracao,
    );

  SwaggerModule.setup(
    'docs',
    app,
    documento,
    {
      customSiteTitle:
        'Gestão de Mentores API',

      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    },
  );
}

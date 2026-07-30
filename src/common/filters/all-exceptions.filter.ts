import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type {
  Request,
  Response,
} from 'express';

interface ErroNormalizado {
  statusCode: number;
  error: string;
  message: string | string[];
}

interface ErroComCodigo {
  code?: unknown;
  message?: unknown;
  stack?: unknown;
}

@Catch()
export class AllExceptionsFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(
    AllExceptionsFilter.name,
  );

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ): void {
    const contexto =
      host.switchToHttp();

    const request =
      contexto.getRequest<Request>();

    const response =
      contexto.getResponse<Response>();

    const erro =
      this.normalizarErro(exception);

    if (
      erro.statusCode >=
      HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      this.logger.error(
        `${request.method} ${
          request.originalUrl ??
          request.url
        } -> ${erro.statusCode}`,
        exception instanceof Error
          ? exception.stack
          : String(exception),
      );
    }

    response
      .status(erro.statusCode)
      .json({
        statusCode:
          erro.statusCode,

        error:
          erro.error,

        message:
          erro.message,

        timestamp:
          new Date().toISOString(),

        path:
          request.originalUrl ??
          request.url,

        method:
          request.method,
      });
  }

  private normalizarErro(
    exception: unknown,
  ): ErroNormalizado {
    if (
      exception instanceof
      HttpException
    ) {
      return this.normalizarHttpException(
        exception,
      );
    }

    const code =
      this.obterCodigo(exception);

    switch (code) {
      case 'P2002':
        return {
          statusCode:
            HttpStatus.CONFLICT,
          error: 'Conflict',
          message:
            'Já existe um registro com esses dados.',
        };

      case 'P2003':
        return {
          statusCode:
            HttpStatus.CONFLICT,
          error: 'Conflict',
          message:
            'A operação viola um vínculo existente.',
        };

      case 'P2025':
        return {
          statusCode:
            HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message:
            'Registro não encontrado.',
        };

      case 'P2023':
        return {
          statusCode:
            HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message:
            'Identificador ou valor inválido.',
        };

      case 'LIMIT_FILE_SIZE':
        return {
          statusCode:
            HttpStatus.PAYLOAD_TOO_LARGE,
          error:
            'Payload Too Large',
          message:
            'O arquivo ultrapassa o limite permitido.',
        };

      case 'LIMIT_UNEXPECTED_FILE':
        return {
          statusCode:
            HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message:
            'Campo de arquivo inesperado.',
        };

      default:
        return {
          statusCode:
            HttpStatus
              .INTERNAL_SERVER_ERROR,

          error:
            'Internal Server Error',

          message:
            'Ocorreu um erro interno no servidor.',
        };
    }
  }

  private normalizarHttpException(
    exception: HttpException,
  ): ErroNormalizado {
    const statusCode =
      exception.getStatus();

    const resposta =
      exception.getResponse();

    if (
      typeof resposta === 'string'
    ) {
      return {
        statusCode,
        error:
          this.nomeDaExcecao(
            exception,
          ),
        message: resposta,
      };
    }

    const objeto =
      resposta as Record<
        string,
        unknown
      >;

    const message =
      this.extrairMensagem(
        objeto.message,
        exception.message,
      );

    const error =
      typeof objeto.error ===
      'string'
        ? objeto.error
        : this.nomeDaExcecao(
            exception,
          );

    return {
      statusCode,
      error,
      message,
    };
  }

  private extrairMensagem(
    valor: unknown,
    padrao: string,
  ): string | string[] {
    if (
      typeof valor === 'string'
    ) {
      return valor;
    }

    if (
      Array.isArray(valor) &&
      valor.every(
        (item) =>
          typeof item === 'string',
      )
    ) {
      return valor as string[];
    }

    return padrao;
  }

  private obterCodigo(
    exception: unknown,
  ): string | undefined {
    if (
      typeof exception !==
        'object' ||
      exception === null
    ) {
      return undefined;
    }

    const codigo =
      (
        exception as ErroComCodigo
      ).code;

    return typeof codigo ===
      'string'
      ? codigo
      : undefined;
  }

  private nomeDaExcecao(
    exception: HttpException,
  ): string {
    return exception.name
      .replace(
        /Exception$/,
        '',
      )
      .replace(
        /([a-z])([A-Z])/g,
        '$1 $2',
      );
  }
}
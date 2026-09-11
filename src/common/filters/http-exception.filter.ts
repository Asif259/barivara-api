import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ErrorCode, getLocalizedMessage } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const lang =
      (request.query?.lang as string) ||
      request.headers['accept-language'] ||
      'bn';
    const isEn = lang.toLowerCase().startsWith('en');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCode.INTERNAL_ERROR;
    let message: string = getLocalizedMessage(ErrorCode.INTERNAL_ERROR, lang);
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        errorCode = resObj.errorCode || this.mapStatusToErrorCode(status);
        message =
          resObj.message ||
          getLocalizedMessage(errorCode, lang);

        if (Array.isArray(resObj.message)) {
          // Validation pipe error array
          details = resObj.message;
          errorCode = ErrorCode.VALIDATION_ERROR;
          message = isEn ? 'Request validation failed.' : 'অনুরোধের তথ্যে ভুল রয়েছে।';
        } else if (resObj.details) {
          details = resObj.details;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaErr = exception as Prisma.PrismaClientKnownRequestError;
      if (prismaErr.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        errorCode = ErrorCode.DUPLICATE_RESOURCE;
        message = getLocalizedMessage(ErrorCode.DUPLICATE_RESOURCE, lang);
        // Only expose the field name, not the full constraint target
        const target = (prismaErr.meta as { target?: unknown } | undefined)?.target;
        details = { field: target };
      } else if (prismaErr.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        errorCode = ErrorCode.RESOURCE_NOT_FOUND;
        message = getLocalizedMessage(ErrorCode.RESOURCE_NOT_FOUND, lang);
      } else if (prismaErr.code === 'P2003') {
        // Foreign-key constraint: safe to tell client it's a validation issue,
        // but never expose which table/column triggered it.
        status = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.VALIDATION_ERROR;
        message = isEn ? 'Invalid reference: the specified resource does not exist.' : 'অবৈধ রেফারেন্স: নির্দিষ্ট তথ্য বিদ্যমান নেই।';
      } else {
        // All other Prisma errors — return generic 500, no DB details exposed
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = ErrorCode.INTERNAL_ERROR;
        message = getLocalizedMessage(ErrorCode.INTERNAL_ERROR, lang);
        this.logger.error(`Unhandled Prisma error [${prismaErr.code}]`, prismaErr.stack);
      }
    } else if (exception instanceof Error) {
      // Never echo exception.message — it may contain internal paths, connection strings, etc.
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      // message stays as the generic INTERNAL_ERROR default set at the top
    }

    response.status(status).json({
      success: false,
      message,
      errorCode,
      details,
    });
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.DUPLICATE_RESOURCE;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}

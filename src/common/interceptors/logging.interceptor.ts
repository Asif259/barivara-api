import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, path } = req;
    const user = (req as any).user;
    const userId = user?.id || 'anonymous';
    const startTime = Date.now();
    const requestId = randomUUID();
    (req as any).requestId = requestId;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            requestId,
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
            userId,
          }),
        );
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        const statusCode =
          err instanceof HttpException
            ? err.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            requestId,
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
            userId,
            error: true,
          }),
        );
        return throwError(() => err);
      }),
    );
  }
}

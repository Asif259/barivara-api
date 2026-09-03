import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DecimalUtil } from '../utils/decimal.util';
import { Request } from 'express';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((resData) => {
        const httpCtx = context.switchToHttp();
        const request = httpCtx.getRequest<Request>();
        const response = httpCtx.getResponse();

        if (response.getHeader('Content-Type')?.toString().includes('text/csv')) {
          return resData;
        }

        const lang =
          (request.query?.lang as string) ||
          request.headers['accept-language'] ||
          'bn';
        const isEn = lang.toLowerCase().startsWith('en');

        let message = isEn ? 'Operation successful' : 'অপারেশন সফল হয়েছে';
        let data = resData;
        let meta: any = undefined;

        if (resData && typeof resData === 'object') {
          if ('data' in resData && ('meta' in resData || 'message' in resData)) {
            data = resData.data;
            meta = resData.meta;
            if (resData.message) {
              message = resData.message;
            }
          } else if (resData.message && !resData.data) {
            message = resData.message;
            data = resData.data !== undefined ? resData.data : {};
          }
        }

        // Clean any Decimal instances into numbers for clean JSON serialization
        const cleanedData = DecimalUtil.transformDecimals(data);

        const result: Response<T> = {
          success: true,
          message,
          data: cleanedData,
        };

        if (meta !== undefined) {
          result.meta = meta;
        }

        return result;
      }),
    );
  }
}

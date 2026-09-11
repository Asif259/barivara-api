import { HttpStatus, BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../constants/error-codes';

/**
 * Build a minimal mock ArgumentsHost that captures the response JSON.
 */
function buildMockHost(): { host: ArgumentsHost; getJson: () => any; getStatus: () => number } {
  let capturedJson: any = null;
  let capturedStatus: number = 0;

  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockImplementation((body) => {
      capturedJson = body;
    }),
  };

  const request = {
    query: {},
    headers: {},
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  // Track what status was actually set
  response.status.mockImplementation((s: number) => {
    capturedStatus = s;
    return response;
  });

  return {
    host,
    getJson: () => capturedJson,
    getStatus: () => capturedStatus,
  };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  describe('HttpException variants', () => {
    it('should return 400 with VALIDATION_ERROR for BadRequestException (string)', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(new BadRequestException('bad input'), host);

      expect(getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(getJson().success).toBe(false);
      expect(getJson().errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should return 400 with details array for ValidationPipe error', () => {
      const { host, getJson, getStatus } = buildMockHost();
      const exception = new BadRequestException({
        message: ['name must not be empty', 'phone must be valid'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, host);

      expect(getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(getJson().errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(Array.isArray(getJson().details)).toBe(true);
      expect(getJson().details).toContain('name must not be empty');
    });

    it('should return 401 with AUTH_UNAUTHORIZED for UnauthorizedException', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(
        new UnauthorizedException({ errorCode: ErrorCode.AUTH_UNAUTHORIZED, message: 'please login' }),
        host,
      );

      expect(getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(getJson().success).toBe(false);
      expect(getJson().errorCode).toBe(ErrorCode.AUTH_UNAUTHORIZED);
    });

    it('should return 401 with AUTH_TOKEN_EXPIRED for expired token error', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(
        new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_EXPIRED, message: 'session expired' }),
        host,
      );

      expect(getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(getJson().errorCode).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
    });

    it('should return 403 with AUTH_FORBIDDEN for ForbiddenException', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(
        new ForbiddenException({ errorCode: ErrorCode.AUTH_FORBIDDEN, message: 'forbidden' }),
        host,
      );

      expect(getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(getJson().errorCode).toBe(ErrorCode.AUTH_FORBIDDEN);
    });

    it('should return 404 with RESOURCE_NOT_FOUND for NotFoundException', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(
        new NotFoundException({ errorCode: ErrorCode.TENANT_NOT_FOUND, message: 'not found' }),
        host,
      );

      expect(getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(getJson().errorCode).toBe(ErrorCode.TENANT_NOT_FOUND);
    });

    it('should return 409 with DUPLICATE_RESOURCE for ConflictException', () => {
      const { host, getJson, getStatus } = buildMockHost();
      filter.catch(
        new ConflictException({ errorCode: ErrorCode.DUPLICATE_RESOURCE, message: 'duplicate' }),
        host,
      );

      expect(getStatus()).toBe(HttpStatus.CONFLICT);
      expect(getJson().errorCode).toBe(ErrorCode.DUPLICATE_RESOURCE);
    });
  });

  describe('Prisma error mapping', () => {
    it('should map P2002 to 409 DUPLICATE_RESOURCE without exposing constraint details', () => {
      const { host, getJson, getStatus } = buildMockHost();
      const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      filter.catch(prismaErr, host);

      expect(getStatus()).toBe(HttpStatus.CONFLICT);
      expect(getJson().errorCode).toBe(ErrorCode.DUPLICATE_RESOURCE);
      // Should expose field but not full internal constraint path
      expect(getJson().details).toHaveProperty('field');
      // Should NOT expose raw Prisma code
      expect(JSON.stringify(getJson())).not.toContain('P2002');
    });

    it('should map P2025 to 404 RESOURCE_NOT_FOUND', () => {
      const { host, getJson, getStatus } = buildMockHost();
      const prismaErr = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      filter.catch(prismaErr, host);

      expect(getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(getJson().errorCode).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should map P2003 (FK violation) to 400 VALIDATION_ERROR without leaking DB code', () => {
      const { host, getJson, getStatus } = buildMockHost();
      const prismaErr = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: 'propertyId' },
      });

      filter.catch(prismaErr, host);

      expect(getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(getJson().errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      // Must NOT expose Prisma code or field name
      expect(JSON.stringify(getJson())).not.toContain('P2003');
      expect(JSON.stringify(getJson())).not.toContain('propertyId');
    });

    it('should map unknown Prisma errors to 500 INTERNAL_ERROR without leaking code', () => {
      const { host, getJson, getStatus } = buildMockHost();
      const prismaErr = new Prisma.PrismaClientKnownRequestError('Some other error', {
        code: 'P9999',
        clientVersion: '5.0.0',
      });

      filter.catch(prismaErr, host);

      expect(getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(getJson().errorCode).toBe(ErrorCode.INTERNAL_ERROR);
      // Must NOT expose internal Prisma error code
      expect(JSON.stringify(getJson())).not.toContain('P9999');
    });
  });

  describe('Unhandled Error', () => {
    it('should return 500 INTERNAL_ERROR and never echo exception.message to client', () => {
      const { host, getJson, getStatus } = buildMockHost();
      // Simulate an error that might contain sensitive internal information
      const sensitiveError = new Error('connection refused at postgresql://user:secret@db-host:5432/prod');

      filter.catch(sensitiveError, host);

      expect(getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(getJson().errorCode).toBe(ErrorCode.INTERNAL_ERROR);
      expect(getJson().success).toBe(false);
      // The sensitive message must NOT be in the response
      expect(JSON.stringify(getJson())).not.toContain('secret');
      expect(JSON.stringify(getJson())).not.toContain('postgresql://');
    });
  });

  describe('Response structure', () => {
    it('all error responses must have { success: false, errorCode, message, details }', () => {
      const exceptions = [
        new BadRequestException('bad'),
        new UnauthorizedException('unauth'),
        new ForbiddenException('forbidden'),
        new NotFoundException('not found'),
        new ConflictException('conflict'),
      ];

      for (const exception of exceptions) {
        const { host, getJson } = buildMockHost();
        filter.catch(exception, host);
        const json = getJson();
        expect(json).toHaveProperty('success', false);
        expect(json).toHaveProperty('errorCode');
        expect(json).toHaveProperty('message');
        expect(json).toHaveProperty('details');
      }
    });
  });
});

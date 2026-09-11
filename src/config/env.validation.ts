import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Declarative environment-variable schema.
 *
 * Required in ALL environments:
 *   NODE_ENV, PORT
 *
 * Required outside the `test` environment (dev + prod):
 *   DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional (safe defaults provided by configuration.ts):
 *   JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN,
 *   FRONTEND_URL, MOBILE_APP_SCHEME,
 *   MAX_IMAGE_SIZE_MB, MAX_DOCUMENT_SIZE_MB, LOG_LEVEL
 */
export class EnvironmentVariables {
  // ── Always required ──────────────────────────────────────────────────────

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  // ── Required outside test (dev + prod) ───────────────────────────────────

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV !== Environment.Test)
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV !== Environment.Test)
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV !== Environment.Test)
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV !== Environment.Test)
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV !== Environment.Test)
  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  // ── Optional — configuration.ts provides safe defaults ───────────────────

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL: string;

  @IsOptional()
  @IsString()
  MOBILE_APP_SCHEME: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  MAX_IMAGE_SIZE_MB: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  MAX_DOCUMENT_SIZE_MB: number;

  @IsOptional()
  @IsString()
  LOG_LEVEL: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    // Surface constraint violations without exposing secret values —
    // only property names and constraint names are included.
    const messages = errors.map((e) => Object.keys(e.constraints ?? {}).join(', ')
      ? `${e.property}: ${Object.keys(e.constraints ?? {}).join(', ')}`
      : e.property,
    );
    throw new Error(`Environment validation failed:\n  ${messages.join('\n  ')}`);
  }

  return validated;
}

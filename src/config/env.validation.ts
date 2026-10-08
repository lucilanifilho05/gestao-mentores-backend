import * as Joi from 'joi';

const JWT_SECRET_MIN_LENGTH = 64;

export const envValidationSchema = Joi.object({
  GOOGLE_CALENDAR_ENABLED: Joi.boolean().default(false),
  GOOGLE_CLIENT_ID: Joi.string().when('GOOGLE_CALENDAR_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().when('GOOGLE_CALENDAR_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  GOOGLE_TOKEN_ENCRYPTION_KEY: Joi.string().when('GOOGLE_CALENDAR_ENABLED', {
    is: true,
    then: Joi.string()
      .pattern(/^[a-fA-F0-9]{64}$/)
      .required(),
    otherwise: Joi.allow(''),
  }),
  GOOGLE_REDIRECT_URI: Joi.string().when('GOOGLE_CALENDAR_ENABLED', {
    is: true,
    then: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .when('NODE_ENV', {
        is: 'production',
        then: Joi.string().uri({ scheme: ['https'] }),
      })
      .required(),
    otherwise: Joi.allow(''),
  }),
  GOOGLE_FRONTEND_URL: Joi.string().when('GOOGLE_CALENDAR_ENABLED', {
    is: true,
    then: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .when('NODE_ENV', {
        is: 'production',
        then: Joi.string().uri({ scheme: ['https'] }),
      })
      .required(),
    otherwise: Joi.allow(''),
  }),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  CORS_ORIGINS: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:5173'),
    }),

  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgresql', 'postgres'],
    })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(JWT_SECRET_MIN_LENGTH).required(),

  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),

  JWT_REFRESH_SECRET: Joi.string().min(JWT_SECRET_MIN_LENGTH).required(),

  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(604800),

  JWT_ISSUER: Joi.string().trim().min(3).max(100).required(),

  JWT_AUDIENCE: Joi.string().trim().min(3).max(100).required(),

  SWAGGER_ENABLED: Joi.boolean().default(false),
});

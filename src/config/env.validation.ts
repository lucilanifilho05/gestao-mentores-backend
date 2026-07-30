import * as Joi from 'joi';

const JWT_SECRET_MIN_LENGTH = 64;

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number()
    .port()
    .default(3000),

  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgresql', 'postgres'],
    })
    .required(),

  JWT_ACCESS_SECRET: Joi.string()
    .min(JWT_SECRET_MIN_LENGTH)
    .required(),

  JWT_ACCESS_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(900),

  JWT_REFRESH_SECRET: Joi.string()
    .min(JWT_SECRET_MIN_LENGTH)
    .required(),

  JWT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(604800),

  JWT_ISSUER: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required(),

  JWT_AUDIENCE: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),

  GOOGLE_CLIENT_SECRET: Joi.string().required(),

  GOOGLE_REDIRECT_URI: Joi.string()
    .uri()
    .required(),

  GOOGLE_OAUTH_STATE_SECRET: Joi.string()
    .min(64)
    .required(),

  DRIVE_TOKEN_ENCRYPTION_KEY: Joi.string()
    .base64()
    .required(),

  GOOGLE_DRIVE_FOLDER_ID: Joi.string()
    .allow('')
    .optional(),
  SWAGGER_ENABLED:
    Joi.boolean()
    .default(false),
});
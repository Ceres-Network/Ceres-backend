import type { Request, Response, NextFunction } from 'express';
import { API_CONFIG } from '@ceres/shared/constants';
import { ApiError } from './errorHandler';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];

  if (!API_CONFIG.API_KEY) {
    // API key not configured, skip validation
    return next();
  }

  if (!apiKey || apiKey !== API_CONFIG.API_KEY) {
    return next(new ApiError(401, 'Invalid or missing API key'));
  }

  next();
}

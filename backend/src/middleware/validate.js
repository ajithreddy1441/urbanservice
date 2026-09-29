import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export function validate(rules) {
  return async (req, res, next) => {
    await Promise.all(rules.map((rule) => rule.run(req)));
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return next(new ApiError(422, 'Please check the highlighted fields', 'VALIDATION_ERROR', result.array()));
    }
    return next();
  };
}

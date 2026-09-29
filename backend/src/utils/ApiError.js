export class ApiError extends Error {
  constructor(status, message, errorCode = 'ERROR', errors = null) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
  }
}

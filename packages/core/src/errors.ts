export class ZerithValidationError<T> extends Error {
  constructor(
    message: string,
    public zodError?: T
  ) {
    super(message);
    this.name = "ZerithValidationError";
  }
}

export enum ErrorCode {
  DB_WRITE_FAILED = "DB_WRITE_FAILED",
  DB_READ_FAILED = "DB_READ_FAILED",
  DB_DELETE_FAILED = "DB_DELETE_FAILED",
  DB_INIT_FAILED = "DB_INIT_FAILED",
  AUTH_KEY_NOT_FOUND = "AUTH_KEY_NOT_FOUND",
  AUTH_SIGN_FAILED = "AUTH_SIGN_FAILED",
  AUTH_VERIFY_FAILED = "AUTH_VERIFY_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NETWORK_SIGNALING_FAILED = "NETWORK_SIGNALING_FAILED",
  SDK_NOT_INITIALIZED = "SDK_NOT_INITIALIZED",
  SDK_INVALID_CONFIG = "SDK_INVALID_CONFIG",
}

export class ZerithDBError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public cause?: unknown,
    public details?: unknown
  ) {
    super(message);
    this.name = "ZerithDBError";
  }
}
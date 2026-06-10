export type AutoredLookupErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_PATENT"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR";

export class AutoredLookupError extends Error {
  code: AutoredLookupErrorCode;
  status: number;

  constructor(code: AutoredLookupErrorCode, message: string, status: number) {
    super(message);
    this.name = "AutoredLookupError";
    this.code = code;
    this.status = status;
  }
}

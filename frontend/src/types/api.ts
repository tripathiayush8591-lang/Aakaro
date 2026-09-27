export interface ConnectionResult {
  summary: string;
  possibleAudience: string;
  clarifyingQuestion: string;
}
export interface ApiFailure {
  code: string;
  message: string;
  retryable: boolean;
}
export interface Success<T> {
  requestId: string;
  data: T;
}

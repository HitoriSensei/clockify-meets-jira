/**
 * Exception thrown when a target publish request is aborted in excepted cases.
 */
export class AbortException extends Error {
  constructor(reason: string) {
    super(reason);
  }
}

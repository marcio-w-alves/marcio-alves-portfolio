/**
 * A failure the owner is meant to read: its message is the whole report, so
 * the command prints it and stops, without a stack trace. Anything else that
 * escapes a command is a defect, and a defect deserves its stack.
 */
export class ReportedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

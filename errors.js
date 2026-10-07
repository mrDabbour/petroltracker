export class AppError extends Error {
  constructor(status,code,message,action='') {
    super(message); this.status=status; this.code=code; this.action=action;
  }
}

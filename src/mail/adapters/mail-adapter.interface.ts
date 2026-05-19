export interface SendMailOpts {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const MAIL_ADAPTER = Symbol('MAIL_ADAPTER');

export interface IMailAdapter {
  /** Called on module init — should throw if the transport is misconfigured. */
  verify(): Promise<void>;
  /** Send a single email. Implementations decide what to do on failure. */
  send(opts: SendMailOpts): Promise<void>;
}

import { button, divider, escapeHtml, renderLayout, summaryRow, type RenderedEmail } from './layout';

export interface InvoiceEmailInput {
  clientName: string;
  invoiceNumber: string;
  invoiceTitle?: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  amountPaid?: number;
  amountDue: number;
  currencySymbol?: string;
  /** URL to view and pay the invoice */
  viewUrl: string;
  /** The construction company issuing the invoice */
  senderCompanyName: string;
  paymentTerms?: string;
  notes?: string;
  brandName?: string;
  appUrl?: string;
}

function fmt(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderInvoiceEmail(input: InvoiceEmailInput): RenderedEmail {
  const {
    clientName,
    invoiceNumber,
    invoiceTitle,
    issueDate,
    dueDate,
    subtotal,
    taxAmount = 0,
    discountAmount = 0,
    total,
    amountPaid = 0,
    amountDue,
    currencySymbol = '$',
    viewUrl,
    senderCompanyName,
    paymentTerms,
    notes,
    brandName = 'ownit2buildit',
    appUrl,
  } = input;

  const isFullyPaid = amountDue <= 0;
  const subject = isFullyPaid
    ? `Receipt for ${invoiceNumber} — ${senderCompanyName}`
    : `Invoice ${invoiceNumber} from ${senderCompanyName} — ${fmt(amountDue, currencySymbol)} due`;

  const statusBadge = isFullyPaid
    ? `<span style="display:inline-block;padding:3px 10px;background-color:#D1FAE5;color:#065F46;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Paid</span>`
    : `<span style="display:inline-block;padding:3px 10px;background-color:#FEF3C7;color:#92400E;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Payment due</span>`;

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Invoice from ${escapeHtml(senderCompanyName)}
      &nbsp;${statusBadge}
    </h1>
    ${invoiceTitle ? `<p style="margin:0 0 24px;font-size:15px;color:#776560;">${escapeHtml(invoiceTitle)}</p>` : '<p style="margin:0 0 24px;"></p>'}

    <!-- Meta strip -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 24px;background-color:#F7F3F0;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Invoice</span>&nbsp;
                <span style="font-size:14px;font-weight:600;color:#19130F;">${escapeHtml(invoiceNumber)}</span>
              </td>
              <td style="padding:4px 0;text-align:right;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Issued</span>&nbsp;
                <span style="font-size:14px;color:#19130F;">${escapeHtml(issueDate)}</span>
              </td>
            </tr>
            ${dueDate ? `
            <tr>
              <td colspan="2" style="padding:4px 0;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Due date</span>&nbsp;
                <span style="font-size:14px;color:${isFullyPaid ? '#19130F' : '#7C3018'};font-weight:600;">${escapeHtml(dueDate)}</span>
              </td>
            </tr>` : ''}
            ${paymentTerms ? `
            <tr>
              <td colspan="2" style="padding:4px 0;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Terms</span>&nbsp;
                <span style="font-size:14px;color:#19130F;">${escapeHtml(paymentTerms)}</span>
              </td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#3D2D27;">
      Dear ${escapeHtml(clientName)},
    </p>
    <p style="margin:0 0 20px;color:#3D2D27;">
      ${isFullyPaid
        ? `Thank you — payment has been received in full. Please find your receipt details below.`
        : `Please find your invoice details below. You can view and pay securely online using the button below.`}
    </p>

    <!-- Amount box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 24px;border:1px solid #DDD6CF;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${summaryRow('Subtotal', fmt(subtotal, currencySymbol))}
            ${discountAmount > 0 ? summaryRow('Discount', `− ${fmt(discountAmount, currencySymbol)}`) : ''}
            ${taxAmount > 0 ? summaryRow('Tax', fmt(taxAmount, currencySymbol)) : ''}
            ${summaryRow('Invoice total', fmt(total, currencySymbol), true, true)}
            ${amountPaid > 0 ? summaryRow('Amount paid', `− ${fmt(amountPaid, currencySymbol)}`) : ''}
            ${amountDue > 0 ? summaryRow('Amount due', fmt(amountDue, currencySymbol), true, amountPaid > 0) : ''}
          </table>
        </td>
      </tr>
    </table>

    ${!isFullyPaid
      ? button('View Invoice & Pay', viewUrl)
      : button('View Receipt', viewUrl, true)}

    ${notes ? `
    ${divider()}
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#19130F;">Notes from ${escapeHtml(senderCompanyName)}:</p>
    <p style="margin:0;font-size:13px;color:#776560;line-height:1.6;">${escapeHtml(notes)}</p>
    ` : ''}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9A8E89;">
      This invoice was prepared by <strong style="color:#776560;">${escapeHtml(senderCompanyName)}</strong> and
      delivered via ${escapeHtml(brandName)}.
      If you have any questions, please contact them directly.
    </p>
  `;

  const html = renderLayout({
    preheader: isFullyPaid
      ? `Receipt for invoice ${invoiceNumber} — fully paid. Thank you!`
      : `Invoice ${invoiceNumber} from ${senderCompanyName} — ${fmt(amountDue, currencySymbol)} due${dueDate ? ` by ${dueDate}` : ''}.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Invoice ${invoiceNumber} from ${senderCompanyName}`,
    invoiceTitle ?? '',
    ``,
    `Dear ${clientName},`,
    ``,
    isFullyPaid
      ? `Payment received in full. Thank you!`
      : `Please pay ${fmt(amountDue, currencySymbol)} by ${dueDate ?? 'your agreed due date'}.`,
    ``,
    `Invoice no.  : ${invoiceNumber}`,
    `Issued       : ${issueDate}`,
    dueDate ? `Due date     : ${dueDate}` : '',
    paymentTerms ? `Terms        : ${paymentTerms}` : '',
    ``,
    `Subtotal     : ${fmt(subtotal, currencySymbol)}`,
    discountAmount > 0 ? `Discount     : −${fmt(discountAmount, currencySymbol)}` : '',
    taxAmount > 0 ? `Tax          : ${fmt(taxAmount, currencySymbol)}` : '',
    `Invoice total: ${fmt(total, currencySymbol)}`,
    amountPaid > 0 ? `Amount paid  : ${fmt(amountPaid, currencySymbol)}` : '',
    amountDue > 0 ? `AMOUNT DUE   : ${fmt(amountDue, currencySymbol)}` : 'STATUS       : Paid in full',
    ``,
    `View online: ${viewUrl}`,
    notes ? `\nNotes:\n${notes}` : '',
    ``,
    `— ${senderCompanyName} via ${brandName}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

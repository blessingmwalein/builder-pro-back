import { button, divider, escapeHtml, renderLayout, summaryRow, type RenderedEmail } from './layout';

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteEmailInput {
  /** Client's display name */
  clientName: string;
  /** e.g. Q-0042 */
  quoteNumber: string;
  /** Quote title / project title */
  quoteTitle: string;
  issueDate: string;
  expiryDate?: string;
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  currencySymbol?: string;
  /** URL to view/accept the quote in the client portal */
  viewUrl: string;
  /** The construction company sending the quote */
  senderCompanyName: string;
  lineItems?: QuoteLineItem[];
  notes?: string;
  brandName?: string;
  appUrl?: string;
}

function fmt(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderQuoteEmail(input: QuoteEmailInput): RenderedEmail {
  const {
    clientName,
    quoteNumber,
    quoteTitle,
    issueDate,
    expiryDate,
    subtotal,
    taxAmount = 0,
    discountAmount = 0,
    total,
    currencySymbol = '$',
    viewUrl,
    senderCompanyName,
    lineItems = [],
    notes,
    brandName = 'ownit2buildit',
    appUrl,
  } = input;

  const subject = `Quote ${quoteNumber} from ${senderCompanyName} — ${quoteTitle}`;

  const lineItemsHtml = lineItems.length > 0 ? `
    <!-- Line items table -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 16px;border:1px solid #DDD6CF;border-radius:8px;overflow:hidden;font-size:13px;">
      <!-- Heading row -->
      <tr style="background-color:#F7F3F0;">
        <td style="padding:10px 14px;font-weight:700;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Description</td>
        <td style="padding:10px 14px;font-weight:700;color:#776560;text-align:center;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Qty</td>
        <td style="padding:10px 14px;font-weight:700;color:#776560;text-align:right;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Unit</td>
        <td style="padding:10px 14px;font-weight:700;color:#776560;text-align:right;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Total</td>
      </tr>
      ${lineItems.map((li, i) => `
      <tr style="background-color:${i % 2 === 0 ? '#FFFFFF' : '#FDFAF8'};">
        <td style="padding:10px 14px;color:#19130F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(li.description)}</td>
        <td style="padding:10px 14px;color:#776560;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${li.quantity}</td>
        <td style="padding:10px 14px;color:#776560;text-align:right;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${fmt(li.unitPrice, currencySymbol)}</td>
        <td style="padding:10px 14px;color:#19130F;font-weight:600;text-align:right;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${fmt(li.total, currencySymbol)}</td>
      </tr>`).join('')}
    </table>
  ` : '';

  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#19130F;letter-spacing:-0.02em;">
      Quote from ${escapeHtml(senderCompanyName)}
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#776560;">${escapeHtml(quoteTitle)}</p>

    <!-- Meta strip -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 24px;background-color:#F7F3F0;border-radius:8px;padding:0;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Quote</span>&nbsp;
                <span style="font-size:14px;font-weight:600;color:#19130F;">${escapeHtml(quoteNumber)}</span>
              </td>
              <td style="padding:4px 0;text-align:right;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Issued</span>&nbsp;
                <span style="font-size:14px;color:#19130F;">${escapeHtml(issueDate)}</span>
              </td>
            </tr>
            ${expiryDate ? `
            <tr>
              <td colspan="2" style="padding:4px 0;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#776560;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Valid until</span>&nbsp;
                <span style="font-size:14px;color:#7C3018;font-weight:600;">${escapeHtml(expiryDate)}</span>
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
      Please find your quote attached below. Click the button to review the full details and accept online.
    </p>

    ${lineItemsHtml}

    <!-- Totals summary -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 24px;border:1px solid #DDD6CF;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${summaryRow('Subtotal', fmt(subtotal, currencySymbol))}
            ${discountAmount > 0 ? summaryRow('Discount', `− ${fmt(discountAmount, currencySymbol)}`) : ''}
            ${taxAmount > 0 ? summaryRow('Tax', fmt(taxAmount, currencySymbol)) : ''}
            ${summaryRow('Total', fmt(total, currencySymbol), true, true)}
          </table>
        </td>
      </tr>
    </table>

    ${button('View & Accept Quote', viewUrl)}

    ${notes ? `
    ${divider()}
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#19130F;">Notes from ${escapeHtml(senderCompanyName)}:</p>
    <p style="margin:0;font-size:13px;color:#776560;line-height:1.6;">${escapeHtml(notes)}</p>
    ` : ''}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9A8E89;">
      This quote was prepared by <strong style="color:#776560;">${escapeHtml(senderCompanyName)}</strong> and
      delivered via ${escapeHtml(brandName)}.
      If you have any questions, please contact them directly.
    </p>
  `;

  const html = renderLayout({
    preheader: `${senderCompanyName} sent you a quote for ${quoteTitle} — total ${fmt(total, currencySymbol)}.`,
    title: subject,
    body,
    brandName,
    appUrl,
  });

  const text = [
    `Quote ${quoteNumber} from ${senderCompanyName}`,
    `${quoteTitle}`,
    ``,
    `Dear ${clientName},`,
    ``,
    `Please find your quote details below.`,
    ``,
    `Quote number : ${quoteNumber}`,
    `Issued       : ${issueDate}`,
    expiryDate ? `Valid until  : ${expiryDate}` : '',
    ``,
    ...(lineItems.length > 0 ? [
      'Line items:',
      ...lineItems.map((li) => `  ${li.description}  ×${li.quantity}  ${fmt(li.unitPrice, currencySymbol)}  = ${fmt(li.total, currencySymbol)}`),
      '',
    ] : []),
    `Subtotal : ${fmt(subtotal, currencySymbol)}`,
    discountAmount > 0 ? `Discount : −${fmt(discountAmount, currencySymbol)}` : '',
    taxAmount > 0 ? `Tax      : ${fmt(taxAmount, currencySymbol)}` : '',
    `TOTAL    : ${fmt(total, currencySymbol)}`,
    ``,
    `View & accept the quote online: ${viewUrl}`,
    notes ? `\nNotes:\n${notes}` : '',
    ``,
    `— ${senderCompanyName} via ${brandName}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

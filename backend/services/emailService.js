/**
 * WeaveMind Email Service v4
 * ──────────────────────────
 * Rich HTML emails sent to BOTH admin + relevant party on every event.
 * Events: new order, payment reminder, payment overdue, low stock,
 *         maintenance alert, quality alert, job completed, new supplier.
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

const ADMIN   = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
const FACTORY = process.env.FACTORY_NAME || 'WeaveMind Factory';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM    = `"${FACTORY}" <${process.env.SMTP_USER}>`;

// ── Core send helper ─────────────────────────────────────────────────────────
async function send({ to, cc, bcc, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS ||
      process.env.SMTP_USER === 'your_gmail@gmail.com') {
    console.log(`[EMAIL MOCK] To:${to}${cc?' CC:'+cc:''} | ${subject}`);
    return { mocked: true, to, subject };
  }
  try {
    const opts = { from: FROM, to, subject, html };
    if (cc)  opts.cc  = cc;
    if (bcc) opts.bcc = bcc;
    const info = await transporter.sendMail(opts);
    console.log(`✉️  Sent → ${to}${cc?' CC:'+cc:''} | ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed → ${to}: ${err.message}`);
    return { error: err.message };
  }
}

// ── Master HTML template ──────────────────────────────────────────────────────
function tpl({ icon, color, title, subtitle, rows = [], body = '', cta, footer = '', sections = [] }) {
  const rowsHtml = rows.map(([l, v, c]) => `
    <tr>
      <td style="padding:11px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #1a2537;width:38%;vertical-align:top">${l}</td>
      <td style="padding:11px 20px;font-size:13px;border-bottom:1px solid #1a2537;font-weight:600;color:${c || '#e2e8f0'}">${v}</td>
    </tr>`).join('');

  const sectionsHtml = sections.map(s => `
    <div style="margin:16px 20px 0;background:#0a1120;border-radius:10px;border:1px solid #1a2537;padding:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin-bottom:10px;font-weight:700">${s.title}</div>
      ${s.content}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#060912;font-family:'Segoe UI',Arial,sans-serif}
  a{color:${color};text-decoration:none}
  @media(max-width:600px){.container{padding:12px!important}.card{margin:0!important}}
</style>
</head>
<body>
<div class="container" style="max-width:600px;margin:0 auto;padding:20px 16px">

  <!-- Logo bar -->
  <div style="text-align:center;padding:16px 0 20px">
    <div style="display:inline-flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;background:${color};border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:18px">🧵</div>
      <span style="font-size:16px;font-weight:800;letter-spacing:0.1em;color:#e2e8f0;font-family:Arial,sans-serif">${FACTORY.toUpperCase()}</span>
    </div>
  </div>

  <!-- Main card -->
  <div class="card" style="background:#0d1424;border:1px solid #1a2537;border-radius:16px;overflow:hidden;margin:0 4px">

    <!-- Accent top bar -->
    <div style="height:4px;background:linear-gradient(90deg,${color},${color}88,transparent)"></div>

    <!-- Header -->
    <div style="padding:28px 20px 20px;background:linear-gradient(135deg,#0f1a2e 0%,#0d1424 100%)">
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="width:52px;height:52px;background:${color}18;border:1px solid ${color}33;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${icon}</div>
        <div>
          <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#e2e8f0">${title}</h1>
          ${subtitle ? `<p style="margin:0;font-size:13px;color:#64748b">${subtitle}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- Data rows -->
    ${rows.length ? `<table style="width:100%;border-collapse:collapse">${rowsHtml}</table>` : ''}

    <!-- Body text -->
    ${body ? `<div style="padding:16px 20px;color:#94a3b8;font-size:13px;line-height:1.8">${body}</div>` : ''}

    <!-- Extra sections -->
    ${sectionsHtml}

    <!-- CTA -->
    ${cta ? `<div style="padding:20px"><a href="${cta.url}" style="display:inline-block;padding:13px 28px;background:${color};color:#000;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.03em">${cta.label} →</a></div>` : ''}
  </div>

  <!-- Footer -->
  <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <span style="color:#1e3a5f;font-size:11px">${FACTORY} · Automated Notification</span>
    <span style="color:#1e3a5f;font-size:11px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
  </div>
  ${footer ? `<div style="text-align:center;padding-bottom:16px;color:#1e3a5f;font-size:11px">${footer}</div>` : ''}
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NEW ORDER — sent to ADMIN + CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
exports.notifyNewOrder = async ({ order }) => {
  const amount = (order.totalAmount || 0).toLocaleString('en-IN');
  const deadline = order.deadline ? new Date(order.deadline).toLocaleDateString('en-IN') : 'To be confirmed';
  const orderUrl = APP_URL + '/orders';

  // ── Admin email ──────────────────────────────────────────────────────────────
  const adminHtml = tpl({
    icon: '📋', color: '#00d4ff',
    title: 'New Order Received',
    subtitle: `From ${order.clientName} · ${new Date().toLocaleDateString('en-IN')}`,
    rows: [
      ['Order ID',        order.orderId,          '#00d4ff'],
      ['Client Name',     order.clientName,        '#e2e8f0'],
      ['Client Email',    order.clientEmail || 'Not provided', '#94a3b8'],
      ['Fabric Type',     order.fabricType,        '#e2e8f0'],
      ['Quantity',        order.totalMeters + ' meters', '#e2e8f0'],
      ['Order Amount',    '₹' + amount,            '#00e676'],
      ['Payment Status',  order.paymentStatus,     '#ffd32a'],
      ['Delivery Date',   deadline,                '#e2e8f0'],
      ['Current Status',  order.status,            '#ffd32a'],
    ],
    sections: [{
      title: 'Action Required',
      content: `<p style="margin:0;font-size:13px;color:#94a3b8">Assign this order to a production job and schedule machines. Check inventory levels for <strong style="color:#e2e8f0">${order.fabricType}</strong> before starting.</p>`
    }],
    cta: { label: 'Open Order in Dashboard', url: orderUrl },
    footer: 'This notification was sent automatically when a new order was created.'
  });

  await send({
    to: ADMIN,
    subject: `📋 New Order #${order.orderId} — ${order.clientName} | ₹${amount}`,
    html: adminHtml
  });

  // ── Client confirmation email ─────────────────────────────────────────────
  if (order.clientEmail) {
    const progressBar = `
      <div style="margin:12px 0 4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          ${['Received','In Production','Quality Check','Dispatched','Delivered'].map((s, i) => `
            <div style="text-align:center;flex:1">
              <div style="width:24px;height:24px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
                background:${i === 0 ? '#00d4ff' : '#1a2537'};color:${i === 0 ? '#000' : '#475569'}">
                ${i === 0 ? '✓' : i + 1}
              </div>
              <div style="font-size:9px;color:${i === 0 ? '#00d4ff' : '#334155'};font-weight:${i === 0 ? '700' : '400'}">${s}</div>
            </div>`).join('')}
        </div>
        <div style="height:3px;background:#1a2537;border-radius:2px;position:relative">
          <div style="height:100%;width:5%;background:#00d4ff;border-radius:2px"></div>
        </div>
      </div>`;

    const clientHtml = tpl({
      icon: '✅', color: '#00e676',
      title: 'Order Confirmed!',
      subtitle: `${FACTORY} has received your order`,
      rows: [
        ['Order Reference', order.orderId,          '#00d4ff'],
        ['Product',         order.fabricType,        '#e2e8f0'],
        ['Quantity',        order.totalMeters + ' meters', '#e2e8f0'],
        ['Order Value',     '₹' + amount,            '#00e676'],
        ['Payment Status',  order.paymentStatus,     order.paymentStatus === 'Paid' ? '#00e676' : '#ffd32a'],
        ['Expected By',     deadline,                '#e2e8f0'],
      ],
      body: `Dear ${order.clientName},<br><br>
        Thank you for your order. We are pleased to confirm that we have received it and it is now in our production queue.<br><br>
        You will receive updates as your order moves through each stage of production. For any questions or changes, please contact us by replying to this email.<br><br>
        <em style="color:#475569">Please keep your Order Reference <strong style="color:#00d4ff">${order.orderId}</strong> handy for all communications.</em>`,
      sections: [{
        title: 'Order Progress',
        content: progressBar
      }],
      cta: { label: 'Track Your Order', url: orderUrl },
      footer: `Questions? Reply to this email or contact ${ADMIN}`
    });

    await send({
      to: order.clientEmail,
      cc: ADMIN,
      subject: `✅ Order Confirmed — #${order.orderId} | ${FACTORY}`,
      html: clientHtml
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PAYMENT REMINDER — to admin + supplier with full context
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendSupplierPaymentReminder = async ({ supplier, ledgerEntry, daysOverdue, dueDate }) => {
  const amount = (ledgerEntry.amount || 0).toLocaleString('en-IN');
  const urgColor = daysOverdue > 14 ? '#ff4757' : daysOverdue > 7 ? '#ff6b35' : '#ffd32a';
  const urgLabel = daysOverdue > 14 ? 'CRITICAL OVERDUE' : daysOverdue > 7 ? 'HIGH PRIORITY' : daysOverdue > 3 ? 'OVERDUE' : 'PAYMENT DUE';

  // ── Admin email with full context ──────────────────────────────────────────
  const adminHtml = tpl({
    icon: '💸', color: urgColor,
    title: `Payment ${urgLabel}`,
    subtitle: `${supplier.name} · ${daysOverdue} days past due`,
    rows: [
      ['Supplier',      supplier.name,                 '#e2e8f0'],
      ['Contact Email', supplier.email || 'Not set',  '#94a3b8'],
      ['Description',   ledgerEntry.description,       '#e2e8f0'],
      ['Category',      ledgerEntry.category || 'N/A', '#e2e8f0'],
      ['Amount Due',    '₹' + amount,                  urgColor],
      ['Due Date',      new Date(dueDate).toLocaleDateString('en-IN'), '#e2e8f0'],
      ['Days Overdue',  daysOverdue + ' days',          urgColor],
      ['Priority',      urgLabel,                       urgColor],
    ],
    sections: [
      {
        title: 'Recommended Action',
        content: `
          <ul style="margin:0;padding:0 0 0 16px;color:#94a3b8;font-size:13px;line-height:2">
            <li>${daysOverdue > 7 ? 'Call supplier immediately — ' + (supplier.email || 'no email on file') : 'Send formal payment reminder'}</li>
            <li>Verify if goods/services were received satisfactorily</li>
            <li>Process payment or arrange payment plan</li>
            <li>Update ledger status once paid</li>
          </ul>`
      },
      supplier.email ? {
        title: 'Email Sent To Supplier',
        content: `<p style="margin:0;font-size:13px;color:#00e676">✓ Reminder email also sent to <strong>${supplier.email}</strong> with CC to admin.</p>`
      } : {
        title: 'No Supplier Email',
        content: `<p style="margin:0;font-size:13px;color:#ffd32a">⚠ No email on file for this supplier. Add their email in Supplier Management to enable auto-reminders.</p>`
      }
    ],
    cta: { label: 'View in Payments Dashboard', url: APP_URL + '/payments' },
    footer: 'Auto-reminder runs daily at 8am. Sent every 3 days until paid.'
  });

  await send({
    to: ADMIN,
    subject: `⚠️ ${urgLabel} — ${supplier.name} | ₹${amount} | ${daysOverdue}d late`,
    html: adminHtml
  });

  // ── Supplier reminder email ────────────────────────────────────────────────
  if (supplier.email) {
    const supplierHtml = tpl({
      icon: '💰', color: '#ffd32a',
      title: 'Payment Reminder',
      subtitle: `From ${FACTORY}`,
      rows: [
        ['Reference',     ledgerEntry.description,    '#e2e8f0'],
        ['Amount Due',    '₹' + amount,               '#ffd32a'],
        ['Original Due',  new Date(dueDate).toLocaleDateString('en-IN'), '#e2e8f0'],
        ['Days Overdue',  daysOverdue + ' days',       '#ff4757'],
        ['Urgency',       urgLabel,                    urgColor],
      ],
      body: `Dear ${supplier.name},<br><br>
        This is a <strong style="color:${urgColor}">${daysOverdue > 7 ? 'FINAL' : 'friendly'} reminder</strong> that the following payment from ${FACTORY} is currently <strong style="color:#ff4757">${daysOverdue} day(s) overdue</strong>.<br><br>
        ${daysOverdue > 14
          ? `<span style="color:#ff4757;font-weight:700">⚠️ This account is now critically overdue. Failure to pay may result in disruption to our business relationship and further escalation.</span><br><br>`
          : ''}
        Please process the payment at your earliest convenience. Once payment is made, kindly send confirmation to <a href="mailto:${ADMIN}">${ADMIN}</a> so we can update our records.<br><br>
        If there is a dispute or you have already made this payment, please contact us immediately by replying to this email.`,
      sections: [{
        title: 'How to Pay',
        content: `<p style="margin:0;font-size:13px;color:#94a3b8">Contact our accounts team at <a href="mailto:${ADMIN}" style="color:#ffd32a">${ADMIN}</a> to arrange payment. Please quote the reference: <strong style="color:#e2e8f0">${ledgerEntry.description}</strong></p>`
      }],
      cta: { label: 'Reply to Factory', url: 'mailto:' + ADMIN + '?subject=Re: Payment - ' + encodeURIComponent(ledgerEntry.description) },
      footer: `${FACTORY} · This is an automated reminder. Please do not ignore this notice.`
    });

    await send({
      to: supplier.email,
      cc: ADMIN,
      subject: `Payment Reminder — ₹${amount} Overdue | ${FACTORY}`,
      html: supplierHtml
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NEW INVENTORY ITEM — admin notification
// ═══════════════════════════════════════════════════════════════════════════════
exports.notifyNewInventory = async ({ item, addedBy }) => {
  await send({
    to: ADMIN,
    subject: `📦 New Item Added — ${item.itemName} | Barcode: ${item.barcode}`,
    html: tpl({
      icon: '📦', color: '#f59e0b',
      title: 'New Inventory Item Added',
      subtitle: item.itemName,
      rows: [
        ['Item Name',   item.itemName,                 '#e2e8f0'],
        ['Barcode',     item.barcode,                  '#00d4ff'],
        ['Vendor',      item.vendorName || '—',        '#e2e8f0'],
        ['Stock Level', `${item.stockLevel} ${item.unit}`, '#00e676'],
        ['Location',    item.location,                 '#e2e8f0'],
        ['Added By',    addedBy || 'System',           '#e2e8f0'],
      ],
      cta: { label: 'View Inventory', url: APP_URL + '/inventory' }
    })
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. LOW STOCK ALERT — admin + best supplier
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendLowStockAlert = async ({ item, supplier }) => {
  if (supplier?.email) {
    await send({
      to: supplier.email,
      cc: ADMIN,
      subject: `📦 Urgent Stock Request — ${item.itemName} | ${FACTORY}`,
      html: tpl({
        icon: '📦', color: '#00d4ff',
        title: 'Urgent Stock Request',
        subtitle: `From ${FACTORY}`,
        rows: [
          ['Material',         item.itemName,           '#e2e8f0'],
          ['Current Stock',    `${item.stockLevel} ${item.unit}`, '#ff4757'],
          ['Min. Required',    `${item.reorderPoint} ${item.unit}`, '#ffd32a'],
          ['Request Type',     'URGENT REORDER',        '#ff4757'],
          ['Supplier Score',   supplier.reliabilityScore + '%', '#00e676'],
        ],
        body: `Dear ${supplier.name},<br><br>Our stock of <strong>${item.itemName}</strong> has fallen below the minimum threshold and requires urgent replenishment to avoid production stoppage.<br><br>Please confirm your available quantity and earliest possible delivery date by replying to this email.`,
        cta: { label: 'Reply to Factory', url: 'mailto:' + ADMIN }
      })
    });
  }
  await send({
    to: ADMIN,
    subject: `📦 Low Stock — ${item.itemName} | Auto-alert sent to ${supplier?.name || 'no supplier'}`,
    html: tpl({
      icon: '⚠️', color: '#ffd32a',
      title: 'Low Stock Auto Alert',
      subtitle: 'Supplier has been notified',
      rows: [
        ['Item',              item.itemName,             '#e2e8f0'],
        ['Current Stock',     `${item.stockLevel} ${item.unit}`, '#ff4757'],
        ['Reorder Point',     `${item.reorderPoint} ${item.unit}`, '#ffd32a'],
        ['Supplier Notified', supplier?.name || 'None', '#00e676'],
        ['Supplier Email',    supplier?.email || 'N/A', '#94a3b8'],
      ],
      cta: { label: 'View Inventory', url: APP_URL + '/inventory' }
    })
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MAINTENANCE ALERT — admin
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendMaintenanceAlert = async ({ machine, urgency, hoursRemaining, daysRemaining }) => {
  const color = urgency === 'OVERDUE' || urgency === 'CRITICAL' ? '#ff4757' : '#ffd32a';
  await send({
    to: ADMIN,
    subject: `🔧 ${urgency} — ${machine.name} | Service in ${hoursRemaining}h`,
    html: tpl({
      icon: '🔧', color,
      title: `Machine Maintenance ${urgency}`,
      subtitle: `${machine.name} · ${machine.location || ''}`,
      rows: [
        ['Machine',         machine.name,                              '#e2e8f0'],
        ['ID',              machine.machineId,                         '#00d4ff'],
        ['Health Score',    (machine.healthScore || 0).toFixed(0) + '%', color],
        ['Runtime',         (machine.totalRuntimeHours || 0).toFixed(0) + 'h', '#e2e8f0'],
        ['Hours to Service', hoursRemaining + 'h',                    color],
        ['Days Remaining',  daysRemaining + ' days',                   color],
        ['Urgency',         urgency,                                   color],
      ],
      cta: { label: 'View Maintenance', url: APP_URL + '/maintenance' }
    })
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. QUALITY ALERT — admin
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendQualityAlert = async ({ machineId, machineName, totalDefects, grade, batchId }) => {
  await send({
    to: ADMIN,
    subject: `⛔ MACHINE STOP — ${machineName || machineId} | ${totalDefects} defects | Grade ${grade}`,
    html: tpl({
      icon: '⛔', color: '#ff4757',
      title: 'Quality Alert — Machine Stop',
      subtitle: 'YOLOv8 detected critical defects',
      rows: [
        ['Machine',      machineName || machineId, '#e2e8f0'],
        ['Batch ID',     batchId || 'N/A',         '#00d4ff'],
        ['Defects',      totalDefects,              '#ff4757'],
        ['Grade',        grade,                     grade === 'REJECT' ? '#ff4757' : '#ffd32a'],
        ['Action',       'STOP · INSPECT · LOG',   '#ff4757'],
      ],
      cta: { label: 'View Quality', url: APP_URL + '/quality' }
    })
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. LOAD ALERT — admin
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendLoadAlert = async ({ overloaded, idle, totalLoad }) => {
  await send({
    to: ADMIN,
    subject: `⚡ Load Imbalance — ${overloaded} machines overloaded | ${totalLoad} kW`,
    html: tpl({
      icon: '⚡', color: '#f59e0b',
      title: 'Machine Load Imbalance',
      rows: [
        ['Overloaded', overloaded,       '#ff4757'],
        ['Idle',       idle,             '#ffd32a'],
        ['Total Load', totalLoad + ' kW', '#00d4ff'],
      ],
      cta: { label: 'View Energy Dashboard', url: APP_URL + '/energy' }
    })
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. NEW SUPPLIER — admin + welcome to supplier
// ═══════════════════════════════════════════════════════════════════════════════
exports.notifyNewSupplier = async ({ supplier, addedBy }) => {
  await send({
    to: ADMIN,
    subject: `🚚 New Supplier — ${supplier.name}`,
    html: tpl({
      icon: '🚚', color: '#a855f7',
      title: 'New Supplier Registered',
      rows: [
        ['Name',      supplier.name,                        '#e2e8f0'],
        ['Email',     supplier.email || 'Not provided',    '#94a3b8'],
        ['Materials', (supplier.materials || []).join(', ') || 'N/A', '#e2e8f0'],
        ['Added By',  addedBy || 'System',                '#e2e8f0'],
      ],
      cta: { label: 'View Suppliers', url: APP_URL + '/suppliers' }
    })
  });
  if (supplier.email) {
    await send({
      to: supplier.email,
      subject: `Welcome to ${FACTORY} Supplier Network`,
      html: tpl({
        icon: '🤝', color: '#00e676',
        title: `Welcome to ${FACTORY}`,
        body: `Dear ${supplier.name},<br><br>You have been registered as a supplier in our factory management system. Our procurement team will be in touch with purchase orders and delivery schedules.<br><br>For queries, contact us at <a href="mailto:${ADMIN}">${ADMIN}</a>.`,
        cta: { label: 'Contact Us', url: 'mailto:' + ADMIN }
      })
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. JOB COMPLETED — admin + client
// ═══════════════════════════════════════════════════════════════════════════════
exports.notifyJobCompleted = async ({ job, order }) => {
  await send({
    to: ADMIN,
    subject: `✅ Job Done — ${job.orderId} | ${job.fabricType} | ${job.totalMeters}m`,
    html: tpl({
      icon: '✅', color: '#00e676',
      title: 'Production Job Completed',
      rows: [
        ['Order ID',  job.orderId,                '#00d4ff'],
        ['Fabric',    job.fabricType,             '#e2e8f0'],
        ['Meters',    job.totalMeters + ' m',     '#00e676'],
        ['Machine',   job.assignedMachine || 'N/A', '#e2e8f0'],
        ['Client',    job.clientName || '—',      '#e2e8f0'],
      ],
      cta: { label: 'View Production', url: APP_URL + '/jobs' }
    })
  });
  if (order?.clientEmail) {
    await send({
      to: order.clientEmail,
      cc: ADMIN,
      subject: `🏭 Your Order is Ready — ${job.orderId} | ${FACTORY}`,
      html: tpl({
        icon: '🎉', color: '#00e676',
        title: 'Your Order is Ready!',
        body: `Dear ${order.clientName},<br><br>Great news! Your order <strong style="color:#00d4ff">${order.orderId}</strong> (${job.fabricType}, ${job.totalMeters}m) has completed production and is ready for quality inspection and dispatch.<br><br>Our team will contact you shortly to arrange delivery.`,
        rows: [
          ['Order ID',  order.orderId,   '#00d4ff'],
          ['Fabric',    job.fabricType,  '#e2e8f0'],
          ['Quantity',  job.totalMeters + ' meters', '#00e676'],
          ['Status',    'Ready for Dispatch', '#00e676'],
        ],
        cta: { label: 'View Order', url: APP_URL + '/orders' }
      })
    });
  }
};

// Generic admin alert
exports.sendAdminAlert = async ({ subject, title, message, color = '#00d4ff', link }) => {
  await send({
    to: ADMIN, subject,
    html: tpl({ icon: '🔔', color, title, body: message, cta: link ? { label: 'Open Dashboard', url: link } : null })
  });
};

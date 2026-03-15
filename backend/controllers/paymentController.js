const { Ledger, Supplier } = require('../models/Schemas');
const emailService = require('../services/emailService');

// ─── GET /api/payments/overdue — all overdue ledger entries ──────────────────
exports.getOverdue = async (req, res) => {
  try {
    const now = new Date();
    const overdue = await Ledger.find({
      status: 'Pending',
      dueDate: { $lt: now },
      type: 'OUTFLOW'
    }).sort({ dueDate: 1 });

    const result = await Promise.all(overdue.map(async (entry) => {
      const daysOverdue = Math.floor((now - new Date(entry.dueDate)) / 86400000);
      // Try to match supplier by party name
      const supplier = await Supplier.findOne({ name: { $regex: entry.party, $options: 'i' } });
      return {
        _id: entry._id,
        description: entry.description,
        party: entry.party,
        amount: entry.amount,
        dueDate: entry.dueDate,
        daysOverdue,
        category: entry.category,
        supplierEmail: supplier?.email || null,
        supplierId: supplier?._id || null,
        urgency: daysOverdue > 14 ? 'CRITICAL' : daysOverdue > 7 ? 'HIGH' : daysOverdue > 3 ? 'MEDIUM' : 'LOW'
      };
    }));

    res.json({ count: result.length, totalAmount: result.reduce((s, r) => s + r.amount, 0), entries: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET /api/payments/upcoming — due in next N days ─────────────────────────
exports.getUpcoming = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);

    const upcoming = await Ledger.find({
      status: 'Pending',
      dueDate: { $gte: now, $lte: future }
    }).sort({ dueDate: 1 });

    const result = upcoming.map(e => ({
      _id: e._id,
      description: e.description,
      party: e.party,
      amount: e.amount,
      dueDate: e.dueDate,
      type: e.type,
      category: e.category,
      daysLeft: Math.ceil((new Date(e.dueDate) - now) / 86400000)
    }));

    res.json({ count: result.length, entries: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── POST /api/payments/:id/send-reminder — send email for specific entry ────
exports.sendReminder = async (req, res) => {
  try {
    const entry = await Ledger.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Entry not found' });

    const now = new Date();
    const daysOverdue = Math.floor((now - new Date(entry.dueDate)) / 86400000);
    const supplier = await Supplier.findOne({ name: { $regex: entry.party, $options: 'i' } }) || {
      name: entry.party, email: req.body.email || null
    };

    await emailService.sendSupplierPaymentReminder({
      supplier,
      ledgerEntry: entry,
      daysOverdue: Math.max(0, daysOverdue),
      dueDate: entry.dueDate
    });

    // Mark as notified
    await Ledger.findByIdAndUpdate(req.params.id, { $set: { lastReminderSent: new Date() } });

    res.json({ msg: `Reminder sent to admin${supplier.email ? ' and supplier' : ''}` });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── POST /api/payments/run-auto-reminders — check all and send emails ───────
exports.runAutoReminders = async (req, res) => {
  try {
    const now = new Date();
    const overdue = await Ledger.find({
      status: 'Pending',
      dueDate: { $lt: now },
      type: 'OUTFLOW'
    });

    const sent = [];
    for (const entry of overdue) {
      const daysOverdue = Math.floor((now - new Date(entry.dueDate)) / 86400000);
      if (daysOverdue < 1) continue;

      // Only re-send if no reminder in last 3 days
      const lastSent = entry.lastReminderSent;
      if (lastSent && (now - new Date(lastSent)) < 3 * 86400000) continue;

      const supplier = await Supplier.findOne({ name: { $regex: entry.party, $options: 'i' } }) || {
        name: entry.party, email: null
      };

      await emailService.sendSupplierPaymentReminder({ supplier, ledgerEntry: entry, daysOverdue, dueDate: entry.dueDate });
      await Ledger.findByIdAndUpdate(entry._id, { lastReminderSent: new Date() });
      sent.push({ party: entry.party, amount: entry.amount, daysOverdue });
    }

    res.json({ msg: `Auto-reminders sent`, count: sent.length, sent });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── PUT /api/payments/:id/mark-paid ─────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const entry = await Ledger.findByIdAndUpdate(req.params.id, { status: 'Completed' }, { new: true });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

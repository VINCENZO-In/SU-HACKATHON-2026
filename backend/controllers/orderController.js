const emailService = require('../services/emailService');
const { Order, Ledger } = require('../models/Schemas');

// ORDERS
exports.getOrders = async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
};

exports.createOrder = async (req, res) => {
  try {
    const orderId = `ORD-${Date.now()}`;
    const order = await Order.create({ ...req.body, orderId });
    await Ledger.create({
      type: 'INFLOW',
      amount: order.totalAmount,
      dueDate: order.deadline || new Date(Date.now() + 30 * 86400000),
      description: `Order from ${order.clientName}`,
      party: order.clientName,
      category: 'Order',
      status: 'Pending'
    });
    req.io.emit('order_created', order);
    emailService.notifyNewOrder({ order }).catch(() => {});
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.io.emit('order_updated', order);
    res.json(order);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// LEDGER
exports.getLedger = async (req, res) => {
  const entries = await Ledger.find().sort({ createdAt: -1 });
  res.json(entries);
};

exports.createLedgerEntry = async (req, res) => {
  try {
    const entry = await Ledger.create(req.body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.getCashFlow = async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const futureDate = new Date(Date.now() + days * 86400000);
  const entries = await Ledger.find({ dueDate: { $lte: futureDate }, status: 'Pending' });
  let inflow = 0, outflow = 0;
  entries.forEach(e => {
    if (e.type === 'INFLOW') inflow += e.amount;
    else outflow += e.amount;
  });
  const byCategory = await Ledger.aggregate([
    { $group: { _id: '$category', total: { $sum: '$amount' }, type: { $first: '$type' } } }
  ]);
  res.json({ period: `${days} days`, expectedInflow: inflow, expectedOutflow: outflow, net: inflow - outflow, riskLevel: inflow - outflow < 0 ? 'CRITICAL' : 'SAFE', byCategory });
};

exports.getDashboardStats = async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const paidOrders = await Order.countDocuments({ paymentStatus: 'Paid' });
  const revenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
  const pending = await Order.countDocuments({ status: { $in: ['Received', 'In Production'] } });
  res.json({
    totalOrders,
    paidOrders,
    pendingOrders: pending,
    totalRevenue: revenue[0]?.total || 0,
    collectionRate: totalOrders ? ((paidOrders / totalOrders) * 100).toFixed(1) : 0
  });
};

const { Inventory, Supplier } = require('../models/Schemas');
const QRCode = require('qrcode');
const emailService = require('../services/emailService');

exports.getAll = async (req, res) => {
  const items = await Inventory.find().sort({ createdAt: -1 });
  res.json(items);
};

exports.getByBarcode = async (req, res) => {
  const item = await Inventory.findOne({ barcode: req.params.barcode });
  if (!item) return res.status(404).json({ msg: 'Barcode not found' });
  res.json(item);
};

exports.create = async (req, res) => {
  try {
    const barcode = req.body.barcode || `TXTL-${Date.now()}-${Math.floor(Math.random()*9999)}`;
    // Generate QR code
    const qrData = JSON.stringify({ barcode, item: req.body.itemName, location: req.body.location });
    const qrCode = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    const item = await Inventory.create({ ...req.body, barcode, qrCode,
      lifecycle: [{ stage: 'Received', location: req.body.location || 'Warehouse A',
        note: 'Initial receipt', performedBy: req.user?.name || 'System', timestamp: new Date() }]
    });
    emailService.notifyNewInventory({ item, addedBy: req.user?.name }).catch(() => {});
        res.status(201).json(item);
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

exports.remove = async (req, res) => {
  await Inventory.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Item deleted' });
};

// Track movement + update lifecycle
exports.trackMovement = async (req, res) => {
  try {
    const { barcode, newLocation, stage, note } = req.body;
    const item = await Inventory.findOne({ barcode });
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    item.movementHistory.push({ from: item.location, to: newLocation, movedBy: req.user.name });
    item.location = newLocation;
    if (stage) {
      item.lifecycle.push({ stage, location: newLocation, note: note || '', performedBy: req.user.name, timestamp: new Date() });
      item.processingStatus = ['Finished', 'Packed'].includes(stage) ? 'Finished' :
        stage === 'Dispatched' || stage === 'Delivered' ? 'Dispatched' :
        ['In Production'].includes(stage) ? 'Processing' : item.processingStatus;
    }
    await item.save();
    res.json(item);
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

// Scan QR code barcode
exports.scanQR = async (req, res) => {
  try {
    const { qrData } = req.body;
    let barcode = qrData;
    try { const parsed = JSON.parse(qrData); barcode = parsed.barcode || qrData; } catch {}
    const item = await Inventory.findOne({ barcode });
    if (!item) return res.status(404).json({ msg: 'Item not found for QR: ' + qrData });
    res.json(item);
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

// Regenerate QR for item
exports.generateQR = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Not found' });
    const qrData = JSON.stringify({ barcode: item.barcode, item: item.itemName, location: item.location });
    const qrCode = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    await Inventory.findByIdAndUpdate(req.params.id, { qrCode });
    res.json({ qrCode, barcode: item.barcode });
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

// Check low stock + auto email best supplier
exports.checkStock = async (req, res) => {
  const lowStock = await Inventory.find({ $expr: { $lte: ['$stockLevel', '$reorderPoint'] } });

  const alerts = [];
  for (const item of lowStock) {
    // Find best supplier for this material
    const suppliers = await Supplier.find({ materials: { $regex: item.itemName, $options: 'i' }, isActive: true });
    suppliers.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    const bestSupplier = suppliers[0];

    const alert = {
      itemName: item.itemName, barcode: item.barcode,
      stockLevel: item.stockLevel, reorderPoint: item.reorderPoint,
      bestSupplier: bestSupplier ? { name: bestSupplier.name, email: bestSupplier.email, score: bestSupplier.reliabilityScore } : null
    };
    alerts.push(alert);

    // Auto email supplier if not already alerted recently
    if (bestSupplier && bestSupplier.email && !item.lowStockAlertSent) {
      await emailService.sendLowStockAlert({ item, supplier: bestSupplier });
      await Inventory.findByIdAndUpdate(item._id, { lowStockAlertSent: true });
      if (req.io) req.io.emit('low_stock_alert', { itemName: item.itemName, supplierName: bestSupplier.name, emailSent: true });
    }
  }

  res.json({ count: lowStock.length, alerts });
};

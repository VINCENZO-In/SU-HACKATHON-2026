const { Supplier } = require('../models/Schemas');
const emailService = require('../services/emailService');

function computeScore(s) {
  let score = 100;
  score -= s.lateDeliveryRate * 0.8;
  score -= s.defectRate * 1.2;
  // Early payment bonus
  score += (s.earlyPaymentBonus || 0) * 2;
  const recent = s.deliveryHistory.slice(-10);
  const avgQ = recent.length ? recent.reduce((a, d) => a + (d.qualityScore || 80), 0) / recent.length : 80;
  score = score * 0.6 + avgQ * 0.4;
  // Avg delivery gap bonus/penalty
  const gap = s.avgDeliveryGapDays || 0;
  if (gap < 0) score += Math.abs(gap) * 1.5; // early = bonus
  else score -= gap * 1.0; // late = penalty
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildTimeline(s) {
  return s.deliveryHistory.slice(-12).map(d => {
    const expected = d.expectedDate ? new Date(d.expectedDate) : null;
    const actual = d.actualDate ? new Date(d.actualDate) : null;
    const gapDays = expected && actual ? Math.round((actual - expected) / 86400000) : null;
    return {
      orderId: d.orderId,
      expectedDate: expected,
      actualDate: actual,
      gapDays,
      onTime: d.onTime,
      qualityScore: d.qualityScore,
      amount: d.amount || 0,
      paidOnTime: d.paidOnTime,
      paymentDate: d.paymentDate,
      status: gapDays === null ? 'Pending' : gapDays <= 0 ? 'Early/On-Time' : gapDays <= 3 ? 'Slightly Late' : 'Late'
    };
  });
}

exports.getAll = async (req, res) => {
  const suppliers = await Supplier.find();
  res.json(suppliers);
};

exports.create = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    emailService.notifyNewSupplier({ supplier, addedBy: req.user?.name }).catch(e => console.error('Email error:', e.message));
    res.status(201).json(supplier);
  }
  catch (err) { 
    console.error('Supplier Create Error:', err);
    res.status(400).json({ msg: err.message }); 
  }
};

exports.update = async (req, res) => {
  try { res.json(await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (err) { res.status(400).json({ msg: err.message }); }
};

exports.remove = async (req, res) => {
  await Supplier.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Deleted' });
};

exports.getRiskAnalysis = async (req, res) => {
  const suppliers = await Supplier.find({ isActive: true });
  const analysis = suppliers.map(s => {
    const score = computeScore(s);
    const risk = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High';
    const timeline = buildTimeline(s);
    const avgGap = timeline.filter(t => t.gapDays !== null).length
      ? timeline.filter(t => t.gapDays !== null).reduce((a, t) => a + t.gapDays, 0) / timeline.filter(t => t.gapDays !== null).length
      : 0;
    const earlyPayments = s.deliveryHistory.filter(d => d.paidOnTime).length;
    return {
      id: s._id, supplierId: s.supplierId, name: s.name, materials: s.materials,
      email: s.email,
      reliabilityScore: score, riskLevel: risk,
      lateDeliveryRate: s.lateDeliveryRate, defectRate: s.defectRate,
      avgDeliveryGapDays: parseFloat(avgGap.toFixed(1)),
      earlyPayments, totalDeliveries: s.deliveryHistory.length,
      timeline,
      rank: 0,
      recommendation: risk === 'High' ? 'Seek alternatives' : risk === 'Medium' ? 'Monitor closely' : 'Preferred supplier',
      badge: score >= 85 ? 'GOLD' : score >= 70 ? 'SILVER' : score >= 55 ? 'BRONZE' : 'REVIEW'
    };
  });
  analysis.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  analysis.forEach((s, i) => s.rank = i + 1);
  res.json(analysis);
};

exports.addDelivery = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    supplier.deliveryHistory.push(req.body);
    const onTime = supplier.deliveryHistory.filter(d => d.onTime).length;
    supplier.lateDeliveryRate = Math.round((1 - onTime / supplier.deliveryHistory.length) * 100);
    const earlyPays = supplier.deliveryHistory.filter(d => d.paidOnTime).length;
    supplier.earlyPaymentBonus = earlyPays;
    // Compute avg delivery gap
    const withGap = supplier.deliveryHistory.filter(d => d.expectedDate && d.actualDate);
    if (withGap.length) {
      const totalGap = withGap.reduce((s, d) => s + Math.round((new Date(d.actualDate) - new Date(d.expectedDate)) / 86400000), 0);
      supplier.avgDeliveryGapDays = parseFloat((totalGap / withGap.length).toFixed(1));
    }
    supplier.reliabilityScore = computeScore(supplier);
    supplier.riskLevel = supplier.reliabilityScore >= 80 ? 'Low' : supplier.reliabilityScore >= 60 ? 'Medium' : 'High';
    await supplier.save();
    res.json(supplier);
  } catch (err) { res.status(400).json({ msg: err.message }); }
};

exports.getBestForMaterial = async (req, res) => {
  const { material } = req.params;
  const suppliers = await Supplier.find({ materials: { $regex: material, $options: 'i' }, isActive: true });
  const ranked = suppliers.map(s => ({ ...s.toObject(), score: computeScore(s) }));
  ranked.sort((a, b) => b.score - a.score);
  res.json(ranked.slice(0, 5));
};

const { QualityLog } = require('../models/Schemas');

exports.getAll = async (req, res) => {
  const logs = await QualityLog.find().sort({ inspectedAt: -1 }).limit(50)
    .populate('inspectorId', 'name');
  res.json(logs);
};

exports.submit = async (req, res) => {
  try {
    const totalDefects = req.body.defects?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
    let grade = 'A';
    if (totalDefects > 10) grade = 'REJECT';
    else if (totalDefects > 5) grade = 'C';
    else if (totalDefects > 2) grade = 'B';

    const log = await QualityLog.create({
      ...req.body,
      totalDefects,
      grade,
      inspectorId: req.user._id
    });

    // Alert if 3+ consecutive defects
    const recent = await QualityLog.find({ machineId: req.body.machineId })
      .sort({ inspectedAt: -1 }).limit(3);
    if (recent.length === 3 && recent.every(l => l.totalDefects > 0)) {
      req.io.emit('quality_alert', { machineId: req.body.machineId, msg: '⚠️ 3 consecutive defective batches!' });
    }

    req.io.emit('quality_log', log);
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.getStats = async (req, res) => {
  const total = await QualityLog.countDocuments();
  const gradeA = await QualityLog.countDocuments({ grade: 'A' });
  const rejected = await QualityLog.countDocuments({ grade: 'REJECT' });
  const defectTypes = await QualityLog.aggregate([
    { $unwind: '$defects' },
    { $group: { _id: '$defects.type', count: { $sum: '$defects.count' } } },
    { $sort: { count: -1 } }
  ]);
  res.json({ total, gradeA, rejected, passRate: total ? ((gradeA / total) * 100).toFixed(1) : 0, defectTypes });
};

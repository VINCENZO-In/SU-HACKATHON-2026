const { Order, SalesPrediction } = require('../models/Schemas');

// Simple linear regression + seasonal adjustment
function predictNext(historicalData) {
  if (!historicalData.length) return 0;
  const n = historicalData.length;
  const avg = historicalData.reduce((s, v) => s + v, 0) / n;
  // Weighted moving average (recent data weighted more)
  const weights = historicalData.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wma = historicalData.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;
  // Trend
  const trend = n >= 2 ? (historicalData[n-1] - historicalData[0]) / (n - 1) : 0;
  const predicted = Math.max(0, wma + trend * 0.5);
  return Math.round(predicted);
}

exports.getSalesPrediction = async (req, res) => {
  try {
    const now = new Date();
    // Get orders by fabric type by month for last 12 months
    const since = new Date(now); since.setMonth(since.getMonth() - 12);
    const orders = await Order.find({ createdAt: { $gte: since } });

    // Group by fabric type and month
    const byFabric = {};
    orders.forEach(o => {
      if (!o.fabricType) return;
      const key = o.fabricType;
      const month = new Date(o.createdAt).getMonth();
      const year = new Date(o.createdAt).getFullYear();
      const mk = `${year}-${String(month+1).padStart(2,'0')}`;
      if (!byFabric[key]) byFabric[key] = {};
      if (!byFabric[key][mk]) byFabric[key][mk] = 0;
      byFabric[key][mk] += (o.totalMeters || 0);
    });

    const predictions = [];
    for (const [fabric, monthData] of Object.entries(byFabric)) {
      // Build last 12 months array
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now); d.setMonth(d.getMonth() - i);
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        months.push({ month: mk, sales: monthData[mk] || 0 });
      }
      const salesArr = months.map(m => m.sales);
      const predicted = predictNext(salesArr);
      const avg = salesArr.reduce((a,b)=>a+b,0)/salesArr.length;
      const trend = salesArr.length >= 2 ? salesArr[salesArr.length-1] - salesArr[0] : 0;
      const suggestedProduction = Math.round(predicted * 1.1); // 10% buffer
      predictions.push({
        fabricType: fabric,
        monthlyHistory: months,
        avgMonthlySales: Math.round(avg),
        predictedNextMonth: predicted,
        suggestedProduction,
        trend: trend > 0 ? 'Growing' : trend < 0 ? 'Declining' : 'Stable',
        trendPct: avg > 0 ? +((trend / avg) * 100).toFixed(1) : 0,
        confidence: months.filter(m=>m.sales>0).length >= 3 ? 0.82 : 0.55
      });
    }
    predictions.sort((a, b) => b.predictedNextMonth - a.predictedNextMonth);

    // Total factory prediction
    const totalPredicted = predictions.reduce((s, p) => s + p.predictedNextMonth, 0);
    res.json({
      generatedAt: new Date(),
      nextMonth: `${new Date(now.getFullYear(), now.getMonth()+1).toLocaleString('en-IN',{month:'long',year:'numeric'})}`,
      totalPredictedMeters: totalPredicted,
      predictions,
      recommendation: `Suggested production increase: ${Math.round(totalPredicted * 0.1)}m buffer`
    });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const orders = await Order.find({ createdAt: { $gte: d, $lte: end } });
      months.push({
        month: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
        orders: orders.length,
        totalMeters: orders.reduce((s,o)=>s+(o.totalMeters||0),0),
        revenue: orders.reduce((s,o)=>s+(o.totalAmount||0),0),
        paid: orders.filter(o=>o.paymentStatus==='Paid').reduce((s,o)=>s+(o.totalAmount||0),0)
      });
    }
    res.json({ months });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};

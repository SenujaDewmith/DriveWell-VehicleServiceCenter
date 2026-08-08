const {
  BRAND,
  createReportDoc,
  sectionTitle,
  drawKpiRow,
  drawInsights,
  drawBarChart,
  drawTable,
  finalizeFooters,
} = require("./pdf");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = (v) => (v === null || v === undefined ? 0 : parseFloat(v));
const money = (v) => `LKR ${Math.round(num(v)).toLocaleString()}`;
const pct = (v) => `${(num(v) * 100).toFixed(1)}%`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" }) : "—");

function periodLabel(from, to) {
  if (!from && !to) return "Period: all time";
  if (from && to) return `Period: ${fmtDate(from)} — ${fmtDate(to)}`;
  if (from) return `Period: from ${fmtDate(from)}`;
  return `Period: through ${fmtDate(to)}`;
}

function groupByMonth(rows, dateKey, valueKey) {
  const map = {};
  for (const r of rows) {
    const m = MONTHS[new Date(r[dateKey]).getMonth()];
    map[m] = (map[m] || 0) + num(r[valueKey]);
  }
  return MONTHS.filter((m) => map[m] !== undefined).map((m) => ({ month: m, value: map[m] }));
}

// Same-length window immediately preceding `from` — used for period-over-period comparison.
function previousPeriod(from, to) {
  if (!from || !to) return null;
  const fromD = new Date(from);
  const toD = new Date(to);
  const days = Math.round((toD - fromD) / 86400000) + 1;
  const prevTo = new Date(fromD);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

function buildRevenuePdf({ summary, by_package, by_date, comparison, from, to, generatedBy }) {
  const { doc, margin, contentWidth } = createReportDoc({
    title: "Revenue Report",
    subtitle: periodLabel(from, to),
  });

  const totalRevenue = num(summary.total_revenue);
  const paidRevenue = num(summary.paid_revenue);
  const unpaidRevenue = num(summary.unpaid_revenue);
  const totalInvoices = num(summary.total_invoices);
  const avgInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
  const unpaidRatio = totalRevenue > 0 ? unpaidRevenue / totalRevenue : 0;

  drawKpiRow(doc, {
    x: margin,
    width: contentWidth,
    stats: [
      { label: "Total Revenue", value: money(totalRevenue) },
      { label: "Paid", value: money(paidRevenue) },
      { label: "Unpaid", value: money(unpaidRevenue) },
      { label: "Avg Invoice", value: money(avgInvoice) },
    ],
  });

  const insights = [];
  if (comparison) {
    const prevTotal = num(comparison.prevSummary.total_revenue);
    if (prevTotal > 0) {
      const change = ((totalRevenue - prevTotal) / prevTotal) * 100;
      const dir = change >= 0 ? "up" : "down";
      insights.push(
        `Revenue is ${dir} ${Math.abs(change).toFixed(1)}% versus the previous period (${fmtDate(comparison.prevRange.from)} – ${fmtDate(comparison.prevRange.to)}, ${money(prevTotal)}).`,
      );
    } else if (totalRevenue > 0) {
      insights.push(`Revenue grew from zero in the previous period to ${money(totalRevenue)} this period.`);
    }
  }
  if (by_package.length) {
    const top = by_package[0];
    const share = totalRevenue > 0 ? num(top.revenue) / totalRevenue : 0;
    insights.push(`${top.package_name} is the largest contributor at ${pct(share)} of total revenue (${money(top.revenue)}).`);
  }
  if (totalRevenue > 0) {
    insights.push(
      unpaidRatio > 0.15
        ? `${pct(unpaidRatio)} of revenue (${money(unpaidRevenue)}) is still unpaid — prioritize collection to protect cash flow.`
        : `Only ${pct(unpaidRatio)} of revenue is unpaid — collections are healthy.`,
    );
  }
  if (by_date.length) {
    const peak = by_date.reduce((best, d) => (num(d.revenue) > num(best.revenue) ? d : best), by_date[0]);
    insights.push(`${fmtDate(peak.service_date)} was the highest single day, generating ${money(peak.revenue)}.`);
  }
  drawInsights(doc, margin, contentWidth, insights);

  if (by_date.length) {
    sectionTitle(doc, margin, "Revenue Trend");
    drawBarChart(doc, {
      x: margin,
      width: contentWidth,
      data: groupByMonth(by_date, "service_date", "revenue"),
      labelKey: "month",
      valueKey: "value",
      valueFormatter: (v) => `${Math.round(v / 1000)}k`,
      color: BRAND.light,
    });
  }

  if (by_package.length) {
    sectionTitle(doc, margin, "Revenue by Package");
    drawTable(doc, {
      x: margin,
      width: contentWidth,
      columns: [
        { label: "Package", value: (r) => r.package_name, width: contentWidth * 0.45 },
        { label: "Invoices", value: (r) => r.count, width: contentWidth * 0.2, align: "right" },
        { label: "Revenue (LKR)", value: (r) => num(r.revenue).toLocaleString(), width: contentWidth * 0.2, align: "right" },
        { label: "% of Total", value: (r) => pct(totalRevenue > 0 ? num(r.revenue) / totalRevenue : 0), width: contentWidth * 0.15, align: "right" },
      ],
      rows: by_package,
    });
  }

  finalizeFooters(doc, { generatedBy });
  return doc;
}

function buildVolumePdf({ by_status, by_package, by_date, from, to, generatedBy }) {
  const { doc, margin, contentWidth } = createReportDoc({
    title: "Service Volume Report",
    subtitle: periodLabel(from, to),
  });

  const totalServices = by_package.reduce((s, p) => s + num(p.count), 0);
  const mostPopular = by_package[0];
  const completed = by_status.find((s) => s.status === "Completed");
  const completionRate = totalServices > 0 && completed ? num(completed.count) / totalServices : null;

  drawKpiRow(doc, {
    x: margin,
    width: contentWidth,
    stats: [
      { label: "Total Services", value: totalServices.toLocaleString() },
      { label: "Most Popular", value: mostPopular?.package_name ?? "—" },
      { label: "Completion Rate", value: completionRate !== null ? pct(completionRate) : "—" },
      { label: "Packages Offered", value: by_package.length },
    ],
  });

  const insights = [];
  if (mostPopular) {
    const share = totalServices > 0 ? num(mostPopular.count) / totalServices : 0;
    insights.push(`${mostPopular.package_name} is the most requested service, making up ${pct(share)} of volume (${mostPopular.count} bookings).`);
  }
  if (completionRate !== null) {
    insights.push(
      completionRate < 0.7
        ? `Only ${pct(completionRate)} of tracked bookings are Completed — review scheduling capacity or backlog.`
        : `${pct(completionRate)} of tracked bookings are Completed, indicating healthy throughput.`,
    );
  }
  if (by_date.length) {
    const peak = by_date.reduce((best, d) => (num(d.count) > num(best.count) ? d : best), by_date[0]);
    insights.push(`${fmtDate(peak.service_date)} was the busiest day with ${peak.count} services.`);
  }
  drawInsights(doc, margin, contentWidth, insights);

  if (by_date.length) {
    sectionTitle(doc, margin, "Volume Trend");
    drawBarChart(doc, {
      x: margin,
      width: contentWidth,
      data: groupByMonth(by_date, "service_date", "count"),
      labelKey: "month",
      valueKey: "value",
      valueFormatter: (v) => String(Math.round(v)),
      color: BRAND.accent,
    });
  }

  if (by_status.length) {
    sectionTitle(doc, margin, "By Status");
    drawTable(doc, {
      x: margin,
      width: contentWidth,
      columns: [
        { label: "Status", value: (r) => r.status, width: contentWidth * 0.7 },
        { label: "Count", value: (r) => r.count, width: contentWidth * 0.3, align: "right" },
      ],
      rows: by_status,
    });
  }

  if (by_package.length) {
    sectionTitle(doc, margin, "By Package");
    drawTable(doc, {
      x: margin,
      width: contentWidth,
      columns: [
        { label: "Package", value: (r) => r.package_name, width: contentWidth * 0.7 },
        { label: "Count", value: (r) => r.count, width: contentWidth * 0.3, align: "right" },
      ],
      rows: by_package,
    });
  }

  finalizeFooters(doc, { generatedBy });
  return doc;
}

function buildStaffPerformancePdf({ staff_performance, from, to, generatedBy }) {
  const { doc, margin, contentWidth } = createReportDoc({
    title: "Staff Performance Report",
    subtitle: periodLabel(from, to),
  });

  const totalJobs = staff_performance.reduce((s, r) => s + num(r.jobs_completed), 0);
  const rated = staff_performance.filter((r) => r.avg_rating !== null);
  const overallAvgRating = rated.length ? rated.reduce((s, r) => s + num(r.avg_rating), 0) / rated.length : null;
  const topPerformer = staff_performance[0];

  drawKpiRow(doc, {
    x: margin,
    width: contentWidth,
    stats: [
      { label: "Staff Tracked", value: staff_performance.length },
      { label: "Jobs Completed", value: totalJobs.toLocaleString() },
      { label: "Avg Rating", value: overallAvgRating !== null ? overallAvgRating.toFixed(1) : "—" },
      { label: "Top Performer", value: topPerformer?.jobs_completed > 0 ? topPerformer.full_name : "—" },
    ],
  });

  const insights = [];
  if (topPerformer && num(topPerformer.jobs_completed) > 0) {
    insights.push(
      `${topPerformer.full_name} completed the most jobs this period (${topPerformer.jobs_completed})${topPerformer.avg_rating ? `, averaging ${num(topPerformer.avg_rating).toFixed(1)}/5` : ""}.`,
    );
  }
  const needsCoaching = staff_performance.filter((r) => r.avg_rating !== null && num(r.avg_rating) < 3.5 && num(r.feedback_count) > 0);
  if (needsCoaching.length) {
    insights.push(`${needsCoaching.map((r) => r.full_name).join(", ")} ${needsCoaching.length > 1 ? "are" : "is"} averaging below 3.5/5 — worth a check-in.`);
  }
  const idle = staff_performance.filter((r) => num(r.jobs_completed) === 0);
  if (idle.length) {
    insights.push(`${idle.length} staff member${idle.length > 1 ? "s" : ""} recorded no completed jobs this period.`);
  }
  drawInsights(doc, margin, contentWidth, insights);

  const chartData = staff_performance
    .filter((r) => num(r.jobs_completed) > 0)
    .slice(0, 10)
    .map((r) => ({ name: r.full_name.split(" ")[0], jobs: num(r.jobs_completed) }));
  if (chartData.length) {
    sectionTitle(doc, margin, "Jobs Completed by Staff");
    drawBarChart(doc, {
      x: margin,
      width: contentWidth,
      data: chartData,
      labelKey: "name",
      valueKey: "jobs",
      valueFormatter: (v) => String(Math.round(v)),
      color: BRAND.light,
    });
  }

  if (staff_performance.length) {
    sectionTitle(doc, margin, "All Staff");
    drawTable(doc, {
      x: margin,
      width: contentWidth,
      columns: [
        { label: "Staff Member", value: (r) => r.full_name, width: contentWidth * 0.35 },
        { label: "Role", value: (r) => r.role_name, width: contentWidth * 0.2 },
        { label: "Completed", value: (r) => r.jobs_completed, width: contentWidth * 0.15, align: "right" },
        { label: "Avg Rating", value: (r) => (r.avg_rating !== null ? `${num(r.avg_rating).toFixed(1)}/5` : "—"), width: contentWidth * 0.15, align: "right" },
        { label: "Feedback", value: (r) => r.feedback_count, width: contentWidth * 0.15, align: "right" },
      ],
      rows: staff_performance,
    });
  }

  finalizeFooters(doc, { generatedBy });
  return doc;
}

function buildActivityPdf({ logs, from, to, generatedBy }) {
  const { doc, margin, contentWidth } = createReportDoc({
    title: "Activity Log",
    subtitle: periodLabel(from, to),
  });

  const distinctUsers = new Set(logs.map((l) => l.email).filter(Boolean)).size;
  const actionCounts = {};
  for (const l of logs) actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

  drawKpiRow(doc, {
    x: margin,
    width: contentWidth,
    stats: [
      { label: "Total Events", value: logs.length.toLocaleString() },
      { label: "Active Users", value: distinctUsers },
      { label: "Most Frequent", value: topAction ? topAction[0].replace(/_/g, " ") : "—" },
      { label: "Distinct Actions", value: Object.keys(actionCounts).length },
    ],
  });

  const insights = [];
  if (topAction) {
    insights.push(`${topAction[0].replace(/_/g, " ")} is the most frequent event, accounting for ${pct(topAction[1] / logs.length)} of activity (${topAction[1]} events).`);
  }
  drawInsights(doc, margin, contentWidth, insights);

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([action, count]) => ({ action: action.replace(/_/g, " "), count }));
  if (topActions.length) {
    sectionTitle(doc, margin, "Events by Type");
    drawBarChart(doc, {
      x: margin,
      width: contentWidth,
      data: topActions,
      labelKey: "action",
      valueKey: "count",
      valueFormatter: (v) => String(Math.round(v)),
      color: BRAND.accent,
    });
  }

  if (logs.length) {
    sectionTitle(doc, margin, "Log Entries");
    drawTable(doc, {
      x: margin,
      width: contentWidth,
      columns: [
        { label: "Date/Time", value: (r) => new Date(r.created_at).toLocaleString("en-LK"), width: contentWidth * 0.25 },
        { label: "Action", value: (r) => r.action.replace(/_/g, " "), width: contentWidth * 0.25 },
        { label: "By", value: (r) => r.email ?? "—", width: contentWidth * 0.3 },
        { label: "Entity", value: (r) => (r.entity_type ? `${r.entity_type}${r.entity_id != null ? ` #${r.entity_id}` : ""}` : "—"), width: contentWidth * 0.2 },
      ],
      rows: logs,
    });
  }

  finalizeFooters(doc, { generatedBy });
  return doc;
}

module.exports = {
  buildRevenuePdf,
  buildVolumePdf,
  buildStaffPerformancePdf,
  buildActivityPdf,
  previousPeriod,
};

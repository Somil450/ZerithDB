"use client";

import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────
type Status = "yes" | "partial" | "no";

interface FeatureRow {
  feature: string;
  firebase: Status;
  supabase: Status;
  zerith: Status;
  firebaseLabel: string;
  supabaseLabel: string;
  zerithLabel: string;
}

interface RadarAxis {
  label: string;
  firebase: number;
  supabase: number;
  zerith: number;
}

// ── Data ───────────────────────────────────────────────────────────────────
const features: FeatureRow[] = [
  {
    feature: "Backend Required",
    firebase: "no",
    supabase: "no",
    zerith: "yes",
    firebaseLabel: "Yes (Managed)",
    supabaseLabel: "Yes (Managed)",
    zerithLabel: "No (Browser-only)",
  },
  {
    feature: "Offline-First",
    firebase: "partial",
    supabase: "partial",
    zerith: "yes",
    firebaseLabel: "Limited / Add-on",
    supabaseLabel: "Via external libs",
    zerithLabel: "Native Default",
  },
  {
    feature: "Sync Architecture",
    firebase: "partial",
    supabase: "partial",
    zerith: "yes",
    firebaseLabel: "Client-Server",
    supabaseLabel: "Client-Server",
    zerithLabel: "Peer-to-Peer",
  },
  {
    feature: "Conflict Resolution",
    firebase: "no",
    supabase: "partial",
    zerith: "yes",
    firebaseLabel: "Last-write-wins",
    supabaseLabel: "PostgreSQL rules",
    zerithLabel: "CRDTs (Deterministic)",
  },
  {
    feature: "Vendor Lock-in",
    firebase: "no",
    supabase: "partial",
    zerith: "yes",
    firebaseLabel: "High",
    supabaseLabel: "Low (Open Source)",
    zerithLabel: "None (Runs in client)",
  },
];

// Qualitative ratings 1-5 (based on documented architectural characteristics)
const radarAxes: RadarAxis[] = [
  { label: "Offline Support", firebase: 2, supabase: 2, zerith: 5 },
  { label: "Privacy", firebase: 2, supabase: 3, zerith: 5 },
  { label: "No Vendor Lock-in", firebase: 1, supabase: 3, zerith: 5 },
  { label: "Low Setup Cost", firebase: 4, supabase: 4, zerith: 5 },
  { label: "Simplicity", firebase: 3, supabase: 3, zerith: 5 },
];

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({
  status,
  label,
  isZerith = false,
}: {
  status: Status;
  label: string;
  isZerith?: boolean;
}) {
  const icon =
    status === "yes" ? "✅" : status === "partial" ? "⚠️" : "❌";

  const baseClasses =
    "flex items-start gap-2 text-sm leading-snug";

  return (
    <div className={baseClasses}>
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <span
        className={
          isZerith
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}

// ── Radar Chart (pure SVG, no lib needed) ──────────────────────────────────
function RadarChart() {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 95;
  const levels = 5;
  const total = radarAxes.length;

  // angle for each axis (starting from top, clockwise)
  const angle = (i: number) => (Math.PI * 2 * i) / total - Math.PI / 2;

  // convert a value (1-5) + axis index to x,y
  const point = (value: number, i: number) => {
    const r = (value / 5) * maxR;
    return {
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  };

  // polygon points string
  const poly = (getValue: (a: RadarAxis) => number) =>
    radarAxes
      .map((a, i) => {
        const p = point(getValue(a), i);
        return `${p.x},${p.y}`;
      })
      .join(" ");

  // grid polygon for a given level
  const gridPoly = (level: number) =>
    radarAxes
      .map((_, i) => {
        const r = (level / levels) * maxR;
        return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
      })
      .join(" ");

  // label position (slightly outside maxR)
  const labelPos = (i: number) => {
    const r = maxR + 22;
    return {
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  };

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: 280 }}
      aria-label="Radar chart comparing ZerithDB, Firebase, and Supabase across 5 qualitative axes"
      role="img"
    >
      {/* Grid levels */}
      {Array.from({ length: levels }).map((_, lvl) => (
        <polygon
          key={lvl}
          points={gridPoly(lvl + 1)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {radarAxes.map((_, i) => {
        const p = point(5, i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        );
      })}

      {/* Firebase polygon */}
      <polygon
        points={poly((a) => a.firebase)}
        fill="#f97316"
        fillOpacity={0.12}
        stroke="#f97316"
        strokeWidth={1.5}
        strokeOpacity={0.6}
      />

      {/* Supabase polygon */}
      <polygon
        points={poly((a) => a.supabase)}
        fill="#22c55e"
        fillOpacity={0.12}
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeOpacity={0.6}
      />

      {/* ZerithDB polygon */}
      <motion.polygon
        points={poly((a) => a.zerith)}
        fill="#2563eb"
        fillOpacity={0.2}
        stroke="#2563eb"
        strokeWidth={2}
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Axis labels */}
      {radarAxes.map((axis, i) => {
        const pos = labelPos(i);
        return (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontWeight={500}
            fill="currentColor"
            opacity={0.7}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ComparisonSection() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 },
  };

  const stagger = {
    initial: {},
    whileInView: { transition: { staggerChildren: 0.08 } },
    viewport: { once: true },
  };

  const cardVariant = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 },
  };

const databases = [
    { key: "firebase", label: "Firebase", accent: "text-orange-500", highlight: false },
    { key: "supabase", label: "Supabase", accent: "text-green-600", highlight: false },
    {
      key: "zerith",
      label: "ZerithDB",
      accent: "text-blue-600",
      highlight: true,
    },
  ] as const;

  return (
    <section
      id="compare"
      className="py-24 px-6 bg-background transition-colors duration-300"
    >
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <motion.div {...fadeInUp} className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground transition-colors duration-300">
            The Modern Data Layer
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            See how ZerithDB compares to traditional architectures.
          </p>
        </motion.div>

        {/* ── Feature Comparison Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {databases.map((db) => (
            <motion.div
              key={db.key}
              variants={cardVariant}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${
                db.highlight
                  ? "border-blue-200 dark:border-blue-800 shadow-md"
                  : "border-border"
              }`}
            >
              {/* Card Header */}
              <div
                className={`px-5 py-4 flex items-center justify-between ${
                  db.highlight
                    ? "bg-blue-50/60 dark:bg-blue-950/30"
                    : "bg-muted dark:bg-card"
                }`}
              >
                <span
                  className={`font-bold text-base tracking-tight ${db.accent}`}
                >
                  {db.label}
                </span>
                {db.highlight && (
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>

              {/* Feature Rows */}
              <motion.div
                variants={stagger}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                className="divide-y divide-border"
              >
                {features.map((row) => {
                  const status = row[db.key] as Status;
                  const label =
                    db.key === "firebase"
                      ? row.firebaseLabel
                      : db.key === "supabase"
                      ? row.supabaseLabel
                      : row.zerithLabel;

                  return (
                    <motion.div
                      key={row.feature}
                      variants={{
                        initial: { opacity: 0, x: -8 },
                        whileInView: { opacity: 1, x: 0 },
                      }}
                      className={`px-5 py-3.5 ${
                        db.highlight
                          ? "bg-background dark:bg-card"
                          : "bg-background dark:bg-card"
                      }`}
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        {row.feature}
                      </p>
                      <StatusBadge
                        status={status}
                        label={label}
                        isZerith={db.highlight}
                      />
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* ── Radar Chart + Legend ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="rounded-2xl border border-border bg-muted dark:bg-card p-8 flex flex-col md:flex-row items-center gap-10"
        >
          {/* Left: radar */}
          <div className="w-full md:w-auto flex-shrink-0 flex items-center justify-center">
            <RadarChart />
          </div>

          {/* Right: explanation */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Qualitative Architecture Comparison
            </h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Ratings (1–5) based on documented architectural characteristics only — not synthetic
              benchmarks.
            </p>

            {/* Legend */}
            <div className="flex flex-col gap-3">
              {[
                { color: "bg-blue-600", label: "ZerithDB", score: "5 / 5 across all axes" },
                { color: "bg-green-500", label: "Supabase", score: "Avg 3 / 5" },
                { color: "bg-orange-400", label: "Firebase", score: "Avg 2.4 / 5" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-sm flex-shrink-0 ${item.color}`}
                  />
                  <span className="text-sm font-medium text-foreground w-20">
                    {item.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.score}
                  </span>
                </div>
              ))}
            </div>

            {/* Axes breakdown */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {radarAxes.map((axis) => (
                <div key={axis.label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">
                    {axis.label}
                  </span>
                  <div className="flex gap-1">
                    {[axis.firebase, axis.supabase, axis.zerith].map(
                      (val, i) => (
                        <div
                          key={i}
                          className="flex gap-0.5"
                          title={
                            ["Firebase", "Supabase", "ZerithDB"][i] +
                            ": " +
                            val +
                            "/5"
                          }
                        >
                          {Array.from({ length: 5 }).map((_, dot) => (
                            <span
                              key={dot}
                              className={`w-1.5 h-1.5 rounded-full ${
                                dot < val
                                  ? i === 2
                                    ? "bg-blue-600"
                                    : i === 1
                                    ? "bg-green-500"
                                    : "bg-orange-400"
                                  : "bg-border"
                              }`}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
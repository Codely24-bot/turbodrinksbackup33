function MetricCard({ label, value, accent, hint }) {
  return (
    <article className={`metric-card ${accent || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

export default MetricCard;

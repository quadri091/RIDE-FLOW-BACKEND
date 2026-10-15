function formatTimestamp(timestamp) {
  const d = new Date(new Date(timestamp).getTime() + 60 * 60 * 1000);

  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${mm}/${dd}/${yyyy} - ${String(hours).padStart(2, "0")}:${minutes}${ampm}`;
}

module.exports = formatTimestamp;

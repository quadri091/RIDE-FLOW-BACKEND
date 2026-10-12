// the server runs in UTC (Render), so times shown to users are formatted
// in the app's own timezone instead of the server's
const TIME_ZONE = "Africa/Lagos";

function formatTimestamp(timestamp) {
  const parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .formatToParts(new Date(timestamp))
    .forEach((part) => (parts[part.type] = part.value));

  return `${parts.month}/${parts.day}/${parts.year} - ${parts.hour}:${parts.minute}${parts.dayPeriod.toUpperCase()}`;
}

module.exports = formatTimestamp;

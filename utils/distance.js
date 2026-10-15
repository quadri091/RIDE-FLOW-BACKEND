const distanceInMeters = (from, to) => {
  const rad = Math.PI / 180;
  const latChange = (to[0] - from[0]) * rad;
  const lngChange = (to[1] - from[1]) * rad;
  const a =
    Math.sin(latChange / 2) ** 2 +
    Math.cos(from[0] * rad) *
      Math.cos(to[0] * rad) *
      Math.sin(lngChange / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
};

const showDistance = (meters) => {
  if (meters >= 1000) return (meters / 1000).toFixed(1) + "km";
  return Math.round(meters) + "m";
};

module.exports = { distanceInMeters, showDistance };

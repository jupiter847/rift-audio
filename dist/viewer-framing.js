// The camera is fitted to the complete allowed rotation envelope once per
// viewport size. Turning or separating the product never changes its scale.
function prepareNormal(normal, minimumPitch, maximumPitch) {
  const [, y, z] = normal;
  const values = [
    y * Math.cos(minimumPitch) + z * Math.sin(minimumPitch),
    y * Math.cos(maximumPitch) + z * Math.sin(maximumPitch),
  ];
  const stationary = Math.atan2(z, y);
  for (let turn = -2; turn <= 2; turn++) {
    const pitch = stationary + turn * Math.PI;
    if (pitch >= minimumPitch && pitch <= maximumPitch) values.push(y * Math.cos(pitch) + z * Math.sin(pitch));
  }
  return { lengthSquared: normal.reduce((sum, value) => sum + value * value, 0), minimum: Math.min(...values), maximum: Math.max(...values) };
}

function supportForPoint(x, y, z, normal) {
  const radius = Math.hypot(x, z);
  const length = Math.hypot(radius, y);
  if (!length) return 0;
  const optimum = Math.sqrt(normal.lengthSquared) * y / length;
  const pitchProjection = Math.max(normal.minimum, Math.min(normal.maximum, optimum));
  return radius * Math.sqrt(Math.max(0, normal.lengthSquared - pitchProjection * pitchProjection)) + y * pitchProjection;
}

export function rotationEnvelopeSupport(point, normal, minimumPitch = -.85, maximumPitch = .85, roll = -.1) {
  const cosine = Math.cos(roll);
  const sine = Math.sin(roll);
  return supportForPoint(point[0] * cosine - point[1] * sine, point[0] * sine + point[1] * cosine, point[2], prepareNormal(normal, minimumPitch, maximumPitch));
}

export function fixedCameraDistance(points, { right, up, back, aspect, fov, maximumScale = .94, margin = .94, minimumPitch = -.85, maximumPitch = .85, roll = -.1 }) {
  if (!(aspect > 0) || !(fov > 0 && fov < 180) || !(maximumScale > 0) || !(margin > 0 && margin < 1) || !points.length || points.length % 3) throw new RangeError('Invalid product framing');
  const verticalSlope = Math.tan(fov * Math.PI / 360) * margin;
  const planes = [];
  for (const [axis, slope] of [[right, verticalSlope * aspect], [up, verticalSlope]]) {
    for (const side of [-1, 1]) {
      const normal = axis.map((value, index) => side * value + slope * back[index]);
      planes.push({ slope, normal: prepareNormal(normal, minimumPitch, maximumPitch) });
    }
  }
  const cosine = Math.cos(roll);
  const sine = Math.sin(roll);
  let distance = .5;
  for (let index = 0; index < points.length; index += 3) {
    const x = points[index] * cosine - points[index + 1] * sine;
    const y = points[index] * sine + points[index + 1] * cosine;
    for (const plane of planes) distance = Math.max(distance, maximumScale * supportForPoint(x, y, points[index + 2], plane.normal) / plane.slope);
  }
  return distance + .02;
}

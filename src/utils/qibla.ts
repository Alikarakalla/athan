import type { Coordinates } from "../types/prayer";

export const KAABA_COORDINATES: Coordinates = {
  latitude: 21.422487,
  longitude: 39.826206,
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;

export const normalizeDegrees = (deg: number): number => ((deg % 360) + 360) % 360;

export const calculateQiblaBearing = (from: Coordinates): number => {
  const lat1 = toRadians(from.latitude);
  const lon1 = toRadians(from.longitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const lon2 = toRadians(KAABA_COORDINATES.longitude);

  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const initialBearing = toDegrees(Math.atan2(y, x));
  return normalizeDegrees(initialBearing);
};

export const relativeQiblaAngle = (headingDegrees: number, qiblaBearingDegrees: number): number =>
  normalizeDegrees(qiblaBearingDegrees - headingDegrees);


// Shared constants for the host listing wizard (client + server).

export const CAR_FEATURES = [
  "ac",
  "bluetooth",
  "gps",
  "usb",
  "apple_carplay",
  "android_auto",
  "child_seat",
  "roof_rack",
  "backup_camera",
  "cruise_control",
  "four_wd",
  "unlimited_km",
] as const;
export type CarFeature = (typeof CAR_FEATURES)[number];

export const PHOTO_KINDS = ["exterior", "interior", "odometer", "other"] as const;

export const POPULAR_MAKES = ["Dacia", "Renault", "Peugeot", "Hyundai", "Kia", "Toyota", "Volkswagen", "Fiat", "Citroën", "Mercedes-Benz"];

export const TRANSMISSIONS = ["manual", "automatic"] as const;
export const FUELS = ["diesel", "gasoline", "hybrid", "electric"] as const;
export const CATEGORIES = ["city", "compact", "sedan", "suv", "luxury", "van"] as const;

export const MIN_PHOTOS = 3;

// Shared (client + server) constants for the hand-over inspection.

export const INSPECTION_ANGLES = ["front", "rear", "left", "right", "interior", "dashboard"] as const;
export const INSPECTION_CHECKS = ["lights", "tyres", "windscreen", "documents", "spare", "clean"] as const;
export const MIN_INSPECTION_PHOTOS = 4;

export type InspectionPhase = "pre" | "post";
export type InspectionAngle = (typeof INSPECTION_ANGLES)[number];
export type InspectionCheck = (typeof INSPECTION_CHECKS)[number];

export const isPhase = (v: unknown): v is InspectionPhase => v === "pre" || v === "post";

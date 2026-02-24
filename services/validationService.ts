
/**
 * OPAWR Validation Service
 * All validation logic lives in weeklyPlanningService.
 * This file re-exports for backward-compatible imports across the codebase.
 */
export { validateWeeklyPlan, type WeeklyValidationIssue } from './weeklyPlanningService';

// Legacy alias so components that import ValidationIssue still compile
export type ValidationIssue = import('./weeklyPlanningService').WeeklyValidationIssue;

// Stub: old validatePlan kept as no-op so lingering imports don't crash
/** @deprecated Use validateWeeklyPlan instead */
export const validatePlan = (_rooms: unknown[], _assignments: unknown[], _staff: unknown[], _config?: unknown): ValidationIssue[] => [];

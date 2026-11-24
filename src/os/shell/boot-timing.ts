/**
 * Boot-screen timing constants.
 *
 * BOOT_BEATS and BOOT_MS are the single source of truth for the boot's
 * duration, shared by the pre-paint IIFE (prepaint.ts) and the unit tests.
 *
 * Five beats: the skip hint (step 0, visible from first paint) and four lines
 * (steps 1–4). With motion.os.bootLine = 0.7 s the whole boot lasts about 3.5 s.
 */
import { motion } from '@/design/motion';

export const BOOT_BEATS = 5;
export const BOOT_MS = Math.round(BOOT_BEATS * motion.os.bootLine * 1000);

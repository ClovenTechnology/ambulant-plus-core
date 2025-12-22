'use client';
import React, { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const bodyParts = ['Head', 'Chest', 'Abdomen', 'Arms', 'Legs'];

type SymptomAvatarProps = {
  severityMap?: Record<string, number>; // 0-100
  heartRate?: number; // BPM for pulse sync
};

export default function SymptomAvatar({
  severityMap = {},
  heartRate = 60,
}: SymptomAvatarProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const togglePart = (part: string) =>
    setSelected((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );

  const getGlowColor = (severity: number) => {
    if (severity > 75) return 'shadow-red-500/80';
    if (severity > 50) return 'shadow-orange-400/70';
    if (severity > 25) return 'shadow-yellow-300/60';
    return 'shadow-green-400/50';
  };

  const pulseDuration = 60 / heartRate;

  return (
    <div className="relative flex justify-center gap-6 flex-wrap mt-6">
      {/* Vitals halo around avatar */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-cyan-400/20 pointer-events-none"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: pulseDuration, ease: 'easeInOut' }}
      />

      {bodyParts.map((part) => {
        const severity = severityMap[part] ?? 0;
        const isSelected = selected.includes(part);
        const glowClass =
          isSelected || severity > 0 ? getGlowColor(severity) : 'shadow-none';

        return (
          <div
            key={part}
            onClick={() => togglePart(part)}
            className={clsx(
              'relative cursor-pointer w-20 h-20 flex items-center justify-center rounded-full border-2 border-white/30 font-semibold transition-all duration-300',
              'bg-black/20 text-cyan-200 drop-shadow-md',
              isSelected && 'animate-pulse',
              glowClass
            )}
          >
            {part}

            {/* Severity ring */}
            {severity > 0 && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-cyan-300/30"
                style={{ opacity: severity / 100 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: pulseDuration, ease: 'easeInOut' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

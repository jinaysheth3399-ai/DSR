"use client"

import { motion } from "framer-motion"

export function SuccessAnimation() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="relative flex size-24 items-center justify-center rounded-full bg-brand/10 ring-1 ring-brand/15"
    >
      {/* Soft pulse halo */}
      <motion.span
        className="absolute inset-0 rounded-full bg-brand/15"
        initial={{ scale: 0.6, opacity: 0.6 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      <motion.svg
        viewBox="0 0 48 48"
        className="relative z-10 size-12 text-brand"
        initial="hidden"
        animate="visible"
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      >
        <motion.path
          d="M14 24.5 L21 32 L34 17"
          variants={{
            hidden: { pathLength: 0 },
            visible: { pathLength: 1 },
          }}
          transition={{
            delay: 0.18,
            duration: 0.55,
            ease: [0.32, 0.72, 0, 1],
          }}
        />
      </motion.svg>
    </motion.div>
  )
}

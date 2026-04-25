// ── VictoryScreen.tsx ─────────────────────────────────────────────────────────
// 競技場模式通關畫面 (Premium Visuals)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  kills: number;
  playerCount: number;
  onMainMenu: () => void;
}

const Firework: React.FC<{ delay: number; x: string; y: string; color: string }> = ({ delay, x, y, color }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: [0, 1.2, 1.5], 
      opacity: [0, 1, 0],
    }}
    transition={{ 
      duration: 1.5, 
      delay, 
      repeat: Infinity, 
      repeatDelay: Math.random() * 2 
    }}
    className="absolute pointer-events-none"
    style={{ left: x, top: y, width: 4, height: 4 }}
  >
    {Array.from({ length: 12 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-full h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        animate={{ 
          x: Math.cos(i * 30 * Math.PI / 180) * 80, 
          y: Math.sin(i * 30 * Math.PI / 180) * 80,
          opacity: [1, 0]
        }}
        transition={{ duration: 1.2, delay: delay }}
      />
    ))}
  </motion.div>
);

export const VictoryScreen: React.FC<Props> = ({ kills, playerCount, onMainMenu }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #1a1500 0%, #080600 100%)',
      }}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-30">
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 50%, #f59e0b22 0%, transparent 70%)' }}
        />
      </div>

      {/* Fireworks Logic */}
      <Firework delay={0.2} x="20%" y="30%" color="#fbbf24" />
      <Firework delay={0.8} x="80%" y="25%" color="#f59e0b" />
      <Firework delay={1.4} x="50%" y="15%" color="#fbbf24" />
      <Firework delay={2.0} x="30%" y="60%" color="#f59e0b" />
      <Firework delay={2.6} x="70%" y="55%" color="#fbbf24" />

      {/* Main Content Container */}
      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8, type: 'spring' }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Trophy with Pulse */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="text-8xl mb-6 relative"
        >
          <div className="absolute inset-0 blur-2xl bg-yellow-500/30 rounded-full" />
          <span className="relative drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">🏆</span>
        </motion.div>

        {/* Title Section */}
        <div className="text-center mb-10">
          <motion.h1
            initial={{ letterSpacing: '0.1em', opacity: 0 }}
            animate={{ letterSpacing: '0.4em', opacity: 1 }}
            transition={{ delay: 0.5, duration: 1.2 }}
            className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-amber-700 uppercase"
            style={{ textShadow: '0 0 40px rgba(245,158,11,0.3)' }}
          >
            任務完成
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-amber-500/70 font-mono tracking-[0.3em] text-xs mt-4 uppercase"
          >
            All 10 Waves Cleared • Area Secured
          </motion.p>
        </div>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
          className="grid grid-cols-3 gap-1 md:gap-4 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl mb-12 overflow-hidden"
        >
          {[
            { label: '擊殺總數', val: kills, color: '#fff' },
            { label: '波次', val: '10/10', color: '#fbbf24' },
            { label: '存活人數', val: `${playerCount}P`, color: '#fff' }
          ].map((item, i) => (
            <div key={i} className="px-6 py-4 text-center bg-black/40 min-w-[100px] md:min-w-[140px]">
              <p className="text-[10px] text-neutral-500 font-bold tracking-tighter uppercase mb-1">{item.label}</p>
              <p className="text-2xl font-black italic" style={{ color: item.color }}>{item.val}</p>
            </div>
          ))}
        </motion.div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(245,158,11,0.4)' }}
          whileTap={{ scale: 0.95 }}
          onClick={onMainMenu}
          className="group relative px-12 py-4 rounded-full font-black text-lg tracking-widest overflow-hidden transition-all"
          style={{
            background: 'linear-gradient(to right, #92400e, #d97706, #92400e)',
            backgroundSize: '200% auto',
            color: '#fff',
            boxShadow: '0 10px 40px -10px rgba(245,158,11,0.5)',
          }}
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative">回到基地</span>
        </motion.button>
      </motion.div>

      {/* Fullscreen Glitter Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-yellow-200 rounded-full"
            initial={{ 
              x: `${Math.random() * 100}%`, 
              y: '-10%',
              opacity: 0 
            }}
            animate={{ 
              y: '110%',
              opacity: [0, 1, 0],
              x: `${(Math.random() * 100) + (Math.sin(i) * 5)}%`
            }}
            transition={{ 
              duration: 2 + Math.random() * 3, 
              repeat: Infinity, 
              delay: Math.random() * 5 
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

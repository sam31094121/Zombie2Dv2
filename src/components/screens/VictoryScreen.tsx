// ── VictoryScreen.tsx ─────────────────────────────────────────────────────────
// 競技場模式通關畫面 (Ultra Premium Visuals)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  kills: number;
  playerCount: number;
  onMainMenu: () => void;
}

const GodRays: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
    {Array.from({ length: 12 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute top-1/2 left-1/2 w-[200%] h-[40px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent)',
          transformOrigin: 'left center',
          top: '50%',
          left: '50%',
        }}
        animate={{ 
          rotate: [i * 30, i * 30 + 360],
        }}
        transition={{ 
          duration: 20, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      />
    ))}
  </div>
);

const Particle: React.FC<{ delay: number }> = ({ delay }) => (
  <motion.div
    initial={{ y: '110vh', x: `${Math.random() * 100}vw`, scale: 0, rotate: 0 }}
    animate={{ 
      y: '-10vh', 
      scale: [0, 1, 0.5], 
      rotate: 360,
      x: `${(Math.random() * 100) + (Math.sin(delay) * 10)}vw` 
    }}
    transition={{ duration: 4 + Math.random() * 2, delay, repeat: Infinity, ease: "linear" }}
    className="absolute w-2 h-2 bg-yellow-400 rounded-sm opacity-60"
    style={{ boxShadow: '0 0 10px #fbbf24' }}
  />
);

export const VictoryScreen: React.FC<Props> = ({ kills, playerCount, onMainMenu }) => {
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    // 數字跳動效果
    const duration = 2000;
    const steps = 60;
    const increment = kills / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= kills) {
        setCounter(kills);
        clearInterval(timer);
      } else {
        setCounter(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [kills]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #251a05 0%, #050402 100%)',
      }}
    >
      {/* 1. 進入時的閃光衝擊波 */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute w-64 h-64 bg-white rounded-full z-[110] pointer-events-none"
      />

      {/* 2. 背景上帝之光 */}
      <GodRays />

      {/* 3. 上升的慶祝粒子 */}
      {Array.from({ length: 30 }).map((_, i) => <Particle key={i} delay={i * 0.2} />)}

      {/* 4. 主要內容 */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* 勳章/獎盃 */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.5 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-yellow-500 blur-[60px] opacity-40 animate-pulse" />
          <div className="text-9xl filter drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]">🏆</div>
        </motion.div>

        {/* 標題 */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-amber-600 mb-2"
            style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.4))' }}
          >
            完全勝利
          </motion.h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="h-[2px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent"
          />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="text-amber-500/80 font-bold tracking-[0.4em] text-sm mt-4 uppercase"
          >
            Ultimate Survivor • Wave 10 Cleared
          </motion.p>
        </div>

        {/* 數據看板 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
          className="flex gap-4 p-1 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-16"
        >
          <div className="px-10 py-6 text-center border-r border-white/10">
            <p className="text-[10px] text-neutral-400 font-black tracking-widest uppercase mb-1">擊殺總數</p>
            <p className="text-4xl font-black text-white italic">{counter}</p>
          </div>
          <div className="px-10 py-6 text-center border-r border-white/10">
            <p className="text-[10px] text-neutral-400 font-black tracking-widest uppercase mb-1">完成進度</p>
            <p className="text-4xl font-black text-yellow-400 italic">100%</p>
          </div>
          <div className="px-10 py-6 text-center">
            <p className="text-[10px] text-neutral-400 font-black tracking-widest uppercase mb-1">參與人數</p>
            <p className="text-4xl font-black text-white italic">{playerCount}P</p>
          </div>
        </motion.div>

        {/* 回首頁按鈕 */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(251,191,36,0.5)' }}
          whileTap={{ scale: 0.95 }}
          onClick={onMainMenu}
          className="relative px-16 py-5 rounded-2xl font-black text-xl tracking-[0.2em] overflow-hidden group"
          style={{
            background: 'linear-gradient(to right, #92400e, #fbbf24, #92400e)',
            backgroundSize: '200% auto',
            color: '#000',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <span className="relative z-10">光榮回歸</span>
          <motion.div 
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-white/30 skew-x-12"
          />
        </motion.button>

      </div>
    </motion.div>
  );
};

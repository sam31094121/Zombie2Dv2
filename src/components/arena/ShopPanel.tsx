import React, { useState } from 'react';
import { Player } from '../../game/Player';
import { audioManager } from '../../game/AudioManager';

interface ShopPanelProps {
  player: Player;
  wave: number;
  onNextWave: () => void;
  onBuyUpgrade: (key: string, cost: number) => void;
}

const UPGRADES = [
  { key: 'damage', name: '攻擊力 +15%', desc: '提升所有武器傷害', cost: 25, icon: '⚔️' },
  { key: 'haste', name: '攻速 +15%', desc: '減少攻擊間隔', cost: 25, icon: '⚡' },
  { key: 'agility', name: '移速 +10%', desc: '提升移動速度', cost: 20, icon: '🏃' },
  { key: 'vitality', name: '最大生命 +25', desc: '增加血量上限並回復', cost: 30, icon: '❤️' },
  { key: 'magnet', name: '拾取範圍 +50%', desc: '更容易吸取金幣', cost: 15, icon: '🧲' },
  { key: 'recovery', name: '回復 30 HP', desc: '立即回復生命值', cost: 10, icon: '🩹' },
];

export const ShopPanel: React.FC<ShopPanelProps> = ({ player, wave, onNextWave, onBuyUpgrade }) => {
  const [shopItems, setShopItems] = useState(() => rollItems());
  const [rerollCost, setRerollCost] = useState(10);

  function rollItems() {
    return [...UPGRADES].sort(() => 0.5 - Math.random()).slice(0, 4).map(item => ({ ...item, id: Math.random() }));
  }

  const handleReroll = () => {
    if (player.materials >= rerollCost) {
      audioManager.playPickup();
      onBuyUpgrade('reroll', rerollCost);
      setShopItems(rollItems());
      setRerollCost(prev => prev + 5);
    }
  };

  const handleBuy = (item: any) => {
    if (player.materials >= item.cost) {
      audioManager.playPickup();
      onBuyUpgrade(item.key, item.cost);
      setShopItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#050508] flex flex-col items-center justify-center p-8 text-neutral-200" style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <h2 className="text-5xl font-black mb-1 text-yellow-500 tracking-[0.2em] uppercase">SHOP SYSTEM</h2>
      <p className="text-xl mb-10 text-yellow-500/50 font-bold tracking-widest">WAVE {wave} COMPLETED</p>
      
      <div className="flex items-center gap-6 mb-10 bg-neutral-900/80 p-5 rounded-2xl border-2 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)] backdrop-blur-sm">
        <div className="text-3xl font-black tracking-wider">
          💰 <span className="text-yellow-400">{Math.floor(player.materials)}</span>
        </div>
        <div className="w-1 h-10 bg-neutral-700 rounded-full"></div>
        <div className="flex flex-col text-sm font-bold text-neutral-400 tracking-wider">
          <span>HP // {Math.floor(player.hp)} / {player.maxHp}</span>
          <span>LV // {player.level}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12 w-full max-w-5xl">
        {shopItems.map(item => (
          <div key={item.id} className="bg-neutral-800/80 border-2 border-neutral-700/80 rounded-2xl p-6 flex flex-col items-center text-center hover:border-yellow-500/50 transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-sm">
            <span className="text-5xl mb-4 filter drop-shadow-md">{item.icon}</span>
            <h3 className="font-black text-xl mb-2 tracking-wide text-neutral-100">{item.name}</h3>
            <p className="text-sm text-neutral-400 mb-6 h-10 flex items-center">{item.desc}</p>
            <button
              onClick={() => handleBuy(item)}
              disabled={player.materials < item.cost}
              className={`mt-auto w-full py-3 rounded-xl font-black tracking-widest transition-all ${
                player.materials >= item.cost 
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-neutral-950 shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)]' 
                  : 'bg-neutral-800 border-2 border-neutral-700 text-neutral-500 cursor-not-allowed opacity-50'
              }`}
            >
              PRICE {item.cost}
            </button>
          </div>
        ))}
        {shopItems.length === 0 && (
          <div className="col-span-full py-12 text-center text-neutral-500 font-bold tracking-widest border-2 border-dashed border-neutral-700 rounded-2xl">
            SOLD OUT // ALL ITEMS PURCHASED
          </div>
        )}
      </div>

      <div className="flex gap-6 relative z-10">
        <button
          onClick={handleReroll}
          disabled={player.materials < rerollCost}
          className={`px-8 py-4 rounded-xl font-black border-2 transition-all tracking-widest flex items-center gap-3 ${
            player.materials >= rerollCost
              ? 'border-blue-500 text-blue-400 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
              : 'border-neutral-800 text-neutral-600 bg-neutral-900 cursor-not-allowed'
          }`}
        >
          <span>🎲 REROLL</span>
          <span className="bg-blue-950/50 px-2 py-1 rounded text-sm">💰{rerollCost}</span>
        </button>
        <button
          onClick={onNextWave}
          className="px-12 py-4 rounded-xl font-black bg-white text-black hover:bg-neutral-200 transition-all tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] flex items-center gap-2"
        >
          NEXT WAVE <span className="text-xl">⚔️</span>
        </button>
      </div>
    </div>
  );
};

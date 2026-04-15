import { Zombie, ZombieType } from '../Zombie';

export class ZombiePool {
  private pool: Zombie[] = [];
  
  // 依據玩家的增量建議 (Buffer increment)
  private readonly GROW_SIZE = 10;

  constructor(initialSize: number = 0) {
    this.grow(initialSize);
  }

  /**
   * 擴充物件池
   */
  private grow(count: number) {
    for (let i = 0; i < count; i++) {
      // Create a dummy zombie hidden far away
      this.pool.push(new Zombie(-9999, -9999, 'normal'));
    }
  }

  /**
   * 從物件池取得一隻初始化好的 Zombie
   */
  public get(x: number, y: number, type: ZombieType): Zombie {
    if (this.pool.length === 0) {
      // Pool is empty, use the buffer increment suggested by the user!
      this.grow(this.GROW_SIZE);
    }
    
    const zombie = this.pool.pop()!;
    zombie.init(x, y, type);
    return zombie;
  }

  /**
   * 將喪屍送回物件池
   */
  public release(zombie: Zombie) {
    this.pool.push(zombie);
  }

  /**
   * 取得當前閒置的物件數量（用來 Debug 效能）
   */
  public getAvailableSize(): number {
    return this.pool.length;
  }
}

import { IDestructible } from './Interfaces';

export class DestructibleComponent implements IDestructible {
  constructor(public hp: number, private onBreakCallback: () => void) {}

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) this.onBreak();
  }

  onBreak() {
    this.onBreakCallback();
  }
}

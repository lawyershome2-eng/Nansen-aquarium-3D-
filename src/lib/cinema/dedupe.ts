import type { CinemaEvent } from "./types.ts";

export class Seen {
  private set = new Set<string>();
  private q: string[] = [];
  private cap: number;

  constructor(cap = 5000) {
    this.cap = cap;
  }

  add(id: string): boolean {
    if (this.set.has(id)) return false;
    this.set.add(id);
    this.q.push(id);
    if (this.q.length > this.cap) {
      const old = this.q.shift();
      if (old) this.set.delete(old);
    }
    return true;
  }

  filter(events: CinemaEvent[]): CinemaEvent[] {
    return events.filter((e) => this.add(e.id));
  }
}

import { Room } from 'colyseus.js';

interface GameStateData {
  mode: 'single' | 'multi';
  room: Room | null;
}

export const gameState: GameStateData = {
  mode: 'multi',
  room: null,
};

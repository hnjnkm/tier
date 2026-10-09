import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';

// Choose the containing row first. A thumbnail in another row can otherwise
// be closer than the centre of the wide row under the pointer.
export const boardCollisionDetection: CollisionDetection = args => {
  const pointerCoordinates = args.pointerCoordinates ?? {
    x: args.collisionRect.left + args.collisionRect.width / 2,
    y: args.collisionRect.top + args.collisionRect.height / 2,
  };
  const hits = pointerWithin({ ...args, pointerCoordinates });
  const container = hits.find(hit => hit.id === 'pool' || String(hit.id).startsWith('tier:'));
  if (!container) return [];
  const artist = hits.find(hit => hit.data?.droppableContainer.data.current?.sortable?.containerId === container.id);
  return [artist ?? container];
};

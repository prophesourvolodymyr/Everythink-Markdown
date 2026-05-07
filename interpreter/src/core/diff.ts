import type {
  BlockId,
  Block,
  EmdSection,
  SectionType,
  CodeBlockTag,
  BlockChange,
  BlockTreeSnapshot,
} from './types';

export function computeDiff(
  currentBlocks: Map<BlockId, Block>,
  newSections: EmdSection[],
  applySectionType: (section: EmdSection) => string,
  applyCodeBlockTag: (tag?: CodeBlockTag) => string,
): BlockChange[] {
  const changes: BlockChange[] = [];
  const oldMap = new Map<BlockId, Block>();
  for (const block of currentBlocks.values()) {
    oldMap.set(block.id, block);
  }

  const newMap = new Map<BlockId, { section: EmdSection; parentId: BlockId | null }>();
  const snapshot = takeSnapshot(currentBlocks);
  const seen = new Set<BlockId>();

  function walkSections(
    sections: EmdSection[],
    parentId: BlockId | null,
    depth: number,
    orderStart: number,
  ): { blockIds: BlockId[]; order: number } {
    const blockIds: BlockId[] = [];
    let order = orderStart;

    for (const section of sections) {
      const typeKey = applySectionType(section);
      const blockId = sectionToBlockId(section, typeKey, parentId);
      blockIds.push(blockId);
      seen.add(blockId);
      newMap.set(blockId, { section, parentId });

      if (!oldMap.has(blockId)) {
        changes.push({
          type: 'add',
          block_id: blockId,
          new_parent: parentId,
          new_index: blockIds.length - 1,
          new_state: snapshot,
        });
      } else {
        const old = oldMap.get(blockId)!;
        if (old.parent_id !== parentId || old.order !== order) {
          changes.push({
            type: 'move',
            block_id: blockId,
            previous_parent: old.parent_id,
            new_parent: parentId,
            previous_index: old.order,
            new_index: blockIds.length - 1,
          });
        }
        const sectionChanged = JSON.stringify(old.section) !== JSON.stringify(section);
        if (sectionChanged) {
          changes.push({
            type: 'update',
            block_id: blockId,
            previous_state: snapshot,
          });
        }
      }

      order++;

      const childResult = walkSections(section.subsections, blockId, depth + 1, 0);
      changes.push(
        ...childResult
          .blockIds.map((cid, idx) => {
            const childBlock = oldMap.get(cid);
            if (childBlock && childBlock.parent_id !== blockId) {
              return {
                type: 'reparent' as const,
                block_id: cid,
                previous_parent: childBlock.parent_id,
                new_parent: blockId,
                previous_index: childBlock.order,
                new_index: idx,
              };
            }
            return null;
          })
          .filter(Boolean) as BlockChange[],
      );
      order += childResult.blockIds.length;
    }

    return { blockIds, order };
  }

  walkSections(newSections, null, 0, 0);

  for (const block of currentBlocks.values()) {
    if (!seen.has(block.id)) {
      changes.push({
        type: 'remove',
        block_id: block.id,
        previous_parent: block.parent_id,
        previous_index: block.order,
        previous_state: snapshot,
      });
    }
  }

  return changes;
}

export function takeSnapshot(blocks: Map<BlockId, Block>): BlockTreeSnapshot {
  const snapshot: BlockTreeSnapshot = {
    block_ids: [],
    parent_map: {},
    order_map: {},
    type_map: {},
  };

  for (const block of blocks.values()) {
    snapshot.block_ids.push(block.id);
    snapshot.parent_map[block.id] = block.parent_id;
    snapshot.order_map[block.id] = block.order;
    snapshot.type_map[block.id] = block.plugin_id;
  }

  return snapshot;
}

export function restoreSnapshot(
  snapshot: BlockTreeSnapshot,
  pluginMap: Map<string, string>,
): Map<BlockId, Partial<Block>> {
  const result = new Map<BlockId, Partial<Block>>();

  for (const blockId of snapshot.block_ids) {
    const pluginId = snapshot.type_map[blockId] ?? 'fallback';
    result.set(blockId, {
      id: blockId,
      parent_id: snapshot.parent_map[blockId] ?? null,
      order: snapshot.order_map[blockId] ?? 0,
      plugin_id: pluginId,
    });
  }

  return result;
}

function sectionToBlockId(
  section: EmdSection,
  typeKey: string,
  parentId: BlockId | null,
): BlockId {
  const source = section.source_span;
  const parentPrefix = parentId ? `${parentId}::` : '';
  return `${parentPrefix}${typeKey}:${source.start_line}:${section.title.slice(0, 30)}`;
}

export function generateBlockId(
  type: string,
  index: number,
  parentId: BlockId | null,
): BlockId {
  const parentPrefix = parentId ? `${parentId}::` : '';
  return `${parentPrefix}${type}:${index}`;
}

export function minimalDomDiff(
  oldIds: BlockId[],
  newIds: BlockId[],
): {
  added: BlockId[];
  removed: BlockId[];
  moved: { id: BlockId; from: number; to: number }[];
} {
  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);

  const added = newIds.filter((id) => !oldSet.has(id));
  const removed = oldIds.filter((id) => !newSet.has(id));
  const moved: { id: BlockId; from: number; to: number }[] = [];

  for (let i = 0; i < newIds.length; i++) {
    const id = newIds[i]!;
    if (oldSet.has(id)) {
      const oldIdx = oldIds.indexOf(id);
      if (oldIdx !== i) {
        moved.push({ id, from: oldIdx, to: i });
      }
    }
  }

  return { added, removed, moved };
}

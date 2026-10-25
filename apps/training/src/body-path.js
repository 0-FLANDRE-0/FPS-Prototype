// Split overlapping closed meshes at all boundaries. Core meshes precede joint
// covers; each occupied length receives exactly one resistance class.
export function unionBodyIntervals(intervals) {
  const bounds = [...new Set(intervals.flatMap(i => [i.entry, i.exit]))].sort((a, b) => a - b);
  const paths = [];
  for (let index = 0; index < bounds.length - 1; index++) {
    const entry = bounds[index], exit = bounds[index + 1], middle = (entry + exit) / 2;
    if (exit - entry < 1e-7) continue;
    const active = intervals.filter(i => i.entry <= middle && i.exit >= middle)
      .sort((a, b) => Number(a.shape.joint) - Number(b.shape.joint) || a.entry - b.entry || a.shape.id.localeCompare(b.shape.id));
    if (!active.length) continue;
    const selected = active[0], last = paths.at(-1);
    if (last && entry - last.exit < 1e-7) {
      last.exit = exit; last.completeExit = active.some(i => i.exit === exit && i.completeExit);
      last.cells.push({ entry, exit, shape: selected.shape });
    } else paths.push({ entry, exit, completeExit: selected.completeExit, source: selected,
      cells: [{ entry, exit, shape: selected.shape }] });
  }
  return paths;
}

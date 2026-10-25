import { Ray, Triangle, Vector3 } from 'three';

// Horizontal cylindrical bend. The two radii retain nominal normal thickness;
// the indexed faces approximate the cylinder without filling its concave back.
export function bentPanelMesh(shape) {
  const { width, height, radius, thickness = 0, segments = 16, outline } = shape;
  const xs = [...new Set([...Array.from({ length: segments + 1 }, (_, i) => width * (i / segments - .5)),
    ...(outline || []).map(([u]) => (u - .5) * width)])].sort((a, b) => a - b);
  const top = x => {
    const u = x / width + .5;
    const border = outline || [[0, 0], [1, 0], [1, 1], [0, 1]];
    let v = 1;
    for (let i = 0; i < border.length; i++) {
      const [a, b] = [border[i], border[(i + 1) % border.length]];
      if (a[0] !== b[0] && u >= Math.min(a[0], b[0]) - 1e-9 && u <= Math.max(a[0], b[0]) + 1e-9)
        v = Math.min(v, a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]));
    }
    return (.5 - v) * height;
  };
  const vertices = [], indices = [];
  const layers = thickness ? [-1, 1] : [0];
  for (const x of xs) {
    const angle = Math.asin(x / radius);
    for (const sign of layers) {
      const r = radius + sign * thickness / 2;
      for (const y of [-height / 2, top(x)]) vertices.push(r * Math.sin(angle), y, r * Math.cos(angle) - radius);
    }
  }
  const stride = layers.length * 2;
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * stride, b = a + stride;
    if (!thickness) { quad(a, b, b + 1, a + 1); continue; }
    quad(a, a + 1, b + 1, b); // inward face
    quad(a + 2, b + 2, b + 3, a + 3); // outward face
    quad(a, b, b + 2, a + 2); // bottom
    quad(a + 1, a + 3, b + 3, b + 1); // top / shooter cut
  }
  if (thickness) {
    quad(0, 2, 3, 1);
    const a = (xs.length - 1) * stride; quad(a, a + 1, a + 3, a + 2);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

// Geometric approximation only. Curve radii are documented tuning, not a
// manufacturer ballistic property. Two offset surfaces keep a closed solid.
export function multiCurvePlateMesh(shape){
 const{width,height,radius,verticalRadius,thickness,segments=16,outline}=shape,rows=8,vertices=[],indices=[];
 const xs=[...new Set([...Array.from({length:segments+1},(_,i)=>width*(i/segments-.5)),...outline.map(([u])=>(u-.5)*width)])].sort((a,b)=>a-b);
 const top=x=>{const u=x/width+.5;let v=1;for(let i=0;i<outline.length;i++){const[a,b]=[outline[i],outline[(i+1)%outline.length]];if(a[0]!==b[0]&&u>=Math.min(a[0],b[0])-1e-9&&u<=Math.max(a[0],b[0])+1e-9)v=Math.min(v,a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]));}return(.5-v)*height;};
 for(const sign of[-1,1])for(const x of xs)for(let j=0;j<=rows;j++){const y=-height/2+(top(x)+height/2)*j/rows,rx=Math.sqrt(radius*radius-x*x),ry=Math.sqrt(verticalRadius*verticalRadius-y*y),z=rx-radius+ry-verticalRadius,n=new Vector3(x/rx,y/ry,1).normalize();vertices.push(x+sign*n.x*thickness/2,y+sign*n.y*thickness/2,z+sign*n.z*thickness/2);}
 const layer=xs.length*(rows+1),v=(i,j)=>i*(rows+1)+j,quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let i=0;i<xs.length-1;i++){for(let j=0;j<rows;j++){const a=v(i,j),b=v(i+1,j);quad(a,a+1,b+1,b);quad(a+layer,b+layer,b+1+layer,a+1+layer);}const a=v(i,0),b=v(i+1,0),c=v(i,rows),d=v(i+1,rows);quad(a,b,b+layer,a+layer);quad(c,c+layer,d+layer,d);}
 for(let j=0;j<rows;j++){let a=v(0,j);quad(a,a+layer,a+1+layer,a+1);a=v(xs.length-1,j);quad(a,a+1,a+1+layer,a+layer);}
 return{vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}

export function meshTriangles(vertices, indices) {
  const triangles=Array.from({ length: indices.length / 3 }, (_, i) => {
    const triangle = new Triangle(...Array.from(indices.slice(i * 3, i * 3 + 3), id => new Vector3().fromArray(vertices, id * 3)));
    return { triangle, normal: triangle.getNormal(new Vector3()) };
  });
  meshTrees.set(triangles,buildMeshTree(triangles));return triangles;
}

// Static local-space BVH, built with the sensor mesh rather than on firing.
// Query the entire forward ray: solidMeshIntervals needs far exits as well as
// near intersections to reconstruct winding for an inside start. Sort retained
// indices into source order before the unchanged narrow phase and stable sort.
const meshTrees=new WeakMap();
function buildMeshTree(triangles){
 const boxes=triangles.map(({triangle:{a,b,c}})=>[Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.min(a.z,b.z,c.z),Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y),Math.max(a.z,b.z,c.z)]);
 const build=ids=>{const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const id of ids)for(let i=0;i<3;i++){bounds[i]=Math.min(bounds[i],boxes[id][i]);bounds[i+3]=Math.max(bounds[i+3],boxes[id][i+3]);}
  if(ids.length<=12)return{bounds,ids};let axis=0;for(let i=1;i<3;i++)if(bounds[i+3]-bounds[i]>bounds[axis+3]-bounds[axis])axis=i;
  ids.sort((a,b)=>(boxes[a][axis]+boxes[a][axis+3])-(boxes[b][axis]+boxes[b][axis+3])||a-b);const m=ids.length>>1;return{bounds,left:build(ids.slice(0,m)),right:build(ids.slice(m))};
 };return build(boxes.map((_,i)=>i));
}
function rayBounds(bounds,origin,direction){
 let lo=0,hi=Infinity;
 for(let i=0;i<3;i++){const axis=i===0?'x':i===1?'y':'z',o=origin[axis],d=direction[axis],a=bounds[i]-1e-8,b=bounds[i+3]+1e-8;
  if(d===0){if(o<a||o>b)return false;continue;}const t0=(a-o)/d,t1=(b-o)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
 }return true;
}
function rayTriangles(triangles,origin,direction){
 const tree=meshTrees.get(triangles);if(!tree)return triangles;
 const ids=[],visit=node=>{if(!rayBounds(node.bounds,origin,direction))return;if(node.ids)ids.push(...node.ids);else{visit(node.left);visit(node.right);}};visit(tree);ids.sort((a,b)=>a-b);return ids.map(i=>triangles[i]);
}

// Open shell: preserve source winding to distinguish an outer entry from an
// inner exit. Rapier returns a ray-facing normal on both sides of a trimesh.
export function firstMeshSurface(triangles, origin, direction, distance) {
  const ray = new Ray(origin, direction), point = new Vector3();
  let first = null;
  for (const { triangle, normal } of rayTriangles(triangles,origin,direction)) {
    if (!ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, point)) continue;
    const entryDistance = point.clone().sub(origin).dot(direction);
    if (entryDistance < 0 || entryDistance > distance || first && entryDistance >= first.entryDistance) continue;
    first = { entryDistance, exitingSurface: normal.dot(direction) > 0 };
  }
  return first;
}

// Closed, consistently wound solid only. Merge shared-edge/diagonal hits, cancel
// tangencies, and retain separate material intervals (never an air-filled hull).
export function solidMeshIntervals(triangles, origin, direction, distance) {
  const ray = new Ray(origin, direction), intersections = [], point = new Vector3();
  for (const { triangle, normal } of rayTriangles(triangles,origin,direction)) {
    const dot = normal.dot(direction);
    if (Math.abs(dot) < 1e-9 || !ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, point)) continue;
    intersections.push({ t: Math.max(0, point.clone().sub(origin).dot(direction)), dot, normal });
  }
  intersections.sort((a, b) => a.t - b.t);
  const events = [];
  for (const hit of intersections) {
    let group = events.at(-1);
    if (!group || Math.abs(group.t - hit.t) > 1e-7) { group = { t: hit.t, enter: false, exit: false, normal: hit.normal, dot: hit.dot }; events.push(group); }
    if (hit.dot < 0) group.enter = true; else group.exit = true;
    if (Math.abs(hit.dot) > Math.abs(group.dot)) { group.normal = hit.normal; group.dot = hit.dot; }
  }
  for (const event of events) event.delta = event.enter === event.exit ? 0 : event.enter ? 1 : -1;
  let winding = -events.reduce((sum, event) => sum + event.delta, 0);
  const startsInside = winding > 0, intervals = [];
  let entry = startsInside ? { t: 0, normal: new Vector3() } : null;
  for (const event of events) {
    const next = winding + event.delta;
    if (winding <= 0 && next > 0) entry = event;
    if (winding > 0 && next <= 0 && entry && entry.t < distance) {
      const exit = Math.min(distance, event.t);
      if (exit - entry.t > 1e-7) intervals.push({ entry: entry.t, exit, normal: entry.normal,
        startsInside: startsInside && entry.t === 0, completeExit: event.t <= distance + 1e-7 });
      entry = null;
    }
    winding = next;
  }
  return intervals;
}

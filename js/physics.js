/**
 * The Gritty Western — ricochet math
 *
 * Reflection of a velocity vector v across a unit surface normal n:
 *   v' = v - 2 (v · n) n
 * Then scale by restitution e (0 = dead stop, 1 = perfect bounce).
 *
 * Swept-circle casts keep fast slugs from tunneling through thin pans.
 */
(function (root) {
  const GW = (root.GW = root.GW || {});

  const EPS = 1e-6;

  function vlen(x, y) {
    return Math.hypot(x, y);
  }

  function vnorm(x, y) {
    const l = Math.hypot(x, y);
    if (l < EPS) return { x: 0, y: -1 };
    return { x: x / l, y: y / l };
  }

  function vdot(ax, ay, bx, by) {
    return ax * bx + ay * by;
  }

  /**
   * Reflect velocity (vx, vy) across unit normal (nx, ny).
   * Incoming velocity should point toward the surface (dot with n is negative).
   */
  function reflect(vx, vy, nx, ny, restitution) {
    const e = restitution == null ? 1 : restitution;
    const d = vx * nx + vy * ny;
    return {
      x: (vx - 2 * d * nx) * e,
      y: (vy - 2 * d * ny) * e,
    };
  }

  /**
   * Closest point on segment A→B to point P.
   */
  function closestOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 < EPS) return { x: ax, y: ay, t: 0 };
    let t = ((px - ax) * abx + (py - ay) * aby) / ab2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return { x: ax + abx * t, y: ay + aby * t, t };
  }

  /**
   * Outward unit normal of segment A→B that faces point P
   * (or faces against incoming velocity if P is unused).
   */
  function segmentNormal(ax, ay, bx, by, fromX, fromY) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    // Left-hand normal of A→B
    let nx = -dy / len;
    let ny = dx / len;
    const midX = (ax + bx) * 0.5;
    const midY = (ay + by) * 0.5;
    if ((fromX - midX) * nx + (fromY - midY) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  }

  /**
   * First hit of a swept circle (x,y,r) moving by (dx,dy) against a static circle.
   * Returns t in [0,1] or null.
   */
  function sweepCircleCircle(x, y, r, dx, dy, cx, cy, cr) {
    const fx = x - cx;
    const fy = y - cy;
    const rad = r + cr;
    const a = dx * dx + dy * dy;
    if (a < EPS) {
      if (fx * fx + fy * fy <= rad * rad) return { t: 0, nx: 0, ny: -1 };
      return null;
    }
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - rad * rad;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    let t = (-b - s) / (2 * a);
    if (t < -EPS) t = (-b + s) / (2 * a);
    if (t < -EPS || t > 1 + EPS) return null;
    t = Math.max(0, Math.min(1, t));
    const hx = fx + dx * t;
    const hy = fy + dy * t;
    const n = vnorm(hx, hy);
    return { t, nx: n.x, ny: n.y };
  }

  /**
   * Swept circle vs capsule of a segment (the segment thickened by `sr`).
   */
  function sweepCircleSegment(x, y, r, dx, dy, ax, ay, bx, by, sr) {
    const rad = r + sr;
    // Treat as moving point vs stadium: expand segment by rad.
    // Quadratic against infinite line, then clamp to ends (circles).
    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 < EPS) return sweepCircleCircle(x, y, r, dx, dy, ax, ay, sr);

    // Moving point (x,y) + t(dx,dy) vs infinite line, distance = rad
    // Closest point on infinite line to (x,y)+t d
    // Let w(t) = P(t) - A, t_seg = (w · AB) / |AB|^2
    // |w - t_seg AB| = rad
    const px = x - ax;
    const py = y - ay;
    const a = dx * dx + dy * dy;
    const bdot = 2 * (px * dx + py * dy);
    // Projected coefficients
    const invAb2 = 1 / ab2;
    const dAb = dx * abx + dy * aby;
    const pAb = px * abx + py * aby;

    // | (P-A) + t D - ((P-A+tD)·AB / ab2) AB |^2 = rad^2
    const qx = px - abx * pAb * invAb2;
    const qy = py - aby * pAb * invAb2;
    const rx = dx - abx * dAb * invAb2;
    const ry = dy - aby * dAb * invAb2;
    const aa = rx * rx + ry * ry;
    const bb = 2 * (qx * rx + qy * ry);
    const cc = qx * qx + qy * qy - rad * rad;

    let best = null;

    function consider(t, hx, hy) {
      if (t < -EPS || t > 1 + EPS) return;
      t = Math.max(0, Math.min(1, t));
      if (best && t >= best.t) return;
      const n = vnorm(hx, hy);
      best = { t, nx: n.x, ny: n.y };
    }

    if (aa > EPS) {
      const disc = bb * bb - 4 * aa * cc;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        for (const sign of [-1, 1]) {
          const t = (-bb + sign * s) / (2 * aa);
          if (t < -EPS || t > 1 + EPS) continue;
          const tt = Math.max(0, Math.min(1, t));
          const ix = x + dx * tt;
          const iy = y + dy * tt;
          const cl = closestOnSegment(ix, iy, ax, ay, bx, by);
          const onInterior = cl.t > 0.001 && cl.t < 0.999;
          if (!onInterior) continue;
          consider(tt, ix - cl.x, iy - cl.y);
        }
      }
    }

    const aHit = sweepCircleCircle(x, y, r, dx, dy, ax, ay, sr);
    const bHit = sweepCircleCircle(x, y, r, dx, dy, bx, by, sr);
    if (aHit) consider(aHit.t, (x + dx * aHit.t) - ax, (y + dy * aHit.t) - ay);
    if (bHit) consider(bHit.t, (x + dx * bHit.t) - bx, (y + dy * bHit.t) - by);

    return best;
  }

  const MATERIALS = {
    metal: { restitution: 0.88, absorb: false, spark: true, ping: true },
    hoop: { restitution: 0.8, absorb: false, spark: true, ping: true },
    pan: { restitution: 0.94, absorb: false, spark: true, ping: true, spin: true },
    wood: { restitution: 0.12, absorb: true, spark: false, ping: false },
    adobe: { restitution: 0.05, absorb: true, spark: false, ping: false },
    flesh: { restitution: 0, absorb: true, spark: false, ping: false, lethal: true },
    dirt: { restitution: 0, absorb: true, spark: false, ping: false },
  };

  /**
   * Cast a bullet through the world.
   * World bodies:
   *   { kind:'circle', x, y, r, material, id, tag }
   *   { kind:'segment', ax, ay, bx, by, r, material, id, tag }
   *
   * Returns an array of path nodes:
   *   { x, y, vx, vy, bounce, hit }
   */
  function traceShot(origin, dir, bodies, opts) {
    const o = opts || {};
    const speed = o.speed || 1800;
    const radius = o.radius == null ? 4 : o.radius;
    const maxBounces = o.maxBounces == null ? 5 : o.maxBounces;
    const maxDist = o.maxDist || 6000;
    const dt = o.step || 1 / 240;
    const n = vnorm(dir.x, dir.y);
    let x = origin.x + n.x * (o.muzzle || 18);
    let y = origin.y + n.y * (o.muzzle || 18);
    let vx = n.x * speed;
    let vy = n.y * speed;
    let bounces = 0;
    let traveled = 0;
    const path = [{ x, y, vx, vy, bounce: 0, hit: null }];
    const ignore = new Set();

    for (let i = 0; i < 400; i++) {
      const step = speed * dt;
      const dx = vx * dt;
      const dy = vy * dt;
      let best = null;
      let bestBody = null;

      for (const body of bodies) {
        if (!body || body.dead) continue;
        if (ignore.has(body.id)) continue;
        let hit = null;
        if (body.kind === "circle") {
          hit = sweepCircleCircle(x, y, radius, dx, dy, body.x, body.y, body.r);
        } else if (body.kind === "segment") {
          hit = sweepCircleSegment(
            x,
            y,
            radius,
            dx,
            dy,
            body.ax,
            body.ay,
            body.bx,
            body.by,
            body.r || 4
          );
        }
        if (hit && (!best || hit.t < best.t)) {
          best = hit;
          bestBody = body;
        }
      }

      if (best && bestBody) {
        const t = Math.max(0, best.t);
        x += dx * t;
        y += dy * t;
        traveled += step * t;
        const mat = MATERIALS[bestBody.material] || MATERIALS.metal;
        const hitInfo = {
          body: bestBody,
          nx: best.nx,
          ny: best.ny,
          material: bestBody.material,
          x,
          y,
        };
        path.push({ x, y, vx, vy, bounce: bounces, hit: hitInfo });

        const pierce =
          o.chain &&
          mat.lethal &&
          bounces >= 1 &&
          bestBody.tag !== "head";

        if (mat.absorb || (mat.lethal && !pierce) || bounces >= maxBounces) {
          return { path, end: hitInfo, bounces, absorbed: true };
        }

        if (pierce) {
          ignore.add(bestBody.id);
          const rootId = String(bestBody.id).replace(/-head$/, "");
          ignore.add(rootId);
          ignore.add(rootId + "-head");
          x += best.nx * 1.2 + vx * dt * 0.2;
          y += best.ny * 1.2 + vy * dt * 0.2;
          vx *= 0.82;
          vy *= 0.82;
          continue;
        }

        // Push out of surface so we don't recollide
        x += best.nx * 0.6;
        y += best.ny * 0.6;
        const bounced = reflect(vx, vy, best.nx, best.ny, mat.restitution);
        vx = bounced.x;
        vy = bounced.y;
        // Re-normalize to remaining speed (tiny gravity-free slug)
        const sp = Math.hypot(vx, vy);
        if (sp < 80) {
          return { path, end: hitInfo, bounces, absorbed: true };
        }
        bounces += 1;
        ignore.clear();
        ignore.add(bestBody.id);
        path.push({ x, y, vx, vy, bounce: bounces, hit: null });
      } else {
        x += dx;
        y += dy;
        traveled += step;
        if (traveled >= maxDist) {
          path.push({ x, y, vx, vy, bounce: bounces, hit: null });
          return { path, end: null, bounces, absorbed: false };
        }
      }
    }
    path.push({ x, y, vx, vy, bounce: bounces, hit: null });
    return { path, end: null, bounces, absorbed: false };
  }

  /**
   * Dense polyline of a trace for drawing the ghost sight.
   */
  function flattenPath(trace, samples) {
    const pts = [];
    const path = trace.path;
    for (let i = 0; i < path.length; i++) pts.push({ x: path[i].x, y: path[i].y, bounce: path[i].bounce });
    return pts;
  }

  GW.physics = {
    EPS,
    vlen,
    vnorm,
    vdot,
    reflect,
    closestOnSegment,
    segmentNormal,
    sweepCircleCircle,
    sweepCircleSegment,
    MATERIALS,
    traceShot,
    flattenPath,
  };
})(typeof window !== "undefined" ? window : globalThis);

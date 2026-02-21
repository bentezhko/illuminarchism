export const lerp = (start, end, t) => start * (1 - t) + end * t;

export function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function distSq(p1, p2) {
    return Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
}

export function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function distanceToSegment(p, v, w) {
    function sqr(x) { return x * x }
    function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
    let l2 = dist2(v, w);
    if (l2 === 0) return distance(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

// --- Geometric Helpers ---
export function getSignedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % points.length;
        area += (points[i].x * points[j].y) - (points[j].x * points[i].y);
    }
    return area / 2.0;
}

export function getCentroid(points) {
    let cx = 0, cy = 0;
    if (points.length === 0) return { x: 0, y: 0 };
    for (let p of points) { cx += p.x; cy += p.y; }
    return { x: cx / points.length, y: cy / points.length };
}

export function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

export function enforceClockwise(points) {
    if (getSignedArea(points) < 0) {
        return points.reverse();
    }
    return points;
}

export function alignPolygonClosed(poly1, poly2) {
    if (poly1.length !== poly2.length) return poly2;
    let minTotalDist = Infinity;
    let bestOffset = 0;
    const N = poly1.length;
    for (let offset = 0; offset < N; offset++) {
        let currentDist = 0;
        for (let i = 0; i < N; i++) {
            currentDist += distSq(poly1[i], poly2[(i + offset) % N]);
        }
        if (currentDist < minTotalDist) {
            minTotalDist = currentDist;
            bestOffset = offset;
        }
    }
    const aligned = [];
    for (let i = 0; i < N; i++) {
        aligned.push(poly2[(i + bestOffset) % N]);
    }
    return aligned;
}

export function alignPolylineOpen(poly1, poly2) {
    let distNormal = 0;
    for (let i = 0; i < Math.min(poly1.length, poly2.length); i++) distNormal += distSq(poly1[i], poly2[i]);
    let distReversed = 0;
    const len = poly2.length;
    for (let i = 0; i < Math.min(poly1.length, poly2.length); i++) distReversed += distSq(poly1[i], poly2[len - 1 - i]);
    if (distReversed < distNormal) return [...poly2].reverse();
    return poly2;
}

export function resampleGeometry(points, targetCount, isClosed = true) {
    if (!points || points.length < 2) return points;
    let sourcePoints = isClosed ? enforceClockwise([...points]) : points;
    let totalLength = 0;
    const segments = isClosed ? sourcePoints.length : sourcePoints.length - 1;
    for (let i = 0; i < segments; i++) {
        totalLength += distance(sourcePoints[i], sourcePoints[(i + 1) % sourcePoints.length]);
    }
    const step = totalLength / targetCount;
    const newPoints = [];
    let currentDist = 0, currentIdx = 0, nextIdx = 1;
    let segmentDist = distance(sourcePoints[0], sourcePoints[1]);
    let distTraveledOnSegment = 0;
    newPoints.push({ x: sourcePoints[0].x, y: sourcePoints[0].y });
    const loopLimit = isClosed ? targetCount : targetCount - 1;
    for (let i = 1; i < loopLimit; i++) {
        currentDist += step;
        if (segmentDist === 0) {
            currentIdx = nextIdx;
            nextIdx = (nextIdx + 1) % sourcePoints.length;
            segmentDist = distance(sourcePoints[currentIdx], sourcePoints[nextIdx]);
            continue;
        }
        while (distTraveledOnSegment + step > segmentDist) {
            const remainingOnSeg = segmentDist - distTraveledOnSegment;
            currentDist -= remainingOnSeg;
            currentIdx = nextIdx;
            nextIdx = (nextIdx + 1);
            if (isClosed) nextIdx = nextIdx % sourcePoints.length;
            if (!isClosed && nextIdx >= sourcePoints.length) break;
            segmentDist = distance(sourcePoints[currentIdx], sourcePoints[nextIdx]);
            distTraveledOnSegment = 0;
            if (segmentDist === 0) break;
        }
        distTraveledOnSegment += step;
        const t = distTraveledOnSegment / segmentDist;
        const x = lerp(sourcePoints[currentIdx].x, sourcePoints[nextIdx].x, t) || sourcePoints[currentIdx].x;
        const y = lerp(sourcePoints[currentIdx].y, sourcePoints[nextIdx].y, t) || sourcePoints[currentIdx].y;
        newPoints.push({ x, y });
    }
    if (!isClosed && newPoints.length < targetCount) newPoints.push({ ...sourcePoints[sourcePoints.length - 1] });
    return newPoints;
}

export function escapeHTML(str) {
    if (str == null) return '';
    return str.toString().replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

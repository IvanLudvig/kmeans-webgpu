import { WORKGROUP_SIZE, K } from '../config.js';

export default `
    @group(0) @binding(0) var<storage> points: array<f32>;
    @group(0) @binding(1) var<storage> centroids: array<f32>;
    @group(1) @binding(1) var<storage, read_write> clusters: array<u32>;

    fn dist(a: vec2f, b: vec2f) -> f32 {
        return pow((a.x - b.x), 2) + pow((a.y - b.y), 2);
    }

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn cs(@builtin(global_invocation_id) id: vec3u) {
        let pointId = id.x;
        let pos = vec2f(points[2*pointId], points[2*pointId + 1]);
        var min_dist = -1.;
        var closest = 0;

        for (var i = 0; i < ${K}; i++) {
            let centroid = vec2f(centroids[2*i], centroids[2*i + 1]);
            let d = dist(pos, centroid);
            if (min_dist == -1 || d < min_dist){
                closest = i;
                min_dist = d;
            }
        }

        clusters[pointId] = u32(closest);
    }
`;

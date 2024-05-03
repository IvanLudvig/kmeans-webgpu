import { N } from '../config.js';

export default `
    @group(0) @binding(0) var<storage> points: array<f32>;
    @group(0) @binding(2) var<storage> clusters: array<u32>;
    @group(1) @binding(0) var<storage, read_write> centroids: array<f32>;

    @compute @workgroup_size(4)
    fn cs(@builtin(global_invocation_id) id: vec3u) {
        let centroid = id.x;
        var sum = vec2f(0);
        var num = 0;

        for (var i = 0; i < ${N}; i++) {
            if (clusters[i] == centroid) {
                sum += vec2f(points[2*i], points[2*i + 1]);
                num += 1;
            }
        }

        centroids[2*centroid] = sum.x / f32(num);
        centroids[2*centroid + 1] = sum.y / f32(num);
    }
`;

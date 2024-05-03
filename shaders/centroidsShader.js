import { RESOLUTION } from '../config.js';

export default `
    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) @interpolate(flat) cluster: u32
    };

    @group(0) @binding(1) var<storage> centroids: array<f32>;

    @vertex
    fn vs(
        @location(0) vertex: vec2f,
        @builtin(instance_index) i: u32
    ) -> VertexOutput {
        let position = 2 * vec2f(centroids[2*i], centroids[2*i + 1]) - 1 + 6*vertex/${RESOLUTION};

        var output: VertexOutput;
        output.position = vec4f(position, 0, 1);
        output.cluster = i;

        return output;
    }
`;

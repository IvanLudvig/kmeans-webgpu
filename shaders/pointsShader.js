import { RESOLUTION } from '../config.js';

export default `
    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) @interpolate(flat) cluster: u32
    };

    @group(0) @binding(0) var<storage> points: array<f32>;
    @group(0) @binding(2) var<storage> clusters: array<u32>;

    @vertex
    fn vs(
        @location(0) vertex: vec2f, 
        @builtin(instance_index) i: u32
    ) -> VertexOutput {
        let position = 2 * vec2f(points[2*i], points[2*i + 1]) - 1 + 4 * vertex/${RESOLUTION};

        var output: VertexOutput;
        output.position = vec4f(position, 0, 1);
        output.cluster = clusters[i];

        return output;
    }
`;

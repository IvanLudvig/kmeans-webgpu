import { K } from '../config.js';

export default `
    @fragment
    fn fs(@location(0) @interpolate(flat) cluster: u32) -> @location(0) vec4f {
        let normalizedColorId = f32(cluster) / ${K};

        return vec4f(
            fract(1 - pow(normalizedColorId, 2)), 
            fract(normalizedColorId + 0.31), 
            fract(normalizedColorId + 0.82), 
            1
        );
    }
`;

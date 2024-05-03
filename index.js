import { WORKGROUP_SIZE, N, K } from './config.js';
import assignClusters from './shaders/assignClusters.js';
import pointsShader from './shaders/pointsShader.js';
import fragmentShader from './shaders/fragmentShader.js';
import updateCentroids from './shaders/updateCentroids.js';
import centroidsShader from './shaders/centroidsShader.js';

const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
    window.alert('WebGPU not supported');
    throw new Error('WebGPU not supported');
}

const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format: canvasFormat });

const pointVertices = new Float32Array([
    -1, -1,
    1, -1,
    1, 1,
    -1, -1,
    1, 1,
    -1, 1
]);
const pointVertexBuffer = device.createBuffer({
    size: pointVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(pointVertexBuffer, 0, pointVertices);

const centroidVertices = new Float32Array([
    -2, -2,
    2, -2,
    0, 2
]);
const centroidVertexBuffer = device.createBuffer({
    size: centroidVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(centroidVertexBuffer, 0, centroidVertices);

const vertexBufferLayout = {
    arrayStride: 2 * 4, // 2 x 4 bytes
    attributes: [{ format: 'float32x2', offset: 0, shaderLocation: 0 }]
};

const points = new Float32Array(2 * N);
for (let i = 0; i < 2 * N; i++) {
    points[i] = Math.random();
}
const pointsBuffer = device.createBuffer({
    size: points.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(pointsBuffer, 0, points);

const centroids = new Float32Array(2 * K);
for (let i = 0; i < N; i++) {
    centroids[i] = Math.random();
}
const centroidsBuffer = device.createBuffer({
    size: centroids.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(centroidsBuffer, 0, centroids);

const clustersBuffer = device.createBuffer({
    size: 4 * N, // 4 bytes x N points
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
    }, {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
    }, {
        binding: 2,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
    }]
});

const renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
        { binding: 0, resource: { buffer: pointsBuffer } },
        { binding: 1, resource: { buffer: centroidsBuffer } },
        { binding: 2, resource: { buffer: clustersBuffer } }
    ]
});


const renderPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [renderBindGroupLayout]
});

const fragmentModule = device.createShaderModule({ code: fragmentShader });
const pointsModule = device.createShaderModule({ code: pointsShader });
const pointsPipeline = device.createRenderPipeline({
    layout: renderPipelineLayout,
    vertex: {
        module: pointsModule,
        buffers: [vertexBufferLayout]
    },
    fragment: {
        module: fragmentModule,
        targets: [{ format: canvasFormat }]
    }
});

const centroidsModule = device.createShaderModule({ code: centroidsShader });
const centroidsPipeline = device.createRenderPipeline({
    layout: renderPipelineLayout,
    vertex: {
        module: centroidsModule,
        buffers: [vertexBufferLayout]
    },
    fragment: {
        module: fragmentModule,
        targets: [{ format: canvasFormat }]
    }
});

const centroidsBufferComp = device.createBuffer({
    size: centroids.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});
const clustersBufferComp = device.createBuffer({
    size: 4 * N,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});

const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
    }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
    }]
});

const computeBindGroup = device.createBindGroup({
    layout: computeBindGroupLayout,
    entries: [
        { binding: 0, resource: { buffer: centroidsBufferComp } },
        { binding: 1, resource: { buffer: clustersBufferComp } }
    ]
});

const computePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [renderBindGroupLayout, computeBindGroupLayout]
});

const assignModule = device.createShaderModule({ code: assignClusters });
const assignPipeline = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: {
        module: assignModule
    }
});

const updateModule = device.createShaderModule({ code: updateCentroids });
const updatePipeline = device.createComputePipeline({
    layout: computePipelineLayout,
    compute: {
        module: updateModule
    }
});


const update = () => {
    const encoder = device.createCommandEncoder();

    const assignPass = encoder.beginComputePass();
    assignPass.setPipeline(assignPipeline);
    assignPass.setBindGroup(0, renderBindGroup);
    assignPass.setBindGroup(1, computeBindGroup);
    assignPass.dispatchWorkgroups(Math.ceil(N / WORKGROUP_SIZE));
    assignPass.end();

    encoder.copyBufferToBuffer(clustersBufferComp, 0, clustersBuffer, 0, 4 * N);

    const updatePass = encoder.beginComputePass();
    updatePass.setPipeline(updatePipeline);
    updatePass.setBindGroup(0, renderBindGroup);
    updatePass.setBindGroup(1, computeBindGroup);
    updatePass.dispatchWorkgroups(Math.ceil(K / WORKGROUP_SIZE));
    updatePass.end();

    encoder.copyBufferToBuffer(centroidsBufferComp, 0, centroidsBuffer, 0, centroids.byteLength);

    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            storeOp: 'store',
        }]
    });

    pass.setPipeline(pointsPipeline);
    pass.setBindGroup(0, renderBindGroup);
    pass.setVertexBuffer(0, pointVertexBuffer);
    pass.draw(pointVertices.length / 2, N);

    pass.setPipeline(centroidsPipeline);
    pass.setBindGroup(0, renderBindGroup);
    pass.setVertexBuffer(0, centroidVertexBuffer);
    pass.draw(centroidVertices.length / 2, K);

    pass.end();
    device.queue.submit([encoder.finish()]);
}

setInterval(update, 500);

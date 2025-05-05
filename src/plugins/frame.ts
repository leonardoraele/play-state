import type { EmptyWorldDefinition } from '../world-definition.ts';

export interface FrameData {
	frameStart: number;
	frameCount: number;
	delta: number;
	fps: number;
}

export const FrameUpdatePlugin = (worldBuilder: EmptyWorldDefinition) =>
	worldBuilder.withComponents<{
		frameData: FrameData,
	}>()
	.withEntity('#frameData', {
		frameData: {
			frameStart: 0,
			frameCount: 0,
			delta: 0,
			fps: 0,
		} satisfies FrameData,
	})
	.withEvent<'update', FrameData>()
	.withSystem(entityStore => {
		const frameData: FrameData = entityStore.queryId('#frameData')!.data.frameData!;
		let fpsCounter = 0;
		return {
			name: '#frame',
			ready(controller) {
				if (typeof requestAnimationFrame === 'undefined') {
					console.warn('⚠ FrameUpdate plugin is not running correctly. Cause: Function `requestAnimationFrame` is not available in this environment.');
					return;
				}
				frameData.frameCount = requestAnimationFrame(function update(now) {
					frameData.delta = now - frameData.frameStart;
					if (frameData.delta > 1000) {
						frameData.fps = 0;
						fpsCounter = 0;
					} else if (now % 1000 < frameData.frameStart % 1000) {
						frameData.fps = fpsCounter;
						fpsCounter = 0;
					}
					fpsCounter++;
					frameData.frameStart = now;
					controller.dispatchEvent('update', frameData);
					frameData.frameCount = requestAnimationFrame(update);
				});
			},
		};
	});

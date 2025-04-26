import type { WorldDefinition } from '../world-definition.ts';

export const FrameUpdatePlugin = (worldBuilder: WorldDefinition) =>
	worldBuilder.withComponents<{
			frameData: {
				frameStart: number,
				frameCount: number,
				delta: number,
				fps: number,
			},
		}>()
		.withEntity({
			id: '#frameData',
			data: {
				frameData: {
					frameStart: 0,
					frameCount: 0,
					delta: 0,
					fps: 0,
				},
			},
		})
		.withSystem(entityStore => {
			const frameData = entityStore.queryId('#frameData')!.data.frameData!;
			let fpsCounter = 0;
			return {
				name: '#frame',
				ready(controller) {
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

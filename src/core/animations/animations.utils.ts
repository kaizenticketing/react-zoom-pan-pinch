import { animations } from "./animations.constants";
import {
	ReactZoomPanPinchContext,
	StateType,
} from "../../models";

export const handleCancelAllAnimations = (
	contextInstance: ReactZoomPanPinchContext,
): void => {
	if (!contextInstance.mounted || !contextInstance.ready)
		return;

	if (contextInstance.animation || contextInstance.velocity || contextInstance.animate) {
		console.info("🛑 Cancelling animation #", contextInstance.animationRequestId);

		// clear animation state - will be noticed by animation loop
		contextInstance.animate = false;
		contextInstance.animation = null;
		contextInstance.velocity = null;
	}
};

export function setupAnimation(
	contextInstance: ReactZoomPanPinchContext,
	targetState: StateType | null,
	animationTime: number,
	animationType: string,
	callback: (animationId: number, step: number) => boolean,
): void {
	if (!contextInstance.mounted)
		return;

	const startTime = new Date().getTime();
	const lastStep = 1;

	// if another animation is active, cancel it (another frame might get run, but it will notice and stop)
	handleCancelAllAnimations(contextInstance);

	// assign unique ID to this animation request
	const thisAnimationRequestId = ++contextInstance.animationRequestId;
	console.info(`▶️ Starting animation #${thisAnimationRequestId}`, targetState, animationTime, animationType);

	// new animation
	contextInstance.animation = () => {
		const frameTime = new Date().getTime() - startTime;
		const animationProgress = frameTime / animationTime;

		// get the next animation step based on a smoothing algorithm
		const animationTypeFn = animations[animationType];
		const step: number = animationTypeFn(animationProgress);

		if (frameTime >= animationTime) {
			//
			// final animation step

			callback(thisAnimationRequestId, lastStep);

			// if this is the current animation, clear it
			if (thisAnimationRequestId === contextInstance.animationRequestId)
				contextInstance.animation = null;

			console.info(`🏁 Animation #${thisAnimationRequestId} complete`, targetState);
		} else if (contextInstance.animation) {
			//
			// intermediate animation step

			const continueAnimation = callback(thisAnimationRequestId, step);

			// animation cancelled
			if (!continueAnimation) {
				console.info(`🛑 Animation #${thisAnimationRequestId} cancelled`, targetState);
				return;
			}

			// request next frame
			setTimeout(() => {
				if (!contextInstance.animation) {
					console.info(`🛑 Animation #${thisAnimationRequestId} cancelled before next frame`);
					return;
				}

				requestAnimationFrame(contextInstance.animation);
			}, 0);
		}
	};

	// start the animation
	// setTimeout(() => {
	if (!contextInstance.animation) {
		console.info(`🛑 Animation #${thisAnimationRequestId} cancelled before it could be started`);
		return;
	}

	requestAnimationFrame(contextInstance.animation);
	// }, 0);
}

function isValidTargetState(targetState: StateType): boolean {
	const { scale, positionX, positionY } = targetState;

	if (
		Number.isNaN(scale) ||
		Number.isNaN(positionX) ||
		Number.isNaN(positionY)
	) {
		return false;
	}

	return true;
}

export function animate(
	contextInstance: ReactZoomPanPinchContext,
	targetState: StateType,
	animationTime: number,
	animationType: string,
): void {
	const isValid = isValidTargetState(targetState);
	if (!contextInstance.mounted || !isValid) {
		console.info("⚠️ Animation aborted: invalid target state or not mounted", targetState);
		return;
	}

	const { setTransformState } = contextInstance;

	if (animationTime === 0) {
		// instant transform
		const thisAnimationRequestId = ++contextInstance.animationRequestId;
		console.info(`▶️ Instant animation #${thisAnimationRequestId}`, targetState);
		setTransformState(targetState.scale, targetState.positionX, targetState.positionY);
		return;
	}
	else {
		// start new animation and assign unique request ID
		setupAnimation(
			contextInstance,
			targetState,
			animationTime,
			animationType,
			(thisAnimationRequestId: number, step: number) => {
				if (thisAnimationRequestId !== contextInstance.animationRequestId) {
					console.log(`🧨 Skipping stale frame from request #${thisAnimationRequestId} (current is #${contextInstance.animationRequestId})`);
					return false; // cancel this animation
				}

				// interpolate (based on step) between current state and target state
				const { scale: currentScale, positionX: currentX, positionY: currentY } = contextInstance.transformState;
				const newScale = currentScale + (targetState.scale - currentScale) * step;
				const newPositionX = currentX + (targetState.positionX - currentX) * step;
				const newPositionY = currentY + (targetState.positionY - currentY) * step;

				// console.log(`✅ Applying frame from request #${thisAnimationRequestId}`);

				setTransformState(newScale, newPositionX, newPositionY);
				return true; // continue animation
			},
		);
	}
}

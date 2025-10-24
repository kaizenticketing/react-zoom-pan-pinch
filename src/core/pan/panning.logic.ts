import { ReactZoomPanPinchContext } from "../../models/context.model";
import { handleCancelAllAnimations } from "../animations/animations.utils";
import { handleCalculateBounds } from "../bounds/bounds.utils";
import {
	getPaddingValue,
	getPanningClientPosition,
	handleNewPosition,
	handlePanningSetup,
	handleTouchPanningSetup,
} from "./panning.utils";
import {
	handleVelocityPanning,
	handleCalculateVelocity,
} from "./velocity.logic";

export function handlePanningStart(
	contextInstance: ReactZoomPanPinchContext,
	event: MouseEvent | TouchEvent,
): void {
	// if an animation is running and interactions are locked, prevent panning
	if (contextInstance.animation && contextInstance.setup.lockInteractionsDuringAnimation)
		return;

	const { scale } = contextInstance.transformState;

	handleCancelAllAnimations(contextInstance);
	handleCalculateBounds(contextInstance, scale);
	if (window.TouchEvent !== undefined && event instanceof TouchEvent) {
		handleTouchPanningSetup(contextInstance, event as TouchEvent);
	} else {
		handlePanningSetup(contextInstance, event as MouseEvent);
	}
}

export function handleAlignToBounds(
	contextInstance: ReactZoomPanPinchContext,
	_customAnimationTime?: number,
): void {
	const { scale } = contextInstance.transformState;
	const { minScale, alignmentAnimation } = contextInstance.setup;
	const { disabled, sizeX, sizeY /*, animationTime, animationType*/ } =
		alignmentAnimation;

	const isDisabled = disabled || scale < minScale || (!sizeX && !sizeY);

	if (isDisabled)
		return;

	// TODO: this is resetting animations that are in progress - we trust our logic to track the screen size and bounds correctly without it

	// const targetState = handlePanToBounds(contextInstance);

	// if (targetState) {
	// 	const effectiveTime = customAnimationTime ?? animationTime;
	// 	if (effectiveTime === 0 && contextInstance.animation) {
	// 		return;
	// 	}

	// 	animate(
	// 		contextInstance,
	// 		targetState,
	// 		effectiveTime,
	// 		animationType,
	// 	);
	// }
}

export function handlePanning(
	contextInstance: ReactZoomPanPinchContext,
	clientX: number,
	clientY: number,
): void {
	const { startCoords, clientCoords, setup } = contextInstance;
	const { sizeX, sizeY } = setup.alignmentAnimation;

	if (!startCoords) return;

	const { x, y } = getPanningClientPosition(contextInstance, clientX, clientY);
	const paddingValueX = getPaddingValue(contextInstance, sizeX);
	const paddingValueY = getPaddingValue(contextInstance, sizeY);

	if (clientCoords?.x != clientX && clientCoords?.y != clientY) handleCalculateVelocity(contextInstance, { x, y });
	handleNewPosition(contextInstance, x, y, paddingValueX, paddingValueY);
}

export function handlePanningEnd(
	contextInstance: ReactZoomPanPinchContext,
): void {
	if (contextInstance.isPanning) {
		const { velocityDisabled } = contextInstance.setup.panning;
		const { velocity, wrapperComponent, contentComponent } = contextInstance;

		contextInstance.isPanning = false;
		
		// clear animation state - will be noticed by animation loop
		// NOTE: panning animations are done outside of animation - so this is why we don't use handleCancelAllAnimations here
		contextInstance.animate = false;
		contextInstance.animation = null;
		contextInstance.velocity = null;

		const wrapperRect = wrapperComponent?.getBoundingClientRect();
		const contentRect = contentComponent?.getBoundingClientRect();

		const wrapperWidth = wrapperRect?.width || 0;
		const wrapperHeight = wrapperRect?.height || 0;
		const contentWidth = contentRect?.width || 0;
		const contentHeight = contentRect?.height || 0;
		const isZoomed =
			wrapperWidth < contentWidth || wrapperHeight < contentHeight;

		const shouldAnimate =
			!velocityDisabled && velocity && velocity?.total > 0.1 && isZoomed;

		if (shouldAnimate) {
			handleVelocityPanning(contextInstance);
		} else {
			handleAlignToBounds(contextInstance);
		}
	}
}

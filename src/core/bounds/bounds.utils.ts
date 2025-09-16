/* eslint-disable no-param-reassign */
import { roundNumber } from "../../utils";
import {
  BoundsType,
  PositionType,
  ReactZoomPanPinchContext,
} from "../../models";
import { ComponentsSizesType } from "./bounds.types";

export function getComponentsSizes(
  wrapperComponent: HTMLDivElement,
  contentComponent: HTMLDivElement,
  newScale: number,
): ComponentsSizesType {
  const wrapperWidth = wrapperComponent.offsetWidth;
  const wrapperHeight = wrapperComponent.offsetHeight;

  const contentWidth = contentComponent.offsetWidth;
  const contentHeight = contentComponent.offsetHeight;

  const newContentWidth = contentWidth * newScale;
  const newContentHeight = contentHeight * newScale;
  const newDiffWidth = wrapperWidth - newContentWidth;
  const newDiffHeight = wrapperHeight - newContentHeight;

  return {
    wrapperWidth,
    wrapperHeight,
    newContentWidth,
    newDiffWidth,
    newContentHeight,
    newDiffHeight,
  };
}

export const calculateBounds = (
	contextInstance: ReactZoomPanPinchContext,
  wrapperWidth: number,
  newContentWidth: number,
  diffWidth: number,
  wrapperHeight: number,
  newContentHeight: number,
  diffHeight: number,
  centerZoomedOut: boolean,
): BoundsType => {
		const scaleWidthFactor =
			wrapperWidth > newContentWidth
				? diffHeight * (centerZoomedOut ? 1 : 0.5)
				: 0;
		const scaleHeightFactor =
			wrapperHeight > newContentHeight
			// TODO: this originally used diffHeight - is that right?
				? diffHeight * (centerZoomedOut ? 1 : 0.5)
				: 0;

		// TODO: scale affects these values!

		if (contextInstance.explicitBounds) {
			// if explicit bounds are set, use those instead of calculating from the content size

			const explicitBoundsWidth = contextInstance.explicitBounds.maxPositionX - contextInstance.explicitBounds.minPositionX;
			const explicitBoundsHeight = contextInstance.explicitBounds.maxPositionY - contextInstance.explicitBounds.minPositionY;

			const minPositionX = wrapperWidth - explicitBoundsWidth - scaleWidthFactor;
			const maxPositionX = scaleWidthFactor;
			const minPositionY = wrapperHeight - explicitBoundsHeight - scaleHeightFactor;
			const maxPositionY = scaleHeightFactor;

			// console.info('getBounds (explicit)', { wrapperWidth, newContentWidth, newDiffWidth, wrapperHeight, newContentHeight, newDiffHeight, centerZoomedOut, minPositionX, maxPositionX, minPositionY, maxPositionY, explicitBounds: contextInstance.explicitBounds });

			return { minPositionX, maxPositionX, minPositionY, maxPositionY };
		}
		else {
			// otherwise calculate from the content size

			const minPositionX = wrapperWidth - newContentWidth - scaleWidthFactor;
			const maxPositionX = scaleWidthFactor;
			const minPositionY = wrapperHeight - newContentHeight - scaleHeightFactor;
			const maxPositionY = scaleHeightFactor;

			// console.info('getBounds (whole svg)', { wrapperWidth, newContentWidth, newDiffWidth, wrapperHeight, newContentHeight, newDiffHeight, centerZoomedOut, minPositionX, maxPositionX, minPositionY, maxPositionY });

			return { minPositionX, maxPositionX, minPositionY, maxPositionY };
		}
	// }
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

// Based on @aholachek ;)
// https://twitter.com/chpwn/status/285540192096497664
// iOS constant = 0.55

// https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5

function rubberband(distance: number, dimension: number, constant: number) {
  if (dimension === 0 || Math.abs(dimension) === Infinity)
    return distance ** (constant * 5);
  return (distance * dimension * constant) / (dimension + constant * distance);
}

export function rubberbandIfOutOfBounds(
  position: number,
  min: number,
  max: number,
  constant = 0.15,
) {
  if (constant === 0) return clamp(position, min, max);
  if (position < min)
    return -rubberband(min - position, max - min, constant) + min;
  if (position > max)
    return +rubberband(position - max, max - min, constant) + max;
  return position;
}

/**
 * Keeps value between given bounds, used for limiting view to given boundaries
 * 1# eg. boundLimiter(2, 0, 3, true) => 2
 * 2# eg. boundLimiter(4, 0, 3, true) => 3
 * 3# eg. boundLimiter(-2, 0, 3, true) => 0
 * 4# eg. boundLimiter(10, 0, 3, false) => 10
 */
export const boundLimiter = (
  value: number,
  minBound: number,
  maxBound: number,
  isActive: boolean,
): number => {
  if (!isActive) return roundNumber(value, 2);
  if (value < minBound) return roundNumber(minBound, 2);
  if (value > maxBound) return roundNumber(maxBound, 2);
  return roundNumber(value, 2);
};

export const handleCalculateBounds = (
  contextInstance: ReactZoomPanPinchContext,
  newScale: number,
): BoundsType => {
  const bounds = calculateBounds(contextInstance, newScale);

  // Save bounds
  contextInstance.bounds = bounds;
  return bounds;
};

export function getMouseBoundedPosition(
  positionX: number,
  positionY: number,
  bounds: BoundsType,
  limitToBounds: boolean,
  paddingValueX: number,
  paddingValueY: number,
  wrapperComponent: HTMLDivElement | null,
): PositionType {
  const { minPositionX, minPositionY, maxPositionX, maxPositionY } = bounds;

  let paddingX = 0;
  let paddingY = 0;

  if (wrapperComponent) {
    paddingX = paddingValueX;
    paddingY = paddingValueY;
  }

  const x = boundLimiter(
    positionX,
    minPositionX - paddingX,
    maxPositionX + paddingX,
    limitToBounds,
  );

  const y = boundLimiter(
    positionY,
    minPositionY - paddingY,
    maxPositionY + paddingY,
    limitToBounds,
  );
  return { x, y };
}

export function setExplicitBounds(
  contextInstance: ReactZoomPanPinchContext,
  newBounds: BoundsType | null
): void {
	console.log('setExplicitBounds', newBounds, contextInstance.explicitBounds);

	contextInstance.explicitBounds = newBounds;
}
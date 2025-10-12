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
  newScale: number,
): BoundsType => {
  const { wrapperComponent, contentComponent, setup } = contextInstance;

  // Fallback when components are not mounted
  if (!wrapperComponent || !contentComponent) {
    return { minPositionX: 0, maxPositionX: 0, minPositionY: 0, maxPositionY: 0 };
  }

  const { wrapperWidth, wrapperHeight, newContentWidth, newContentHeight, newDiffWidth, newDiffHeight } =
    getComponentsSizes(wrapperComponent, contentComponent, newScale);

  const { centerZoomedOut } = setup;

  // When content is smaller than wrapper, allow space to center or half-range
  const scaleWidthFactor =
    wrapperWidth > newContentWidth
      ? newDiffWidth * (centerZoomedOut ? 1 : 0.5)
      : 0;
  const scaleHeightFactor =
    wrapperHeight > newContentHeight
      ? newDiffHeight * (centerZoomedOut ? 1 : 0.5)
      : 0;

  // if explicit bounds are provided (interpreted as content-space rectangle),
  // convert them into wrapper-space pan limits using current scale.
  if (contextInstance.explicitBounds) {
	const {
		minPositionX: minX,
		maxPositionX: maxX,
		minPositionY: minY,
		maxPositionY: maxY,
	} = contextInstance.explicitBounds;

	// Convert from content-space (SVG units) to wrapper-space (screen pixels)
	const scaled = {
		minPositionX: -maxX * newScale,
		maxPositionX: -minX * newScale,
		minPositionY: -maxY * newScale,
		maxPositionY: -minY * newScale,
	};

	// console.log("[rzpp] using explicit bounds (scaled)", scaled);
	return scaled;
  } else {
	// default bounds based on content size inside wrapper
	const minPositionX = wrapperWidth - newContentWidth - scaleWidthFactor;
	const maxPositionX = scaleWidthFactor;
	const minPositionY = wrapperHeight - newContentHeight - scaleHeightFactor;
	const maxPositionY = scaleHeightFactor;

	const result = { minPositionX, maxPositionX, minPositionY, maxPositionY };
	// console.log("[rzpp] calculateBounds result", result);
	return result;
  }
};

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
	contextInstance.explicitBounds = newBounds;
}

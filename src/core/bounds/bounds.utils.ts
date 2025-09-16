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
    const { minPositionX: minX, maxPositionX: maxX, minPositionY: minY, maxPositionY: maxY } =
      contextInstance.explicitBounds;

    const rectWidthScaled = (maxX - minX) * newScale;
    const rectHeightScaled = (maxY - minY) * newScale;

    const slackX = wrapperWidth - rectWidthScaled;
    const slackY = wrapperHeight - rectHeightScaled;

    const scaleWidthFactor = slackX > 0 ? slackX * (centerZoomedOut ? 1 : 0.5) : 0;
    const scaleHeightFactor = slackY > 0 ? slackY * (centerZoomedOut ? 1 : 0.5) : 0;

    // work in a coordinate space relative to the rectangle's top-left by
    // offsetting with minX/minY, then convert back.
    const minPrimeX = wrapperWidth - rectWidthScaled - scaleWidthFactor;
    const maxPrimeX = scaleWidthFactor;
    const minPrimeY = wrapperHeight - rectHeightScaled - scaleHeightFactor;
    const maxPrimeY = scaleHeightFactor;

    const minPositionX = minPrimeX - minX * newScale;
    const maxPositionX = maxPrimeX - minX * newScale;
    const minPositionY = minPrimeY - minY * newScale;
    const maxPositionY = maxPrimeY - minY * newScale;

    return { minPositionX, maxPositionX, minPositionY, maxPositionY };
  }

  // default bounds based on content size inside wrapper
  const minPositionX = wrapperWidth - newContentWidth - scaleWidthFactor;
  const maxPositionX = scaleWidthFactor;
  const minPositionY = wrapperHeight - newContentHeight - scaleHeightFactor;
  const maxPositionY = scaleHeightFactor;

  return { minPositionX, maxPositionX, minPositionY, maxPositionY };
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
